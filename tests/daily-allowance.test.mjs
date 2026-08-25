import assert from "node:assert/strict";
import test from "node:test";

import { calculateDailyAllowance } from "../src/lib/daily-allowance.ts";
import { getPayCycle } from "../src/lib/pay-cycle.ts";

const payCycle = getPayCycle(new Date("2026-08-26T05:00:00.000Z"));

function account(id, initialBalance, createdAt, name = id) {
  return {
    accountType: "Bank",
    createdAt,
    id,
    initialBalance,
    isArchived: false,
    name,
    userId: "user-a",
  };
}

function commitment(overrides = {}) {
  return {
    accountId: "bca",
    amount: 500_000,
    category: "Bills",
    commitmentType: "subscription",
    createdAt: 1,
    disableReminders: false,
    dueDay: 10,
    id: "commitment-a",
    isAutoDeduct: true,
    lastProcessed: null,
    name: "Internet",
    userId: "user-a",
    ...overrides,
  };
}

function recurringExpense(recurringPeriod, overrides = {}) {
  return {
    accountId: "bca",
    amount: 500_000,
    category: "Bills",
    createdAt: 1,
    id: "expense-a",
    note: "",
    owner: "Owner",
    paymentMethod: "Debit Card",
    recurringCommitmentId: "commitment-a",
    recurringPeriod,
    userId: "user-a",
    ...overrides,
  };
}

function calculate(overrides = {}) {
  const accounts = [
    account("bca", 2_000_000, 2, "BCA"),
    account("exness", 10_000_000, 1, "Exness"),
  ];

  return calculateDailyAllowance({
    accountBalances: { bca: 2_000_000, exness: 10_000_000 },
    accounts,
    commitments: [],
    expenses: [],
    incomes: [],
    livingAccountIds: ["bca"],
    payCycle,
    transfers: [],
    ...overrides,
  });
}

test("no living-account selection returns setup instead of a numeric zero", () => {
  assert.deepEqual(calculate({ livingAccountIds: [] }), {
    reason: "Pilih akun kebutuhan hidup untuk menghitung batas harian.",
    status: "setup-required",
  });
});

test("only selected living accounts fund the daily allowance", () => {
  assert.deepEqual(calculate(), {
    dailyAllowance: 66_000,
    disposableBalance: 2_000_000,
    livingBalance: 2_000_000,
    overspentToday: 0,
    remainingSpendableDays: 30,
    remainingToday: 66_000,
    reservedCommitments: 0,
    selectedAccountCount: 1,
    spentToday: 0,
    status: "ready",
  });
});

test("today's included expense reduces today's allowance by the full amount", () => {
  const result = calculate({
    accountBalances: { bca: 5_980_000, exness: 10_000_000 },
    expenses: [
      {
        accountId: "bca",
        affectsDailyAllowance: true,
        amount: 20_000,
        category: "Food",
        createdAt: new Date("2026-08-26T05:00:00.000Z").getTime(),
        id: "lunch",
        note: "",
        owner: "Owner",
        paymentMethod: "Cash",
        transactionDate: "2026-08-26",
        userId: "user-a",
      },
    ],
  });

  assert.equal(result.dailyAllowance, 200_000);
  assert.equal(result.spentToday, 20_000);
  assert.equal(result.remainingToday, 180_000);
  assert.equal(result.overspentToday, 0);
});

test("excluded expense leaves today's allowance intact but lowers tomorrow's allowance", () => {
  const excludedExpense = {
    accountId: "bca",
    affectsDailyAllowance: false,
    amount: 1_000_000,
    category: "Other",
    createdAt: new Date("2026-08-26T05:00:00.000Z").getTime(),
    id: "large-expense",
    note: "",
    owner: "Owner",
    paymentMethod: "Transfer",
    transactionDate: "2026-08-26",
    userId: "user-a",
  };
  const today = calculate({
    accountBalances: { bca: 5_000_000, exness: 10_000_000 },
    expenses: [excludedExpense],
  });
  const tomorrow = calculate({
    accountBalances: { bca: 5_000_000, exness: 10_000_000 },
    expenses: [excludedExpense],
    payCycle: getPayCycle(new Date("2026-08-27T05:00:00.000Z")),
  });

  assert.equal(today.dailyAllowance, 200_000);
  assert.equal(today.spentToday, 0);
  assert.equal(today.remainingToday, 200_000);
  assert.equal(tomorrow.dailyAllowance, 172_000);
});

