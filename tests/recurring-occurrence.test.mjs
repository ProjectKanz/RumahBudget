import assert from "node:assert/strict";
import test from "node:test";

import {
  getCommitmentCycleStatus,
  getCycleOccurrence,
  getDaysUntilDue,
} from "../src/lib/recurring-occurrence.ts";
import { getPayCycle } from "../src/lib/pay-cycle.ts";

// 25 August 2026 WIB opens the cycle that closes on 24 September.
const cycle = getPayCycle(new Date("2026-08-25T05:00:00.000Z"));

function commitment(overrides = {}) {
  return { amount: 362_456, dueDay: 16, id: "commitment-a", ...overrides };
}

function payment(recurringPeriod, overrides = {}) {
  return {
    amount: 362_456,
    recurringCommitmentId: "commitment-a",
    recurringPeriod,
    ...overrides,
  };
}

test("a due day before the 25th resolves to next month inside the cycle", () => {
  assert.equal(cycle.cycleStartKey, "2026-08-25");
  assert.equal(cycle.cycleEndKey, "2026-09-24");

  assert.deepEqual(getCycleOccurrence(16, cycle), {
    dueDateKey: "2026-09-16",
    recurringPeriod: "2026-09-01",
  });
});

test("a due day on or after the 25th resolves to the month the cycle opens", () => {
  assert.deepEqual(getCycleOccurrence(28, cycle), {
    dueDateKey: "2026-08-28",
    recurringPeriod: "2026-08-01",
  });
});

test("a due day past the end of a short month clamps to its last day", () => {
  const februaryCycle = getPayCycle(new Date("2026-02-10T05:00:00.000Z"));

  assert.equal(februaryCycle.cycleStartKey, "2026-01-25");
  assert.equal(februaryCycle.cycleEndKey, "2026-02-24");
  assert.deepEqual(getCycleOccurrence(31, februaryCycle), {
    dueDateKey: "2026-01-31",
    recurringPeriod: "2026-01-01",
  });
});

test("an invalid due day resolves to nothing instead of guessing", () => {
  assert.equal(getCycleOccurrence(0, cycle), null);
  assert.equal(getCycleOccurrence(32, cycle), null);
  assert.equal(getCycleOccurrence(16.5, cycle), null);
});

test("the period does not move when the bill is paid early", () => {
  // Same cycle, same bill, glanced at on three different days.
  const days = [
    "2026-08-25T05:00:00.000Z",
    "2026-08-30T05:00:00.000Z",
    "2026-09-16T05:00:00.000Z",
  ];

  const periods = days.map(
    (day) => getCycleOccurrence(16, getPayCycle(new Date(day))).recurringPeriod,
  );

  assert.deepEqual(periods, ["2026-09-01", "2026-09-01", "2026-09-01"]);
});

test("an unpaid commitment reserves its full amount", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment(),
    expenses: [],
    payCycle: cycle,
  });

  assert.equal(status.isPaid, false);
  assert.equal(status.paidAmount, 0);
  assert.equal(status.outstanding, 362_456);
});

test("a payment stamped with this cycle's period clears the reservation", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment(),
    expenses: [payment("2026-09-01")],
    payCycle: cycle,
  });

  assert.equal(status.isPaid, true);
  assert.equal(status.outstanding, 0);
});

test("a payment stamped for another period does not clear this one", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment(),
    expenses: [payment("2026-08-01")],
    payCycle: cycle,
  });

  assert.equal(status.isPaid, false);
  assert.equal(status.outstanding, 362_456);
});

test("only the unpaid remainder is reserved after a partial payment", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment({ amount: 500_000 }),
    expenses: [payment("2026-09-01", { amount: 200_000 })],
    payCycle: cycle,
  });

  assert.equal(status.paidAmount, 200_000);
  assert.equal(status.outstanding, 300_000);
  assert.equal(status.isPaid, false);
});

test("paying more than planned never reserves a negative amount", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment({ amount: 500_000 }),
    expenses: [payment("2026-09-01", { amount: 650_000 })],
    payCycle: cycle,
  });

  assert.equal(status.outstanding, 0);
  assert.equal(status.isPaid, true);
});

test("payments belonging to another commitment are ignored", () => {
  const status = getCommitmentCycleStatus({
    commitment: commitment(),
    expenses: [
      payment("2026-09-01", { recurringCommitmentId: "commitment-b" }),
    ],
    payCycle: cycle,
  });

  assert.equal(status.paidAmount, 0);
  assert.equal(status.outstanding, 362_456);
});

test("days until due is measured against the cycle occurrence", () => {
  // A bill due on the 16th is three weeks away on the 25th, not overdue.
  assert.equal(getDaysUntilDue("2026-09-16", cycle.todayKey), 22);
  assert.equal(getDaysUntilDue("2026-08-25", cycle.todayKey), 0);
  assert.equal(getDaysUntilDue("2026-08-24", cycle.todayKey), -1);
  assert.equal(getDaysUntilDue("not-a-date", cycle.todayKey), null);
});
