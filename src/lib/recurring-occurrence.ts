import type { PayCycle } from "@/src/lib/pay-cycle";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type DateKeyParts = {
  day: number;
  monthIndex: number;
  year: number;
};

export type CycleOccurrence = {
  dueDateKey: string;
  recurringPeriod: string;
};

type CommitmentLike = {
  amount: number;
  dueDay: number;
  id: string;
};

type CommitmentExpenseLike = {
  amount: number;
  recurringCommitmentId?: string;
  recurringPeriod?: string;
};

export type CommitmentCycleStatus = {
  isPaid: boolean;
  occurrence: CycleOccurrence;
  outstanding: number;
  paidAmount: number;
};

export function parseDateKey(key: string): DateKeyParts | null {
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

export function formatDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The single occurrence of a commitment that falls inside the pay cycle
 * containing today, plus the period key that stamps its payment.
 *
 * The period is keyed to the month the bill is DUE, never the month it happens
 * to be paid in. Paying a 16th-of-the-month bill on the 30th, or paying a day
 * late across a month boundary, must still resolve to the same occurrence, or
 * the payment stops matching the reservation and the money gets held twice.
 */
export function getCycleOccurrence(
  dueDay: number,
  payCycle: PayCycle,
): CycleOccurrence | null {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return null;
  }

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

/**
 * How much of this cycle's occurrence is still owed.
 *
 * Reserving the planned amount rather than the amount actually paid made the
 * daily allowance drift whenever a real bill differed from its plan, so the
 * outstanding figure is measured against real payments.
 */
export function getCommitmentCycleStatus({
  commitment,
  expenses,
  payCycle,
}: {
  commitment: CommitmentLike;
  expenses: CommitmentExpenseLike[];
  payCycle: PayCycle;
}): CommitmentCycleStatus | null {
  const occurrence = getCycleOccurrence(commitment.dueDay, payCycle);
  if (!occurrence) return null;

  const paidAmount = expenses.reduce((total, expense) => {
    if (expense.recurringCommitmentId !== commitment.id) return total;
    if (expense.recurringPeriod !== occurrence.recurringPeriod) return total;
    if (!Number.isFinite(expense.amount)) return total;
    return total + expense.amount;
  }, 0);

  const outstanding = Math.max(0, commitment.amount - paidAmount);

  return {
    isPaid: outstanding === 0,
    occurrence,
    outstanding,
    paidAmount,
  };
}

/**
 * Whole days from today until the occurrence is due. Negative means it is
 * already past inside the current cycle.
 */
export function getDaysUntilDue(dueDateKey: string, todayKey: string) {
  const due = parseDateKey(dueDateKey);
  const today = parseDateKey(todayKey);
  if (!due || !today) return null;

  const dueTime = Date.UTC(due.year, due.monthIndex, due.day);
  const todayTime = Date.UTC(today.year, today.monthIndex, today.day);

  return Math.round((dueTime - todayTime) / MILLISECONDS_PER_DAY);
}
