const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const jakartaKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
});

const labelFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export type ReportType = "weekly" | "monthly";

export type ReportPeriod = {
  endKey: string;
  label: string;
  reportName: string;
  startKey: string;
  type: ReportType;
};

type PeriodEntry = {
  amount: number;
  transactionDate?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function keyToUtc(key: string) {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const time = Date.UTC(year, monthIndex, day);
  const date = new Date(time);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return time;
}

function utcToKey(time: number) {
  const date = new Date(time);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Every period boundary and every row is reduced to a Jakarta calendar day key
 * before comparison. The scheduled job used to bucket by server time while the
 * manual route used Jakarta, so the same transaction landed in different weeks.
 */
export function getJakartaDateKey(value: unknown): string {
  if (value === null || value === undefined) return "";

  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "";

  return jakartaKeyFormatter.format(date);
}

/**
 * Date key a ledger row belongs to: the date the user recorded, falling back to
 * when the row was written.
 */
export function getRowDateKey(row: {
  created_at?: unknown;
  transaction_date?: unknown;
}): string {
  if (typeof row.transaction_date === "string" && row.transaction_date) {
    return row.transaction_date;
  }

  return getJakartaDateKey(row.created_at);
}

function buildPeriod(
  type: ReportType,
  startKey: string,
  endKey: string,
): ReportPeriod {
  const startTime = keyToUtc(startKey);
  const endTime = keyToUtc(endKey);
  const reportName = type === "weekly" ? "Weekly Report" : "Monthly Report";

  return {
    endKey,
    label:
      startTime === null || endTime === null
        ? `${startKey} - ${endKey}`
        : `${labelFormatter.format(new Date(startTime))} - ${labelFormatter.format(new Date(endTime))}`,
    reportName,
    startKey,
    type,
  };
}

/**
 * Rebuilds a period from date keys that were computed elsewhere, so a report
 * being sent measures exactly the window its preview described.
 */
export function createPeriodFromKeys(
  type: ReportType,
  startKey: string,
  endKey: string,
): ReportPeriod | null {
  if (keyToUtc(startKey) === null || keyToUtc(endKey) === null) return null;
  if (startKey > endKey) return null;

  return buildPeriod(type, startKey, endKey);
}

/** Monday through Sunday of the week containing the reference day. */
export function getWeekPeriod(reference: Date): ReportPeriod {
  const todayKey = getJakartaDateKey(reference);
  const todayTime = keyToUtc(todayKey);
  if (todayTime === null) {
    throw new Error("Report period reference date must be valid.");
  }

  const weekday = new Date(todayTime).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const startTime = todayTime - daysFromMonday * MILLISECONDS_PER_DAY;

  return buildPeriod(
    "weekly",
    utcToKey(startTime),
    utcToKey(startTime + 6 * MILLISECONDS_PER_DAY),
  );
}

/** First through last day of the month containing the reference day. */
export function getMonthPeriod(reference: Date): ReportPeriod {
  const todayKey = getJakartaDateKey(reference);
  const todayTime = keyToUtc(todayKey);
  if (todayTime === null) {
    throw new Error("Report period reference date must be valid.");
  }

  const date = new Date(todayTime);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();

  return buildPeriod(
    "monthly",
    utcToKey(Date.UTC(year, monthIndex, 1)),
    utcToKey(Date.UTC(year, monthIndex + 1, 0)),
  );
}

/**
 * A weekly report always describes the week containing `now`. It used to be
 * derived from the first day of the month the user happened to be browsing, so
 * "this week" could resolve to a week that ended three weeks ago.
 */
export function getReportPeriod({
  monthReference,
  now,
  type,
}: {
  monthReference?: Date;
  now: Date;
  type: ReportType;
}): ReportPeriod {
  if (type === "weekly") {
    return getWeekPeriod(now);
  }

  return getMonthPeriod(monthReference ?? now);
}

export function isKeyInPeriod(dateKey: string, period: ReportPeriod) {
  return (
    Boolean(dateKey) &&
    dateKey >= period.startKey &&
    dateKey <= period.endKey
  );
}

function sortTotals(totals: Record<string, number>) {
  return Object.entries(totals).sort(
    ([, first], [, second]) => second - first,
  ) as [string, number][];
}

/**
 * Period totals for a report. Callers pass household income only; trading
 * results are reported separately so they never inflate recorded income.
 */
export function summarizeReportPeriod<
  Income extends PeriodEntry & { source?: string },
  Expense extends PeriodEntry & { category?: string },
>({
  expenses,
  incomes,
  period,
}: {
  expenses: Expense[];
  incomes: Income[];
  period: ReportPeriod;
}) {
  const periodIncomes = incomes.filter((income) =>
    isKeyInPeriod(income.transactionDate ?? "", period),
  );
  const periodExpenses = expenses.filter((expense) =>
    isKeyInPeriod(expense.transactionDate ?? "", period),
  );

  const totalIncome = periodIncomes.reduce(
    (total, income) => total + (Number(income.amount) || 0),
    0,
  );
  const totalExpense = periodExpenses.reduce(
    (total, expense) => total + (Number(expense.amount) || 0),
    0,
  );

  const categoryTotals: Record<string, number> = {};
  periodExpenses.forEach((expense) => {
    const category = expense.category || "Other";
    categoryTotals[category] =
      (categoryTotals[category] || 0) + (Number(expense.amount) || 0);
  });

  const sourceTotals: Record<string, number> = {};
  periodIncomes.forEach((income) => {
    const source = income.source || "Other Inflow";
    sourceTotals[source] =
      (sourceTotals[source] || 0) + (Number(income.amount) || 0);
  });

  return {
    netCashflow: totalIncome - totalExpense,
    periodExpenses,
    periodIncomes,
    sortedCategories: sortTotals(categoryTotals),
    sortedSources: sortTotals(sourceTotals),
    totalExpense,
    totalIncome,
  };
}
