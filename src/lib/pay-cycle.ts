const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
});

export type JakartaDateParts = {
  day: number;
  monthIndex: number;
  year: number;
};

export type PayCycle = {
  cycleEndKey: string;
  cycleStartKey: string;
  nextPaydayKey: string;
  remainingSpendableDays: number;
  todayKey: string;
};

function assertValidDate(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Pay-cycle date must be valid.");
  }
}

function toUtcDate(parts: JakartaDateParts) {
  return new Date(Date.UTC(parts.year, parts.monthIndex, parts.day));
}

function toDateParts(date: Date): JakartaDateParts {
  return {
    day: date.getUTCDate(),
    monthIndex: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

function formatDateKey(parts: JakartaDateParts) {
  const month = String(parts.monthIndex + 1).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function getJakartaDateParts(now: Date): JakartaDateParts {
  assertValidDate(now);

  const values = Object.fromEntries(
    jakartaDateFormatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    day: values.day,
    monthIndex: values.month - 1,
    year: values.year,
  };
}

export function getPayCycle(now: Date): PayCycle {
  const todayParts = getJakartaDateParts(now);
  const today = toUtcDate(todayParts);
  const cycleStart = new Date(
    Date.UTC(
      todayParts.year,
      todayParts.day >= 25 ? todayParts.monthIndex : todayParts.monthIndex - 1,
      25,
    ),
  );
  const cycleEnd = new Date(
    Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, 24),
  );
  const nextPayday = new Date(
    Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, 25),
  );
  const remainingSpendableDays =
    Math.floor((cycleEnd.getTime() - today.getTime()) / MILLISECONDS_PER_DAY) +
    1;

  return {
    cycleEndKey: formatDateKey(toDateParts(cycleEnd)),
    cycleStartKey: formatDateKey(toDateParts(cycleStart)),
    nextPaydayKey: formatDateKey(toDateParts(nextPayday)),
    remainingSpendableDays: Math.max(1, remainingSpendableDays),
    todayKey: formatDateKey(todayParts),
  };
}

export function getMillisecondsUntilNextJakartaDay(now: Date) {
  const todayParts = getJakartaDateParts(now);
  const nextMidnightUtc =
    Date.UTC(todayParts.year, todayParts.monthIndex, todayParts.day + 1) -
    JAKARTA_OFFSET_MILLISECONDS;

  return Math.max(1, nextMidnightUtc - now.getTime());
}