test("income can start affecting the allowance today or wait until tomorrow", () => {
  const income = {
    accountId: "bca",
    amount: 300_000,
    createdAt: new Date("2026-08-26T05:00:00.000Z").getTime(),
    id: "bonus",
    note: "",
    owner: "Owner",
    source: "Bonus",
    transactionDate: "2026-08-26",
    userId: "user-a",
  };

  assert.equal(
    calculate({
      accountBalances: { bca: 6_300_000, exness: 10_000_000 },
      incomes: [{ ...income, affectsDailyAllowance: true }],
    }).dailyAllowance,
    210_000,
  );
  assert.equal(
    calculate({
      accountBalances: { bca: 6_300_000, exness: 10_000_000 },
      incomes: [{ ...income, affectsDailyAllowance: false }],
    }).dailyAllowance,
    200_000,
  );
});

test("boundary transfer can start affecting the allowance today or wait until tomorrow", () => {
  const transfer = {
    amount: 300_000,
    createdAt: new Date("2026-08-26T05:00:00.000Z").getTime(),
    fromAccountId: "bca",
    id: "invest",
    note: "",
    toAccountId: "exness",
    transactionDate: "2026-08-26",
    userId: "user-a",
  };

  assert.equal(
    calculate({
      accountBalances: { bca: 5_700_000, exness: 10_300_000 },
      transfers: [{ ...transfer, affectsDailyAllowance: true }],
    }).dailyAllowance,
    190_000,
  );
  assert.equal(
    calculate({
      accountBalances: { bca: 5_700_000, exness: 10_300_000 },
      transfers: [{ ...transfer, affectsDailyAllowance: false }],
    }).dailyAllowance,
    200_000,
  );
});

test("negative selected balances reduce the aggregate living balance", () => {
  assert.equal(
    calculate({
      accountBalances: { bca: 2_000_000, cash: -200_000, exness: 10_000_000 },
      accounts: [
        account("bca", 2_000_000, 2),
        account("cash", -200_000, 3),
        account("exness", 10_000_000, 1),
      ],
      livingAccountIds: ["bca", "cash"],
    }).livingBalance,
    1_800_000,
  );
});

test("an unpaid commitment due in the cycle reserves living-account money", () => {
  assert.deepEqual(calculate({ commitments: [commitment()] }), {
    dailyAllowance: 50_000,
    disposableBalance: 1_500_000,
    livingBalance: 2_000_000,
    overspentToday: 0,
    remainingSpendableDays: 30,
    remainingToday: 50_000,
    reservedCommitments: 500_000,
    selectedAccountCount: 1,
    spentToday: 0,
    status: "ready",
  });
});

test("only the exact recurring calendar period settles the cycle occurrence", () => {
  assert.equal(
    calculate({
      commitments: [commitment()],
      expenses: [recurringExpense("2026-08-01")],
    }).reservedCommitments,
    500_000,
  );

  assert.equal(
    calculate({
      commitments: [commitment()],
      expenses: [recurringExpense("2026-09-01")],
    }).reservedCommitments,
    0,
  );
});

test("a commitment paid today is not charged against the daily allowance twice", () => {
  const result = calculate({
    accountBalances: { bca: 1_500_000, exness: 10_000_000 },
    commitments: [commitment()],
    expenses: [
      recurringExpense("2026-09-01", {
        affectsDailyAllowance: true,
        createdAt: new Date("2026-08-26T05:00:00.000Z").getTime(),
        transactionDate: "2026-08-26",
      }),
    ],
  });

  assert.equal(result.dailyAllowance, 50_000);
  assert.equal(result.spentToday, 0);
  assert.equal(result.remainingToday, 50_000);
  assert.equal(result.reservedCommitments, 0);
});

test("commitments paid from an explicitly excluded account are not reserved", () => {
  assert.equal(
    calculate({ commitments: [commitment({ accountId: "exness" })] })
      .reservedCommitments,
    0,
  );
});

test("an unlinked commitment follows the RPC oldest-active-account fallback", () => {
  assert.equal(
    calculate({ commitments: [commitment({ accountId: null })] })
      .reservedCommitments,
    0,
  );

  assert.equal(
    calculate({
      accounts: [
        account("bca", 2_000_000, 1),
        account("exness", 10_000_000, 2),
      ],
      commitments: [commitment({ accountId: null })],
    }).reservedCommitments,
    500_000,
  );
});

