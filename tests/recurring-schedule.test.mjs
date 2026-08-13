import assert from "node:assert/strict";
import test from "node:test";

import {
  getEffectiveRecurringDueDay,
  getRecurringOccurrenceKey,
  shouldProcessRecurringCommitment,
} from "../src/lib/recurring-schedule.ts";

test("due day 31 falls on the last day of a short month", () => {
  assert.equal(getEffectiveRecurringDueDay(31, new Date(2027, 1, 27, 12)), 28);
  assert.equal(
    shouldProcessRecurringCommitment({
      dueDay: 31,
      isAutoDeduct: true,
      lastProcessed: null,
      now: new Date(2027, 1, 27, 12),
    }),
    false,
  );
  assert.equal(
    shouldProcessRecurringCommitment({
      dueDay: 31,
      isAutoDeduct: true,
      lastProcessed: null,
      now: new Date(2027, 1, 28, 12),
    }),
    true,
  );
});

test("due day 30 or 31 falls on February 29 in a leap year", () => {
  const leapDay = new Date(2028, 1, 29, 12);
  assert.equal(getEffectiveRecurringDueDay(30, leapDay), 29);
  assert.equal(getEffectiveRecurringDueDay(31, leapDay), 29);
});

test("a commitment already processed this month is not processed again", () => {
  assert.equal(
    shouldProcessRecurringCommitment({
      dueDay: 1,
      isAutoDeduct: true,
      lastProcessed: new Date(2027, 1, 2, 9).toISOString(),
      now: new Date(2027, 1, 28, 12),
    }),
    false,
  );
});

test("occurrence keys are stable within a month and change next month", () => {
  assert.equal(
    getRecurringOccurrenceKey("commitment-1", new Date(2027, 1, 1)),
    getRecurringOccurrenceKey("commitment-1", new Date(2027, 1, 28)),
  );
  assert.notEqual(
    getRecurringOccurrenceKey("commitment-1", new Date(2027, 1, 28)),
    getRecurringOccurrenceKey("commitment-1", new Date(2027, 2, 1)),
  );
});

test("invalid legacy due days are skipped without crashing the scan", () => {
  assert.equal(
    shouldProcessRecurringCommitment({
      dueDay: 0,
      isAutoDeduct: true,
      lastProcessed: null,
      now: new Date(2027, 1, 28, 12),
    }),
    false,
  );
});
