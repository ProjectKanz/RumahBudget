import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTradingSummary,
  validateTradingResultDraft,
} from "../src/lib/trading-calculations.ts";

const januaryReference = new Date(2027, 0, 15, 12).getTime();
const januaryTimestamp = new Date(2027, 0, 10, 12).getTime();
const decemberTimestamp = new Date(2026, 11, 20, 12).getTime();

function account(id, purpose = "general", isArchived = false) {
  return {
    id,
    userId: "user-1",
    name: id,
    accountType: purpose === "trading" ? "Investment" : "Bank",
    purpose,
    initialBalance: 0,
    isArchived,
    createdAt: januaryTimestamp,
  };
}

function transfer(id, fromAccountId, toAccountId, amount, createdAt = januaryTimestamp) {
  return {
    id,
    userId: "user-1",
    fromAccountId,
    toAccountId,
    amount,
    note: id,
    createdAt,
    transactionDate: createdAt === decemberTimestamp ? "2026-12-20" : "2027-01-10",
  };
}

function result(id, accountId, netAmount, createdAt = januaryTimestamp, sourceIncomeId) {
  return {
    id,
    userId: "user-1",
    accountId,
    transactionDate: createdAt === decemberTimestamp ? "2026-12-20" : "2027-01-10",
    netAmount,
    note: id,
    sourceIncomeId,
    createdAt,
  };
}

test("Trading summary derives deposits and withdrawals without counting trading-to-trading transfers", () => {
  const summary = calculateTradingSummary({
    accounts: [
      account("bank"),
      account("trading-a", "trading"),
      account("trading-b", "trading"),
    ],
    accountBalances: {
      bank: 80_000,
      "trading-a": 107_000,
      "trading-b": 25_000,
    },
    transfers: [
      transfer("deposit", "bank", "trading-a", 20_000, januaryTimestamp - 3_000),
      transfer("withdrawal", "trading-a", "bank", 5_000, januaryTimestamp - 2_000),
      transfer("internal", "trading-a", "trading-b", 7_000, januaryTimestamp - 1_000),
    ],
    tradingResults: [
      result("profit", "trading-a", 10_000, januaryTimestamp + 1_000),
      result("loss", "trading-a", -3_000, januaryTimestamp + 2_000),
    ],
    periodReference: januaryReference,
  });

  assert.equal(summary.currentBalance, 132_000);
  assert.equal(summary.periodNetResult, 7_000);
  assert.equal(summary.periodDeposits, 20_000);
  assert.equal(summary.periodWithdrawals, 5_000);
  assert.deepEqual(
    summary.activities.map((activity) => activity.type),
    ["loss", "profit", "withdrawal", "deposit"],
  );
  assert.equal(summary.activities.some((activity) => activity.id === "transfer-internal"), false);
});

test("Trading summary includes only selected-period activity while retaining current balance", () => {
  const summary = calculateTradingSummary({
    accounts: [account("bank"), account("trading", "trading")],
    accountBalances: { bank: 50_000, trading: 88_000 },
    transfers: [
      transfer("old-deposit", "bank", "trading", 9_000, decemberTimestamp),
      transfer("new-deposit", "bank", "trading", 4_000),
    ],
    tradingResults: [
      result("old-profit", "trading", 8_000, decemberTimestamp),
      result("new-loss", "trading", -2_000),
    ],
    periodReference: januaryReference,
  });

  assert.equal(summary.currentBalance, 88_000);
  assert.equal(summary.periodNetResult, -2_000);
  assert.equal(summary.periodDeposits, 4_000);
  assert.deepEqual(
    summary.activities.map((activity) => activity.id).sort(),
    ["result-new-loss", "transfer-new-deposit"],
  );
});

test("migrated Trading results are marked in history", () => {
  const summary = calculateTradingSummary({
    accounts: [account("trading", "trading")],
    accountBalances: { trading: 60_000 },
    transfers: [],
    tradingResults: [
      result("migrated", "trading", 10_000, januaryTimestamp, "legacy-income"),
    ],
    periodReference: januaryReference,
  });

  assert.equal(summary.activities[0].type, "profit");
  assert.equal(summary.activities[0].isMigrated, true);
  assert.equal(summary.activities[0].amount, 10_000);
});

test("Trading result validation accepts a signed result for an active owned trading account", () => {
  const validation = validateTradingResultDraft({
    accountId: "trading",
    transactionDate: "2027-01-10",
    netAmount: -2_500,
    accounts: [account("trading", "trading")],
    userId: "user-1",
  });

  assert.deepEqual(validation, {
    ok: true,
    value: {
      accountId: "trading",
      transactionDate: "2027-01-10",
      netAmount: -2_500,
    },
  });
});

test("Trading result validation rejects zero and non-finite amounts", () => {
  const accounts = [account("trading", "trading")];

  assert.equal(validateTradingResultDraft({ accountId: "trading", transactionDate: "2027-01-10", netAmount: 0, accounts, userId: "user-1" }).ok, false);
  assert.equal(validateTradingResultDraft({ accountId: "trading", transactionDate: "2027-01-10", netAmount: Number.NaN, accounts, userId: "user-1" }).ok, false);
});

test("Trading result validation rejects malformed dates", () => {
  const validation = validateTradingResultDraft({
    accountId: "trading",
    transactionDate: "2027-02-30",
    netAmount: 1_000,
    accounts: [account("trading", "trading")],
    userId: "user-1",
  });

  assert.equal(validation.ok, false);
});

test("Trading result validation rejects missing, general, archived, and non-owned accounts", () => {
  const base = {
    transactionDate: "2027-01-10",
    netAmount: 1_000,
    userId: "user-1",
  };

  assert.equal(validateTradingResultDraft({ ...base, accountId: "missing", accounts: [] }).ok, false);
  assert.equal(validateTradingResultDraft({ ...base, accountId: "bank", accounts: [account("bank")] }).ok, false);
  assert.equal(validateTradingResultDraft({ ...base, accountId: "trading", accounts: [account("trading", "trading", true)] }).ok, false);
  assert.equal(validateTradingResultDraft({ ...base, accountId: "trading", accounts: [{ ...account("trading", "trading"), userId: "user-2" }] }).ok, false);
});
