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
    livingAccountIds: ["bca"],
    payCycle,
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
    remainingSpendableDays: 30,
    reservedCommitments: 0,
    selectedAccountCount: 1,
    status: "ready",
  });
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
    remainingSpendableDays: 30,
    reservedCommitments: 500_000,
    selectedAccountCount: 1,
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
      remainingSpendableDays: 30,
      reservedCommitments: 2_500_000,
      selectedAccountCount: 1,
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
