export type CalendarMonthPeriod = {
  endExclusive: Date;
  key: string;
  label: string;
  monthIndex: number;
  start: Date;
  year: number;
};

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export function getCalendarMonthKey(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Calendar month date must be valid.");
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function getCalendarMonthPeriod(key: string): CalendarMonthPeriod | null {
  const match = MONTH_KEY_PATTERN.exec(key);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (year < 1900 || year > 9999) {
    return null;
  }
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);

  return {
    endExclusive,
    key,
    label: monthLabelFormatter.format(start),
    monthIndex,
    start,
    year,
  };
}

export function getRecentCalendarMonths(
  referenceDate: Date,
  count = 12,
): CalendarMonthPeriod[] {
  if (!Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error("Calendar month count must be an integer between 1 and 120.");
  }

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - offset,
      1,
    );
    const period = getCalendarMonthPeriod(getCalendarMonthKey(date));

    if (!period) {
      throw new Error("Failed to build calendar month period.");
    }

    return period;
  });
}

export function isTimestampInCalendarMonth(
  timestamp: number,
  period: Pick<CalendarMonthPeriod, "start" | "endExclusive">,
) {
  return (
    Number.isFinite(timestamp) &&
    timestamp >= period.start.getTime() &&
    timestamp < period.endExclusive.getTime()
  );
}
