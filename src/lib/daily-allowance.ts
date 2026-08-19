import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import type { RecurringCommitment } from "@/src/types/recurring-commitment";
import type { PayCycle } from "@/src/lib/pay-cycle";
import type { Transfer } from "@/src/types/transfer";

type DailyAllowanceInput = {
  accountBalances: Record<string, number>;
  accounts: MoneyAccount[];
  commitments: RecurringCommitment[];
  expenses: Expense[];
  incomes: Income[];
  livingAccountIds: string[];
  payCycle: PayCycle;
  transfers: Transfer[];
};

type DailyAllowanceValues = {
  dailyAllowance: number;
  disposableBalance: number;
  livingBalance: number;
  overspentToday: number;
  remainingSpendableDays: number;
  remainingToday: number;
  reservedCommitments: number;
  selectedAccountCount: number;
  spentToday: number;
};

export type DailyAllowanceResult =
  | ({ status: "ready" | "no-disposable-balance" } & DailyAllowanceValues)
  | { reason: string; status: "review-required" | "setup-required" };

type DateKeyParts = {
  day: number;
  monthIndex: number;
  year: number;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(key: string): DateKeyParts | null {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, monthIndex, year };
}

function formatDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getOccurrenceForCycle(
  dueDay: number,
  payCycle: PayCycle,
): { dueDateKey: string; recurringPeriod: string } | null {
  const start = parseDateKey(payCycle.cycleStartKey);
  const end = parseDateKey(payCycle.cycleEndKey);
  if (!start || !end) return null;

  for (let offset = 0; offset <= 1; offset += 1) {
    const month = new Date(Date.UTC(start.year, start.monthIndex + offset, 1));
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const effectiveDay = Math.min(dueDay, lastDay);
    const dueDateKey = formatDateKey(year, monthIndex, effectiveDay);

    if (
      dueDateKey >= payCycle.cycleStartKey &&
      dueDateKey <= payCycle.cycleEndKey
    ) {
      return {
        dueDateKey,
        recurringPeriod: formatDateKey(year, monthIndex, 1),
      };
    }
  }

  return null;
}

function reviewRequired(reason: string): DailyAllowanceResult {
  return { reason, status: "review-required" };
}

