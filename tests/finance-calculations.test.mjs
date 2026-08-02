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
    initialBalance,
    isArchived: false,
    createdAt: januaryTimestamp,
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

function snapshot({ accounts, incomes = [], expenses = [], transfers = [], now = januaryReference }) {
  return calculateFinanceSnapshot({ accounts, incomes, expenses, transfers, now });
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
