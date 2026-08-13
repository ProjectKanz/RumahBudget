function assertValidDueDay(dueDay: number) {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Due day must be an integer between 1 and 31.");
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getEffectiveRecurringDueDay(dueDay: number, now: Date) {
  assertValidDueDay(dueDay);
  const lastDayOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  return Math.min(dueDay, lastDayOfMonth);
}

export function getLocalRecurringPeriod(now: Date) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

export function getRecurringOccurrenceKey(commitmentId: string, now: Date) {
  if (!commitmentId.trim()) {
    throw new Error("Commitment ID is required.");
  }

  return `${commitmentId}:${getLocalRecurringPeriod(now)}`;
}

export function isSameLocalMonth(
  timestamp: string | null | undefined,
  now: Date,
) {
  if (!timestamp) {
    return false;
  }

  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return false;
  }

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth()
  );
}

export function shouldProcessRecurringCommitment({
  dueDay,
  isAutoDeduct,
  lastProcessed,
  now,
}: {
  dueDay: number;
  isAutoDeduct: boolean;
  lastProcessed: string | null | undefined;
  now: Date;
}) {
  if (
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    !isAutoDeduct ||
    isSameLocalMonth(lastProcessed, now)
  ) {
    return false;
  }

  return now.getDate() >= getEffectiveRecurringDueDay(dueDay, now);
}
