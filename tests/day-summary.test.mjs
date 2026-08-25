import assert from "node:assert/strict";
import test from "node:test";

import { summarizeDay } from "../src/lib/day-summary.ts";

const TODAY = "2026-08-25";

function entry(amount, transactionDate = TODAY) {
  return { amount, transactionDate };
}

test("money fronted and paid back on the same day nets to nothing", () => {
  // The whole point: both legs are real rows, but the day cost nothing.
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [entry(500_000)],
    incomes: [entry(500_000)],
  });

  assert.equal(summary.expenseTotal, 500_000);
  assert.equal(summary.incomeTotal, 500_000);
  assert.equal(summary.netOutflow, 0);
  assert.equal(summary.offsetTotal, 500_000);
});

test("a partial reimbursement leaves only the uncovered remainder", () => {
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [entry(500_000), entry(52_300)],
    incomes: [entry(300_000)],
  });

  assert.equal(summary.expenseTotal, 552_300);
  assert.equal(summary.netOutflow, 252_300);
  assert.equal(summary.offsetTotal, 300_000);
});

test("an ordinary spending day reports the same figure twice over", () => {
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [entry(9_000), entry(35_500)],
    incomes: [],
  });

  assert.equal(summary.expenseTotal, 44_500);
  assert.equal(summary.netOutflow, 44_500);
  assert.equal(summary.offsetTotal, 0);
});

test("income above spending reads as a net positive day", () => {
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [entry(200_000)],
    incomes: [entry(13_000_000)],
  });

  assert.equal(summary.netOutflow, -12_800_000);
  assert.equal(summary.offsetTotal, 200_000);
});

test("only rows recorded on that day are counted", () => {
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [entry(100_000, "2026-08-24"), entry(7_800), entry(50_000, "2026-08-26")],
    incomes: [entry(1_000_000, "2026-08-01")],
  });

  assert.equal(summary.expenseTotal, 7_800);
  assert.equal(summary.expenseCount, 1);
  assert.equal(summary.incomeTotal, 0);
  assert.equal(summary.incomeCount, 0);
});

test("rows without a date, or with unusable amounts, are skipped", () => {
  const summary = summarizeDay({
    dateKey: TODAY,
    expenses: [
      { amount: 10_000 },
      entry(0),
      entry(-5_000),
      entry(Number.NaN),
      entry(25_000),
    ],
    incomes: [],
  });

  assert.equal(summary.expenseTotal, 25_000);
  assert.equal(summary.expenseCount, 1);
});

test("an empty day is zero, not undefined", () => {
  const summary = summarizeDay({ dateKey: TODAY, expenses: [], incomes: [] });

  assert.deepEqual(summary, {
    expenseCount: 0,
    expenseTotal: 0,
    incomeCount: 0,
    incomeTotal: 0,
    netOutflow: 0,
    offsetTotal: 0,
  });
});
