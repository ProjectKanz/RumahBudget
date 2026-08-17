import assert from "node:assert/strict";
import test from "node:test";

import {
  getJakartaDateParts,
  getMillisecondsUntilNextJakartaDay,
  getPayCycle,
} from "../src/lib/pay-cycle.ts";

test("WIB midnight moves the financial date from the 24th to the 25th", () => {
  assert.deepEqual(
    getJakartaDateParts(new Date("2026-08-24T16:59:59.000Z")),
    { day: 24, monthIndex: 7, year: 2026 },
  );
  assert.deepEqual(
    getJakartaDateParts(new Date("2026-08-24T17:00:00.000Z")),
    { day: 25, monthIndex: 7, year: 2026 },
  );
});

test("the 24th is the final spendable day of the current pay cycle", () => {
  assert.deepEqual(getPayCycle(new Date("2026-08-24T05:00:00.000Z")), {
    cycleEndKey: "2026-08-24",
    cycleStartKey: "2026-07-25",
    nextPaydayKey: "2026-08-25",
    remainingSpendableDays: 1,
    todayKey: "2026-08-24",
  });
});

test("the 25th starts a new cycle and includes today in the denominator", () => {
  assert.deepEqual(getPayCycle(new Date("2026-08-25T05:00:00.000Z")), {
    cycleEndKey: "2026-09-24",
    cycleStartKey: "2026-08-25",
    nextPaydayKey: "2026-09-25",
    remainingSpendableDays: 31,
    todayKey: "2026-08-25",
  });
});

test("December pay cycles roll into the next year", () => {
  assert.deepEqual(getPayCycle(new Date("2026-12-25T05:00:00.000Z")), {
    cycleEndKey: "2027-01-24",
    cycleStartKey: "2026-12-25",
    nextPaydayKey: "2027-01-25",
    remainingSpendableDays: 31,
    todayKey: "2026-12-25",
  });
});

test("February 25 to March 24 has 28 days in a non-leap year", () => {
  assert.equal(
    getPayCycle(new Date("2025-02-25T05:00:00.000Z"))
      .remainingSpendableDays,
    28,
  );
});

test("February 25 to March 24 has 29 days in a leap year", () => {
  assert.equal(
    getPayCycle(new Date("2024-02-25T05:00:00.000Z"))
      .remainingSpendableDays,
    29,
  );
});

test("invalid dates fail closed", () => {
  assert.throws(
    () => getPayCycle(new Date("invalid")),
    /Pay-cycle date must be valid/,
  );
});

test("the refresh delay targets the next WIB midnight", () => {
  assert.equal(
    getMillisecondsUntilNextJakartaDay(
      new Date("2026-08-24T16:59:59.000Z"),
    ),
    1_000,
  );
  assert.equal(
    getMillisecondsUntilNextJakartaDay(
      new Date("2026-08-24T17:00:00.000Z"),
    ),
    24 * 60 * 60 * 1_000,
  );
});