test("a missing explicit payment account requires review", () => {
  assert.deepEqual(
    calculate({ commitments: [commitment({ accountId: "archived-account" })] }),
    {
      reason: "Akun pembayaran untuk komitmen Internet perlu ditinjau.",
      status: "review-required",
    },
  );
});

test("invalid legacy commitment amounts require review", () => {
  assert.equal(
    calculate({ commitments: [commitment({ amount: 0 })] }).status,
    "review-required",
  );
});

test("commitments above the living balance produce an explained valid zero", () => {
  assert.deepEqual(
    calculate({ commitments: [commitment({ amount: 2_500_000 })] }),
    {
      dailyAllowance: 0,
      disposableBalance: 0,
      livingBalance: 2_000_000,
      overspentToday: 0,
      remainingSpendableDays: 30,
      remainingToday: 0,
      reservedCommitments: 2_500_000,
      selectedAccountCount: 1,
      spentToday: 0,
      status: "no-disposable-balance",
    },
  );
});

test("stale selected IDs with no active account return setup", () => {
  assert.equal(
    calculate({ livingAccountIds: ["archived-account"] }).status,
    "setup-required",
  );
});

// --- commitment reservations measured against real payments -----------------

// 30 August 2026 WIB: 26 spendable days left in the 25 Aug -> 24 Sep cycle.
const midCycle = getPayCycle(new Date("2026-08-30T05:00:00.000Z"));

function midCycleAllowance({ balance, commitments = [], expenses = [] }) {
  return calculateDailyAllowance({
    accountBalances: { bca: balance },
    accounts: [account("bca", 0, 1, "BCA")],
    commitments,
    expenses,
    incomes: [],
    livingAccountIds: ["bca"],
    payCycle: midCycle,
    transfers: [],
  });
}

function todayPayment(amount, recurringPeriod) {
  return recurringExpense(recurringPeriod, {
    amount,
    transactionDate: midCycle.todayKey,
  });
}

// The daily budget must never promise more than the free balance can fund.
function assertAllowanceMatchesDisposable(result) {
  assert.equal(
    result.dailyAllowance,
    Math.floor(
      result.disposableBalance / result.remainingSpendableDays / 1_000,
    ) * 1_000,
  );
}

test("settling an older period today removes that money from today's budget", () => {
  // A late payment for a previous occurrence, while this cycle is still unpaid.
  const result = midCycleAllowance({
    balance: 9_500_000,
    commitments: [commitment({ amount: 500_000, dueDay: 5 })],
    expenses: [todayPayment(500_000, "2026-08-01")],
  });

  assert.equal(result.remainingSpendableDays, 26);
  assert.equal(result.reservedCommitments, 500_000);
  assert.equal(result.disposableBalance, 9_000_000);
  // Money that actually left today is gone, so the budget is 9m / 26, not 9.5m / 26.
  assert.equal(result.dailyAllowance, 346_000);
  assertAllowanceMatchesDisposable(result);
});

test("a bill paid above plan is reserved at the amount actually paid", () => {
  const result = midCycleAllowance({
    balance: 9_350_000,
    commitments: [commitment({ amount: 500_000, dueDay: 5 })],
    expenses: [todayPayment(650_000, "2026-09-01")],
  });

  assert.equal(result.reservedCommitments, 0);
  assert.equal(result.disposableBalance, 9_350_000);
  // The planned 500k used to be subtracted instead of the real 650k.
  assert.equal(result.dailyAllowance, 359_000);
  assertAllowanceMatchesDisposable(result);
});

test("a partial payment reserves only the remainder", () => {
  const result = midCycleAllowance({
    balance: 9_800_000,
    commitments: [commitment({ amount: 500_000, dueDay: 5 })],
    expenses: [todayPayment(200_000, "2026-09-01")],
  });

  assert.equal(result.reservedCommitments, 300_000);
  assert.equal(result.disposableBalance, 9_500_000);
  assert.equal(result.dailyAllowance, 365_000);
  assertAllowanceMatchesDisposable(result);
});

test("a bill paid on time for this cycle holds nothing back", () => {
  const result = midCycleAllowance({
    balance: 9_500_000,
    commitments: [commitment({ amount: 500_000, dueDay: 5 })],
    expenses: [todayPayment(500_000, "2026-09-01")],
  });

  assert.equal(result.reservedCommitments, 0);
  assert.equal(result.disposableBalance, 9_500_000);
  assertAllowanceMatchesDisposable(result);
});
