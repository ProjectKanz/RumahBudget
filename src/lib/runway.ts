/** Average length of a calendar month (365.25 / 12), used to convert daily burn to monthly. */
export const DAYS_PER_MONTH = 30.4375;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type BurnBasis = "observed-window" | "insufficient-data";

export type BurnProfile = {
  averageDailyBurn: number;
  averageMonthlyBurn: number;
  basis: BurnBasis;
  observedDays: number;
  totalObservedSpending: number;
  windowStart: number;
};

type FlowEntry = {
  amount: number;
  createdAt: number;
};

type FlowProfileInput = {
  entries: FlowEntry[];
  lookbackDays?: number;
  now?: Date;
};

type BurnProfileInput = {
  expenses: FlowEntry[];
  lookbackDays?: number;
  now?: Date;
};

function startOfLocalDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

/**
 * One burn rate for the whole cockpit, measured per day over the days that have
 * actually elapsed.
 *
 * Bucketing by calendar month is what made the old readings unreliable: a month
 * still in progress counted as a full month, so the average sank and every
 * runway built on it stretched. Measuring per elapsed day handles a partial
 * current month, a partial first month, and a mid-month glance identically.
 */
export function calculateFlowProfile({
  entries,
  lookbackDays = 90,
  now = new Date(),
}: FlowProfileInput): BurnProfile {
  if (
    !Number.isInteger(lookbackDays) ||
    lookbackDays < 1 ||
    lookbackDays > 3650
  ) {
    throw new Error("Lookback days must be an integer between 1 and 3650.");
  }

  if (!Number.isFinite(now.getTime())) {
    throw new Error("Burn profile reference date must be valid.");
  }

  const todayStart = startOfLocalDay(now);
  const nextDayStart = todayStart + MILLISECONDS_PER_DAY;
  const lookbackStart = todayStart - (lookbackDays - 1) * MILLISECONDS_PER_DAY;

  let earliestSpendDay: number | null = null;
  for (const expense of entries) {
    if (!Number.isFinite(expense.createdAt) || expense.createdAt <= 0) continue;
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) continue;
    // A future-dated row is a data-entry mistake, not spending that happened.
    if (expense.createdAt >= nextDayStart) continue;

    const spendDay = startOfLocalDay(new Date(expense.createdAt));
    earliestSpendDay =
      earliestSpendDay === null
        ? spendDay
        : Math.min(earliestSpendDay, spendDay);
  }

  if (earliestSpendDay === null) {
    return {
      averageDailyBurn: 0,
      averageMonthlyBurn: 0,
      basis: "insufficient-data",
      observedDays: 0,
      totalObservedSpending: 0,
      windowStart: todayStart,
    };
  }

  const windowStart = Math.max(earliestSpendDay, lookbackStart);
  const observedDays = Math.max(
    1,
    Math.round((todayStart - windowStart) / MILLISECONDS_PER_DAY) + 1,
  );

  let totalObservedSpending = 0;
  for (const expense of entries) {
    if (!Number.isFinite(expense.createdAt) || expense.createdAt <= 0) continue;
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) continue;
    if (expense.createdAt >= nextDayStart) continue;
    if (expense.createdAt < windowStart) continue;

    totalObservedSpending += expense.amount;
  }

  const averageDailyBurn = totalObservedSpending / observedDays;

  return {
    averageDailyBurn,
    averageMonthlyBurn: averageDailyBurn * DAYS_PER_MONTH,
    basis: "observed-window",
    observedDays,
    totalObservedSpending,
    windowStart,
  };
}

/**
 * Runway in months. Returns null when it cannot be known, so an empty ledger
 * reads as "not enough data" rather than an infinite reserve.
 */
export function calculateRunwayMonths(
  liquidBalance: number,
  averageMonthlyBurn: number,
): number | null {
  if (!Number.isFinite(averageMonthlyBurn) || averageMonthlyBurn <= 0) {
    return null;
  }

  if (!Number.isFinite(liquidBalance)) {
    return null;
  }

  return Math.max(0, liquidBalance) / averageMonthlyBurn;
}

/**
 * Runway in whole days, from the same burn rate the monthly reading uses, so the
 * two can never contradict each other on screen.
 */
export function calculateRunwayDays(
  liquidBalance: number,
  averageDailyBurn: number,
): number | null {
  if (!Number.isFinite(averageDailyBurn) || averageDailyBurn <= 0) {
    return null;
  }

  if (!Number.isFinite(liquidBalance)) {
    return null;
  }

  return Math.floor(Math.max(0, liquidBalance) / averageDailyBurn);
}

/**
 * Splits current balances into the cash that pays bills and the money parked in
 * broker accounts. A runway must not treat a trading balance as grocery money.
 */
export function splitBalancesByPurpose(
  accounts: Array<{
    id: string;
    initialBalance: number;
    isArchived: boolean;
    purpose: string;
  }>,
  accountBalances: Record<string, number>,
) {
  let householdBalance = 0;
  let tradingBalance = 0;

  for (const account of accounts) {
    if (account.isArchived) continue;

    const balance = accountBalances[account.id] ?? account.initialBalance;
    if (!Number.isFinite(balance)) continue;

    if (account.purpose === "trading") {
      tradingBalance += balance;
    } else {
      householdBalance += balance;
    }
  }

  return { householdBalance, tradingBalance };
}

/**
 * Spending rate. Income uses the same measurement through calculateFlowProfile,
 * so the two can be compared without mixing periods.
 */
export function calculateBurnProfile({
  expenses,
  lookbackDays = 90,
  now = new Date(),
}: BurnProfileInput): BurnProfile {
  return calculateFlowProfile({ entries: expenses, lookbackDays, now });
}
