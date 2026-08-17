import assert from "node:assert/strict";
import test from "node:test";

import { calculateFinanceSnapshot } from "../src/lib/finance-calculations.ts";

const januaryReference = new Date(2027, 0, 15, 12).getTime();
const januaryTimestamp = new Date(2027, 0, 10, 9).getTime();

function account(id, initialBalance) {
  return {
    id,
    userId: "user-1",
    name: id,
    accountType: "Bank",
    purpose: id === "trading" ? "trading" : "general",
    initialBalance,
    isArchived: false,
    createdAt: januaryTimestamp,
  };
}

function tradingResult(
  id,
  accountId,
  netAmount,
  createdAt = januaryTimestamp,
  sourceIncomeId,
) {
  return {
    id,
    userId: "user-1",
    accountId,
    transactionDate: "2027-01-10",
    netAmount,
    note: "",
    sourceIncomeId,
    createdAt,
  };
}

function income(id, accountId, amount, createdAt = januaryTimestamp) {
  return {
    id,
    owner: "owner",
    userId: "user-1",
    accountId,
    createdAt,
    amount,
    source: "Test income",
    note: "",
  };
}

function expense(id, accountId, amount, createdAt = januaryTimestamp) {
  return {
    id,
    owner: "owner",
    userId: "user-1",
    accountId,
    createdAt,
    amount,
    category: "Test expense",
    paymentMethod: "Cash",
    note: "",
  };
}

function transfer(id, fromAccountId, toAccountId, amount) {
  return {
    id,
    userId: "user-1",
    fromAccountId,
    toAccountId,
    amount,
    note: "",
    createdAt: januaryTimestamp,
  };
}

function snapshot({ accounts, incomes = [], expenses = [], transfers = [], tradingResults = [], now = januaryReference, periodReference }) {
  return calculateFinanceSnapshot({ accounts, incomes, expenses, transfers, tradingResults, now, periodReference });
}

test("initial balance increases total balance without becoming monthly income", () => {
  const result = snapshot({ accounts: [account("bank", 100_000)] });

  assert.deepEqual(result.accountBalances, { bank: 100_000 });
  assert.equal(result.totalBalance, 100_000);
  assert.equal(result.monthlyIncome, 0);
  assert.equal(result.monthlyExpense, 0);
  assert.equal(result.netCashflow, 0);
});

test("income increases its account balance and current-month income", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [income("income-1", "bank", 25_000)],
  });

  assert.equal(result.accountBalances.bank, 125_000);
  assert.equal(result.totalBalance, 125_000);
  assert.equal(result.monthlyIncome, 25_000);
  assert.equal(result.netCashflow, 25_000);
});

test("expense reduces its account balance and increases current-month expense", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    expenses: [expense("expense-1", "bank", 12_000)],
  });

  assert.equal(result.accountBalances.bank, 88_000);
  assert.equal(result.totalBalance, 88_000);
  assert.equal(result.monthlyExpense, 12_000);
  assert.equal(result.netCashflow, -12_000);
});

test("transfer moves balance between accounts without changing totals or cashflow", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000), account("cash", 50_000)],
    transfers: [transfer("transfer-1", "bank", "cash", 20_000)],
  });

  assert.deepEqual(result.accountBalances, { bank: 80_000, cash: 70_000 });
  assert.equal(result.totalBalance, 150_000);
  assert.equal(result.monthlyIncome, 0);
  assert.equal(result.monthlyExpense, 0);
  assert.equal(result.netCashflow, 0);
});

test("editing a transaction replaces the old amount on recalculation", () => {
  const original = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [income("income-1", "bank", 10_000)],
  });
  const edited = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [income("income-1", "bank", 25_000)],
  });

  assert.equal(original.totalBalance, 110_000);
  assert.equal(edited.totalBalance, 125_000);
  assert.equal(edited.monthlyIncome, 25_000);
});

test("deleting a transaction removes its effect on recalculation", () => {
  const beforeDelete = snapshot({
    accounts: [account("bank", 100_000)],
    expenses: [expense("expense-1", "bank", 12_000)],
  });
  const afterDelete = snapshot({ accounts: [account("bank", 100_000)] });

  assert.equal(beforeDelete.totalBalance, 88_000);
  assert.equal(afterDelete.totalBalance, 100_000);
  assert.equal(afterDelete.monthlyExpense, 0);
});

test("previous-month transactions affect account balance but not current-month cashflow", () => {
  const decemberTimestamp = new Date(2026, 11, 31, 23, 59).getTime();
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [income("old-income", "bank", 5_000, decemberTimestamp)],
  });

  assert.equal(result.totalBalance, 105_000);
  assert.equal(result.monthlyIncome, 0);
  assert.equal(result.netCashflow, 0);
});