export function calculateDailyAllowance({
  accountBalances,
  accounts,
  commitments,
  expenses,
  incomes,
  livingAccountIds,
  payCycle,
  transfers,
}: DailyAllowanceInput): DailyAllowanceResult {
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const livingIdSet = new Set(livingAccountIds);
  const selectedAccounts = activeAccounts.filter((account) =>
    livingIdSet.has(account.id),
  );

  if (selectedAccounts.length === 0) {
    return {
      reason: "Pilih akun kebutuhan hidup untuk menghitung batas harian.",
      status: "setup-required",
    };
  }

  let livingBalance = 0;
  for (const account of selectedAccounts) {
    const balance = accountBalances[account.id];
    if (!Number.isFinite(balance)) {
      return reviewRequired(`Saldo akun ${account.name} perlu ditinjau.`);
    }
    livingBalance += balance;
  }

  const oldestActiveAccount = [...activeAccounts].sort(
    (left, right) => left.createdAt - right.createdAt,
  )[0];
  let reservedCommitments = 0;
  let commitmentsPaidToday = 0;

  for (const currentCommitment of commitments) {
    if (
      !Number.isInteger(currentCommitment.dueDay) ||
      currentCommitment.dueDay < 1 ||
      currentCommitment.dueDay > 31 ||
      !Number.isFinite(currentCommitment.amount) ||
      currentCommitment.amount <= 0
    ) {
      return reviewRequired(
        `Data komitmen ${currentCommitment.name} perlu ditinjau.`,
      );
    }

    const occurrence = getOccurrenceForCycle(
      currentCommitment.dueDay,
      payCycle,
    );
    if (!occurrence) {
      return reviewRequired(
        `Tanggal komitmen ${currentCommitment.name} perlu ditinjau.`,
      );
    }

    const effectiveAccount = currentCommitment.accountId
      ? activeAccounts.find(
          (account) => account.id === currentCommitment.accountId,
        )
      : oldestActiveAccount;

    if (!effectiveAccount) {
      return reviewRequired(
        `Akun pembayaran untuk komitmen ${currentCommitment.name} perlu ditinjau.`,
      );
    }

    if (!livingIdSet.has(effectiveAccount.id)) {
      continue;
    }

    const relatedExpenses = expenses.filter(
      (expense) =>
        expense.recurringCommitmentId === currentCommitment.id,
    );
    if (relatedExpenses.some((expense) => !expense.recurringPeriod)) {
      return reviewRequired(
        `Riwayat pembayaran ${currentCommitment.name} perlu ditinjau.`,
      );
    }

    const isPaid = relatedExpenses.some(
      (expense) => expense.recurringPeriod === occurrence.recurringPeriod,
    );
    if (!isPaid) {
      reservedCommitments += currentCommitment.amount;
    } else if (
      relatedExpenses.some(
        (expense) =>
          expense.recurringPeriod === occurrence.recurringPeriod &&
          expense.transactionDate === payCycle.todayKey,
      )
    ) {
      commitmentsPaidToday += currentCommitment.amount;
    }
  }

  const disposableBalance = Math.max(0, livingBalance - reservedCommitments);
  const remainingSpendableDays = Math.max(
    1,
    payCycle.remainingSpendableDays,
  );
  const todayExpenses = expenses.filter(
    (expense) =>
      livingIdSet.has(expense.accountId) &&
      expense.transactionDate === payCycle.todayKey,
  );
  const todayIncomes = incomes.filter(
    (income) =>
      livingIdSet.has(income.accountId) &&
      income.transactionDate === payCycle.todayKey,
  );
  const todayTransfers = transfers.filter(
    (transfer) => transfer.transactionDate === payCycle.todayKey,
  );
  const todayExpenseTotal = todayExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const todayIncomeTotal = todayIncomes.reduce(
    (total, income) => total + income.amount,
    0,
  );
  const getLivingTransferDelta = (transfer: Transfer) =>
    (livingIdSet.has(transfer.toAccountId) ? transfer.amount : 0) -
    (livingIdSet.has(transfer.fromAccountId) ? transfer.amount : 0);
  const todayTransferNet = todayTransfers.reduce(
    (total, transfer) => total + getLivingTransferDelta(transfer),
    0,
  );
  const dayStartLivingBalance =
    livingBalance + todayExpenseTotal - todayIncomeTotal - todayTransferNet;
  const includedIncomeTotal = todayIncomes.reduce(
    (total, income) =>
      total + (income.affectsDailyAllowance === false ? 0 : income.amount),
    0,
  );
  const includedTransferNet = todayTransfers.reduce(
    (total, transfer) =>
      total +
      (transfer.affectsDailyAllowance === false
        ? 0
        : getLivingTransferDelta(transfer)),
    0,
  );
  const spendableAtStartOfToday = Math.max(
    0,
    dayStartLivingBalance +
      includedIncomeTotal +
      includedTransferNet -
      reservedCommitments -
      commitmentsPaidToday,
  );
  const dailyAllowance =
    Math.floor(spendableAtStartOfToday / remainingSpendableDays / 1_000) *
    1_000;
  const spentToday = todayExpenses.reduce(
    (total, expense) =>
      total +
      (expense.affectsDailyAllowance === false || expense.recurringCommitmentId
        ? 0
        : expense.amount),
    0,
  );
  const overspentToday = Math.max(0, spentToday - dailyAllowance);
  const remainingToday = Math.min(
    disposableBalance,
    Math.max(0, dailyAllowance - spentToday),
  );
  const values = {
    dailyAllowance,
    disposableBalance,
    livingBalance,
    overspentToday,
    remainingSpendableDays,
    remainingToday,
    reservedCommitments,
    selectedAccountCount: selectedAccounts.length,
    spentToday,
  };

  return {
    ...values,
    status: disposableBalance === 0 ? "no-disposable-balance" : "ready",
  };
}
