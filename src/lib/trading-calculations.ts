import type { MoneyAccount } from "@/src/types/money-account";
import type { TradingResult } from "@/src/types/trading-result";
import type { Transfer } from "@/src/types/transfer";

export type TradingActivity = {
  id: string;
  sourceRecordId: string;
  type: "profit" | "loss" | "deposit" | "withdrawal";
  accountId: string;
  counterpartyAccountId?: string;
  amount: number;
  transactionDate: string;
  createdAt: number;
  note: string;
  isMigrated: boolean;
};

export type TradingSummary = {
  currentBalance: number;
  periodNetResult: number;
  periodDeposits: number;
  periodWithdrawals: number;
  activities: TradingActivity[];
};

type TradingSummaryInput = {
  accounts: MoneyAccount[];
  accountBalances: Record<string, number>;
  transfers: Transfer[];
  tradingResults: TradingResult[];
  periodReference: number;
};

type TradingDraftInput = {
  accountId: string;
  transactionDate: string;
  netAmount: number;
  accounts: MoneyAccount[];
  userId: string;
};

export type TradingDraftValidation =
  | {
      ok: true;
      value: {
        accountId: string;
        transactionDate: string;
        netAmount: number;
      };
    }
  | { ok: false; error: string };

function isSameLocalMonth(timestamp: number, referenceTimestamp: number) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(referenceTimestamp)) {
    return false;
  }

  const date = new Date(timestamp);
  const reference = new Date(referenceTimestamp);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
}

function isValidTransactionDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function calculateTradingSummary({
  accounts,
  accountBalances,
  transfers,
  tradingResults,
  periodReference,
}: TradingSummaryInput): TradingSummary {
  const activeAccounts = accounts.filter(
    (account) => account.purpose === "trading" && !account.isArchived,
  );
  const tradingAccountIds = new Set(activeAccounts.map((account) => account.id));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const validPeriodResults = tradingResults.filter((result) => {
    const account = accountById.get(result.accountId);
    return (
      Boolean(account) &&
      account?.purpose === "trading" &&
      !account.isArchived &&
      account.userId === result.userId &&
      Number.isFinite(result.netAmount) &&
      result.netAmount !== 0 &&
      isSameLocalMonth(result.createdAt, periodReference)
    );
  });

  const resultActivities: TradingActivity[] = validPeriodResults.map((result) => ({
    id: `result-${result.id}`,
    sourceRecordId: result.id,
    type: result.netAmount > 0 ? "profit" : "loss",
    accountId: result.accountId,
    amount: Math.abs(result.netAmount),
    transactionDate: result.transactionDate,
    createdAt: result.createdAt,
    note: result.note,
    isMigrated: Boolean(result.sourceIncomeId),
  }));

  const transferActivities = transfers.flatMap<TradingActivity>((transfer) => {
    if (!isSameLocalMonth(transfer.createdAt, periodReference)) {
      return [];
    }

    const fromTrading = tradingAccountIds.has(transfer.fromAccountId);
    const toTrading = tradingAccountIds.has(transfer.toAccountId);
    if (fromTrading === toTrading) {
      return [];
    }

    return [
      {
        id: `transfer-${transfer.id}`,
        sourceRecordId: transfer.id,
        type: toTrading ? "deposit" : "withdrawal",
        accountId: toTrading ? transfer.toAccountId : transfer.fromAccountId,
        counterpartyAccountId: toTrading
          ? transfer.fromAccountId
          : transfer.toAccountId,
        amount: transfer.amount,
        transactionDate: transfer.transactionDate ?? "",
        createdAt: transfer.createdAt,
        note: transfer.note,
        isMigrated: false,
      },
    ];
  });

  return {
    currentBalance: activeAccounts.reduce(
      (total, account) =>
        total + (accountBalances[account.id] ?? account.initialBalance),
      0,
    ),
    periodNetResult: validPeriodResults.reduce(
      (total, result) => total + result.netAmount,
      0,
    ),
    periodDeposits: transferActivities
      .filter((activity) => activity.type === "deposit")
      .reduce((total, activity) => total + activity.amount, 0),
    periodWithdrawals: transferActivities
      .filter((activity) => activity.type === "withdrawal")
      .reduce((total, activity) => total + activity.amount, 0),
    activities: [...resultActivities, ...transferActivities].sort(
      (first, second) => second.createdAt - first.createdAt,
    ),
  };
}

export function validateTradingResultDraft({
  accountId,
  transactionDate,
  netAmount,
  accounts,
  userId,
}: TradingDraftInput): TradingDraftValidation {
  if (!Number.isFinite(netAmount) || netAmount === 0) {
    return { ok: false, error: "Hasil sesi harus berupa angka selain nol." };
  }

  if (!isValidTransactionDate(transactionDate)) {
    return { ok: false, error: "Tanggal sesi tidak valid." };
  }

  const account = accounts.find((candidate) => candidate.id === accountId);
  if (
    !account ||
    account.userId !== userId ||
    account.isArchived ||
    account.purpose !== "trading"
  ) {
    return { ok: false, error: "Pilih akun trading aktif milik Anda." };
  }

  return {
    ok: true,
    value: { accountId, transactionDate, netAmount },
  };
}