test("December-to-January rollover follows the device local calendar", () => {
  const decemberTimestamp = new Date(2026, 11, 31, 23, 59).getTime();
  const januaryStartTimestamp = new Date(2027, 0, 1, 0, 1).getTime();
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [
      income("december-income", "bank", 1_000, decemberTimestamp),
      income("january-income", "bank", 2_500, januaryStartTimestamp),
    ],
    now: new Date(2027, 0, 1, 12).getTime(),
  });

  assert.equal(result.totalBalance, 103_500);
  assert.equal(result.monthlyIncome, 2_500);
  assert.deepEqual(result.monthlyIncomes.map((item) => item.id), ["january-income"]);
});

test("income and expenses linked to unknown accounts do not change known balances", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [income("unknown-income", "missing", 9_000)],
    expenses: [expense("unknown-expense", "missing", 4_000)],
  });

  assert.deepEqual(result.accountBalances, { bank: 100_000 });
  assert.equal(result.totalBalance, 100_000);
  assert.equal(result.monthlyIncome, 9_000);
  assert.equal(result.monthlyExpense, 4_000);
  assert.equal(result.netCashflow, 5_000);
});

test("historical period changes cashflow selection without changing current balances", () => {
  const decemberTimestamp = new Date(2026, 11, 15, 12).getTime();
  const result = snapshot({
    accounts: [account("bank", 100_000)],
    incomes: [
      income("december-income", "bank", 4_000, decemberTimestamp),
      income("january-income", "bank", 6_000, januaryTimestamp),
    ],
    periodReference: decemberTimestamp,
  });

  assert.equal(result.totalBalance, 110_000);
  assert.equal(result.monthlyIncome, 4_000);
  assert.deepEqual(result.monthlyIncomes.map((item) => item.id), ["december-income"]);
});

test("signed Trading P/L changes only the trading balance and total balance", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000), account("trading", 50_000)],
    tradingResults: [
      tradingResult("profit", "trading", 12_000),
      tradingResult("loss", "trading", -5_000),
    ],
  });

  assert.deepEqual(result.accountBalances, {
    bank: 100_000,
    trading: 57_000,
  });
  assert.equal(result.totalBalance, 157_000);
  assert.equal(result.monthlyTradingNet, 7_000);
  assert.equal(result.monthlyIncome, 0);
  assert.equal(result.monthlyExpense, 0);
  assert.equal(result.netCashflow, 0);
});

test("migrated income is replaced exactly once by equal Trading P/L", () => {
  const result = snapshot({
    accounts: [account("trading", 50_000)],
    incomes: [income("legacy-profit", "trading", 10_000)],
    tradingResults: [
      tradingResult("migrated-profit", "trading", 10_000, januaryTimestamp, "legacy-profit"),
    ],
  });

  assert.equal(result.accountBalances.trading, 60_000);
  assert.equal(result.totalBalance, 60_000);
  assert.equal(result.monthlyIncome, 0);
  assert.deepEqual(result.monthlyIncomes, []);
  assert.equal(result.monthlyTradingNet, 10_000);
});

test("previous-period Trading P/L affects current balance but not selected-period P/L", () => {
  const decemberTimestamp = new Date(2026, 11, 20, 12).getTime();
  const result = snapshot({
    accounts: [account("trading", 50_000)],
    tradingResults: [
      tradingResult("december-profit", "trading", 8_000, decemberTimestamp),
      tradingResult("january-loss", "trading", -3_000),
    ],
  });

  assert.equal(result.accountBalances.trading, 55_000);
  assert.equal(result.totalBalance, 55_000);
  assert.equal(result.monthlyTradingNet, -3_000);
  assert.deepEqual(result.monthlyTradingResults.map((item) => item.id), ["january-loss"]);
});

test("Trading results for unknown or general accounts fail closed", () => {
  const result = snapshot({
    accounts: [account("bank", 100_000), account("trading", 50_000)],
    tradingResults: [
      tradingResult("general-profit", "bank", 99_000),
      tradingResult("unknown-profit", "missing", 88_000),
    ],
  });

  assert.deepEqual(result.accountBalances, {
    bank: 100_000,
    trading: 50_000,
  });
  assert.equal(result.totalBalance, 150_000);
  assert.equal(result.monthlyTradingNet, 0);
});

test("duplicate migrated source IDs cannot exclude income or add P/L twice", () => {
  const result = snapshot({
    accounts: [account("trading", 50_000)],
    incomes: [income("legacy-profit", "trading", 10_000)],
    tradingResults: [
      tradingResult("first", "trading", 10_000, januaryTimestamp, "legacy-profit"),
      tradingResult("duplicate", "trading", 10_000, januaryTimestamp, "legacy-profit"),
    ],
  });

  assert.equal(result.accountBalances.trading, 60_000);
  assert.equal(result.totalBalance, 60_000);
  assert.equal(result.monthlyIncome, 10_000);
  assert.equal(result.monthlyTradingNet, 0);
});
