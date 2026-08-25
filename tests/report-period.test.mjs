import assert from "node:assert/strict";
import test from "node:test";

import {
  createPeriodFromKeys,
  getJakartaDateKey,
  getMonthPeriod,
  getReportPeriod,
  getRowDateKey,
  getWeekPeriod,
  summarizeReportPeriod,
} from "../src/lib/report-period.ts";
import {
  mapExpenseRows,
  mapIncomeRows,
  mapTradingResultRows,
} from "../src/lib/ledger-rows.ts";
import { getHouseholdIncomes } from "../src/lib/finance-calculations.ts";

// 25 August 2026, 12:00 WIB.
const NOW = new Date("2026-08-25T05:00:00.000Z");

test("a weekly report follows today, not the month being browsed", () => {
  const period = getReportPeriod({
    monthReference: new Date("2026-08-01T05:00:00.000Z"),
    now: NOW,
    type: "weekly",
  });

  // The old build derived the week from the 1st of the selected month and
  // reported 27 July - 2 August while the user was standing in the 25th.
  assert.equal(period.startKey, "2026-08-24");
  assert.equal(period.endKey, "2026-08-30");
  assert.equal(period.label, "August 24, 2026 - August 30, 2026");
});

test("weeks run Monday through Sunday", () => {
  const sunday = getWeekPeriod(new Date("2026-08-30T05:00:00.000Z"));
  assert.equal(sunday.startKey, "2026-08-24");
  assert.equal(sunday.endKey, "2026-08-30");

  const monday = getWeekPeriod(new Date("2026-08-31T05:00:00.000Z"));
  assert.equal(monday.startKey, "2026-08-31");
  assert.equal(monday.endKey, "2026-09-06");
});

test("a monthly report covers the month that was selected", () => {
  const period = getReportPeriod({
    monthReference: new Date("2026-07-01T05:00:00.000Z"),
    now: NOW,
    type: "monthly",
  });

  assert.equal(period.startKey, "2026-07-01");
  assert.equal(period.endKey, "2026-07-31");
  assert.equal(period.reportName, "Monthly Report");
});

test("February length is respected", () => {
  assert.equal(
    getMonthPeriod(new Date("2028-02-10T05:00:00.000Z")).endKey,
    "2028-02-29",
  );
  assert.equal(
    getMonthPeriod(new Date("2026-02-10T05:00:00.000Z")).endKey,
    "2026-02-28",
  );
});

test("days are bucketed in Jakarta, not in server time", () => {
  // Still 24 August in UTC, already 25 August in Jakarta.
  assert.equal(getJakartaDateKey("2026-08-24T17:30:00.000Z"), "2026-08-25");
  assert.equal(getJakartaDateKey("2026-08-24T16:59:00.000Z"), "2026-08-24");
  assert.equal(getJakartaDateKey(null), "");
  assert.equal(getJakartaDateKey("not a date"), "");
});

test("a row is dated by transaction_date, falling back to created_at", () => {
  assert.equal(
    getRowDateKey({ transaction_date: "2026-08-03", created_at: "2026-08-25T05:00:00.000Z" }),
    "2026-08-03",
  );
  assert.equal(
    getRowDateKey({ created_at: "2026-08-24T17:30:00.000Z" }),
    "2026-08-25",
  );
});

test("period totals follow the recorded date, not the row's write time", () => {
  const period = getWeekPeriod(NOW);
  // Recorded today, but backdated to a day outside this week.
  const expenses = mapExpenseRows(
    [
      { id: "a", amount: 100_000, category: "Food", transaction_date: "2026-08-26" },
      { id: "b", amount: 250_000, category: "Food", transaction_date: "2026-08-03" },
    ],
    "user-a",
  );

  const summary = summarizeReportPeriod({ expenses, incomes: [], period });

  assert.equal(summary.totalExpense, 100_000);
  assert.equal(summary.periodExpenses.length, 1);
});

test("income migrated into the Trading ledger is not counted as income", () => {
  const period = getMonthPeriod(NOW);
  const incomeRows = [
    { id: "salary", amount: 13_000_000, source: "Salary", transaction_date: "2026-08-25" },
    { id: "tp", amount: 1_400_000, source: "Trading", transaction_date: "2026-08-11" },
  ];
  const tradingRows = [
    {
      id: "result-a",
      account_id: "broker",
      net_amount: 1_400_000,
      source_income_id: "tp",
      transaction_date: "2026-08-11",
    },
  ];

  const incomes = mapIncomeRows(incomeRows, "user-a");
  const tradingResults = mapTradingResultRows(tradingRows, "user-a");

  const raw = summarizeReportPeriod({ expenses: [], incomes, period });
  const household = summarizeReportPeriod({
    expenses: [],
    incomes: getHouseholdIncomes(incomes, tradingResults),
    period,
  });

  assert.equal(raw.totalIncome, 14_400_000);
  assert.equal(household.totalIncome, 13_000_000);
});

test("a period rebuilt from keys matches the one that produced them", () => {
  const period = getWeekPeriod(NOW);
  const rebuilt = createPeriodFromKeys("weekly", period.startKey, period.endKey);

  assert.deepEqual(rebuilt, period);
});

test("an invalid or reversed range is rejected rather than guessed", () => {
  assert.equal(createPeriodFromKeys("weekly", "2026-13-01", "2026-13-07"), null);
  assert.equal(createPeriodFromKeys("weekly", "2026-08-30", "2026-08-24"), null);
  assert.equal(createPeriodFromKeys("monthly", "", ""), null);
});
