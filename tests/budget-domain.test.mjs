import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  normalizeExpenseCategory,
  resolveExpenseCategory,
} from "../src/lib/expense-options.ts";
import {
  calculateLifeEnergyHours,
  calculateNetHourlyWage,
  validateNetHourlyWage,
} from "../src/lib/life-energy.ts";
import {
  getCalendarMonthKey,
  getCalendarMonthPeriod,
  getRecentCalendarMonths,
  isTimestampInCalendarMonth,
} from "../src/lib/calendar-period.ts";

test("expanded categories and payment methods preserve existing values", () => {
  assert.deepEqual(EXPENSE_CATEGORIES.slice(0, 5), [
    "Groceries",
    "Dining Out",
    "Transportation",
    "Housing",
    "Bills",
  ]);
  assert.equal(EXPENSE_CATEGORIES.includes("Other"), true);
  assert.equal(PAYMENT_METHODS.includes("Cash"), true);
  assert.equal(PAYMENT_METHODS.includes("Debit Card"), true);
  assert.equal(PAYMENT_METHODS.includes("E-Wallet"), true);
  assert.equal(PAYMENT_METHODS.includes("QRIS"), true);
});

test("category normalization accepts canonical labels and common Indonesian aliases", () => {
  assert.equal(resolveExpenseCategory("Dining Out"), "Dining Out");
  assert.equal(resolveExpenseCategory("bensin"), "Transportation");
  assert.equal(resolveExpenseCategory("cicilan"), "Debt & Installments");
  assert.equal(resolveExpenseCategory("unknown-category"), null);
  assert.equal(normalizeExpenseCategory("unknown-category"), "Other");
});

test("Life Energy helpers reject empty, non-finite, zero, and negative values", () => {
  assert.equal(validateNetHourlyWage(50_000).ok, true);
  assert.equal(validateNetHourlyWage("").ok, false);
  assert.equal(validateNetHourlyWage(Number.POSITIVE_INFINITY).ok, false);
  assert.equal(validateNetHourlyWage(0).ok, false);
  assert.equal(validateNetHourlyWage(-1).ok, false);
  assert.equal(calculateLifeEnergyHours(100_000, 0), null);
  assert.equal(calculateNetHourlyWage(1, 3).ok, false);
});

test("Life Energy calculator returns safe wage and expense-hour results", () => {
  assert.deepEqual(calculateNetHourlyWage(8_000_000, 160), {
    ok: true,
    value: 50_000,
  });
  assert.equal(calculateLifeEnergyHours(125_000, 50_000), 2.5);
});

test("historical calendar period uses local half-open month boundaries", () => {
  const period = getCalendarMonthPeriod("2026-02");
  assert.ok(period);
  assert.equal(period.start.getFullYear(), 2026);
  assert.equal(period.start.getMonth(), 1);
  assert.equal(period.start.getDate(), 1);
  assert.equal(period.endExclusive.getFullYear(), 2026);
  assert.equal(period.endExclusive.getMonth(), 2);
  assert.equal(period.endExclusive.getDate(), 1);
  assert.equal(isTimestampInCalendarMonth(period.start.getTime(), period), true);
  assert.equal(isTimestampInCalendarMonth(period.endExclusive.getTime() - 1, period), true);
  assert.equal(isTimestampInCalendarMonth(period.endExclusive.getTime(), period), false);
});

test("historical month options roll backward across calendar years", () => {
  const reference = new Date(2026, 0, 15, 12);
  const periods = getRecentCalendarMonths(reference, 3);

  assert.equal(getCalendarMonthKey(reference), "2026-01");
  assert.deepEqual(periods.map((period) => period.key), [
    "2026-01",
    "2025-12",
    "2025-11",
  ]);
  assert.equal(getCalendarMonthPeriod("2026-13"), null);
  assert.equal(getCalendarMonthPeriod("0000-01"), null);
  assert.throws(() => getRecentCalendarMonths(reference, 0));
  assert.throws(() => getCalendarMonthKey(new Date(Number.NaN)));
});
