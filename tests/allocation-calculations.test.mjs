import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAllocationBucketBalances,
  calculatePortfolioHoldings,
  getAllocationBarPercent,
  isAllocationStateOwnedByUser,
  validateInvestmentPurchase,
} from "../src/lib/allocation-calculations.ts";

const userId = "user-1";

function bucket(id) {
  return {
    id,
    userId,
    name: id,
    type: id === "investment" ? "investment_cash" : "living",
    createdAt: 1,
    updatedAt: 1,
  };
}

function asset(id = "btc") {
  return {
    id,
    userId,
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    currency: "IDR",
  };
}

function buy(overrides = {}) {
  return {
    id: "buy-1",
    userId,
    assetId: "btc",
    date: "2026-08-14",
    type: "buy",
    price: 100,
    amountIdr: 1_000,
    quantity: 10,
    fee: 10,
    sourceBucketId: "investment",
    note: "",
    createdAt: 2,
    ...overrides,
  };
}

test("bucket balances subtract investment amount and fee exactly once", () => {
  const balances = calculateAllocationBucketBalances(
    [bucket("investment")],
    [
      {
        id: "allocation-1",
        userId,
        incomeRecordId: "income-1",
        bucketId: "investment",
        amount: 2_000,
        percentage: 100,
        createdAt: 1,
      },
    ],
    [buy()],
  );

  assert.equal(balances.investment, 990);
});

test("purchase validation rejects a buy above the source bucket balance", () => {
  const result = validateInvestmentPurchase({
    amountIdr: 1_000,
    availableBalance: 1_005,
    fee: 10,
    price: 100,
    quantityInput: "10",
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /exceeds the available source bucket balance/i);
});

test("purchase validation rejects inconsistent price, quantity, and amount", () => {
  const result = validateInvestmentPurchase({
    amountIdr: 1_000,
    availableBalance: 2_000,
    fee: 0,
    price: 100,
    quantityInput: "9",
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /price × quantity must match/i);
});

test("purchase validation calculates quantity when the optional field is empty", () => {
  const result = validateInvestmentPurchase({
    amountIdr: 1_000,
    availableBalance: 2_000,
    fee: 5,
    price: 100,
    quantityInput: "",
  });

  assert.deepEqual(result, { ok: true, movement: 1_005, quantity: 10 });
});

test("portfolio keeps the latest explicit market price after a buy is recorded", () => {
  const holdings = calculatePortfolioHoldings(
    [asset()],
    [buy({ createdAt: 200 })],
    [
      {
        id: "quote-1",
        userId,
        assetId: "btc",
        price: 120,
        currency: "IDR",
        source: "coingecko",
        timestamp: 100,
        isManual: false,
      },
    ],
  );

  assert.equal(holdings[0].currentPrice, 120);
  assert.equal(holdings[0].currentValue, 1_200);
  assert.equal(holdings[0].unrealizedPnL, 190);
});

test("portfolio falls back to the most recent buy price when no quote exists", () => {
  const holdings = calculatePortfolioHoldings(
    [asset()],
    [buy(), buy({ id: "buy-2", price: 110, createdAt: 3 })],
    [],
  );

  assert.equal(holdings[0].currentPrice, 110);
});

test("zero-percent charts stay empty and privacy mode uses neutral geometry", () => {
  assert.equal(getAllocationBarPercent(0, false), 0);
  assert.equal(getAllocationBarPercent(180, false), 100);
  assert.equal(getAllocationBarPercent(0, true), 50);
  assert.equal(getAllocationBarPercent(90, true), 50);
});

test("allocation backup state must contain only records owned by the active user", () => {
  const validState = {
    assets: [asset()],
    buckets: [bucket("investment")],
    incomeRecords: [],
    allocationRecords: [],
    investmentTransactions: [buy()],
    priceSnapshots: [],
    templates: [],
  };

  assert.equal(isAllocationStateOwnedByUser(userId, validState), true);
  assert.equal(
    isAllocationStateOwnedByUser(userId, {
      ...validState,
      investmentTransactions: [buy({ userId: "another-user" })],
    }),
    false,
  );
  assert.equal(
    isAllocationStateOwnedByUser(userId, { ...validState, buckets: null }),
    false,
  );
});
