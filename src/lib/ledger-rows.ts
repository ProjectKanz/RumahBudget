import { getRowDateKey } from "./report-period.ts";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount, MoneyAccountType } from "@/src/types/money-account";
import type { TradingResult } from "@/src/types/trading-result";
import type { Transfer } from "@/src/types/transfer";

/**
 * Maps raw Supabase rows into the domain shapes the calculation libs expect.
 *
 * The server used to recompute balances inline with its own reduced rules, which
 * is how the emailed totals drifted away from the dashboard. Mapping first lets
 * the routes call calculateFinanceSnapshot instead of reimplementing it.
 */
export type LedgerRow = Record<string, unknown>;

const ACCOUNT_TYPES: MoneyAccountType[] = [
  "Bank",
  "E-Wallet",
  "Cash",
  "Investment",
  "Other",
];

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function amount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Noon avoids a date-only value sliding into the neighbouring day. */
function dateKeyToTimestamp(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return 0;

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
}

export function mapAccountRows(rows: LedgerRow[], userId: string): MoneyAccount[] {
  return rows.map((row) => {
    const accountType = text(row.account_type) as MoneyAccountType;

    return {
      accountType: ACCOUNT_TYPES.includes(accountType) ? accountType : "Other",
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
      id: text(row.id),
      initialBalance: amount(row.initial_balance),
      isArchived: Boolean(row.is_archived),
      name: text(row.name, "Untitled account"),
      purpose: row.account_purpose === "trading" ? "trading" : "general",
      userId: text(row.user_id, userId),
    };
  });
}

export function mapIncomeRows(rows: LedgerRow[], userId: string): Income[] {
  return rows.map((row) => {
    const transactionDate = getRowDateKey(row);

    return {
      accountId: text(row.account_id),
      affectsDailyAllowance: row.affects_daily_allowance !== false,
      amount: amount(row.amount),
      createdAt: dateKeyToTimestamp(transactionDate),
      id: text(row.id),
      note: text(row.note),
      owner: text(row.owner),
      source: text(row.source),
      transactionDate,
      userId: text(row.user_id, userId),
    };
  });
}

export function mapExpenseRows(rows: LedgerRow[], userId: string): Expense[] {
  return rows.map((row) => {
    const transactionDate = getRowDateKey(row);

    return {
      accountId: text(row.account_id),
      affectsDailyAllowance: row.affects_daily_allowance !== false,
      amount: amount(row.amount),
      category: text(row.category, "Other"),
      createdAt: dateKeyToTimestamp(transactionDate),
      description: text(row.description),
      id: text(row.id),
      note: text(row.note),
      owner: text(row.owner),
      paymentMethod: text(row.payment_method),
      recurringCommitmentId: text(row.recurring_commitment_id) || undefined,
      recurringPeriod: text(row.recurring_period) || undefined,
      transactionDate,
      userId: text(row.user_id, userId),
    };
  });
}

export function mapTransferRows(rows: LedgerRow[], userId: string): Transfer[] {
  return rows.map((row) => {
    const transactionDate = getRowDateKey(row);

    return {
      affectsDailyAllowance: row.affects_daily_allowance !== false,
      amount: amount(row.amount),
      createdAt: dateKeyToTimestamp(transactionDate),
      fromAccountId: text(row.from_account_id),
      id: text(row.id),
      note: text(row.note),
      toAccountId: text(row.to_account_id),
      transactionDate,
      userId: text(row.user_id, userId),
    };
  });
}

export function mapTradingResultRows(
  rows: LedgerRow[],
  userId: string,
): TradingResult[] {
  return rows.map((row) => {
    const transactionDate = getRowDateKey(row);

    return {
      accountId: text(row.account_id),
      createdAt: dateKeyToTimestamp(transactionDate),
      id: text(row.id),
      netAmount: amount(row.net_amount),
      note: text(row.note),
      sourceIncomeId: text(row.source_income_id) || undefined,
      transactionDate,
      userId: text(row.user_id, userId),
    };
  });
}
