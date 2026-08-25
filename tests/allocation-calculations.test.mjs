import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAllocationBucketBalances,
  calculatePortfolioHoldings,
  getAllocationBarPercent,
  isAllocationStateOwnedByUser,
  validateInvestmentPurchase,
  validateInvestmentSale,
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

// --- realized vs unrealized, and money conservation ------------------------

function sell(overrides = {}) {
  return {
    ...buy(),
    id: "sell-1",
    type: "sell",
    createdAt: 3,
    ...overrides,
  };
}

function priceSnapshot(price) {
  return {
    id: "price-1",
    userId,
    assetId: "btc",
    price,
    currency: "IDR",
    source: "manual",
    timestamp: 99,
    isManual: true,
  };
}

function holdingFor(transactions, price) {
  return calculatePortfolioHoldings(
    [asset()],
    transactions,
    price === undefined ? [] : [priceSnapshot(price)],
  )[0];
}

test("a flat round trip costs exactly the two fees, and never mints cash", () => {
  const balances = calculateAllocationBucketBalances(
    [bucket("investment")],
    [
      {
        id: "allocation-1",
        userId,
        incomeRecordId: "income-1",
        bucketId: "investment",
        amount: 10_000_000,
        percentage: 100,
        createdAt: 1,
      },
    ],
    [
      buy({ price: 5_000_000, amountIdr: 5_000_000, quantity: 1, fee: 50_000, date: "2026-08-01" }),
      sell({ price: 5_000_000, amountIdr: 5_000_000, quantity: 1, fee: 50_000, date: "2026-08-02" }),
    ],
  );

  // Buying and selling back at the same price leaves both fees behind.
  // Crediting the sell fee used to return the bucket to a full 10,000,000.
  assert.equal(balances.investment, 9_900_000);
});

test("selling half releases half the cost basis, not the sale proceeds", () => {
  const holding = holdingFor(
    [
      buy({ price: 100_000_000, amountIdr: 100_000_000, quantity: 1, fee: 0, date: "2026-08-01" }),
      sell({ price: 150_000_000, amountIdr: 75_000_000, quantity: 0.5, fee: 0, date: "2026-08-10" }),
    ],
    150_000_000,
  );

  assert.equal(holding.totalQuantity, 0.5);
  assert.equal(holding.totalCost, 50_000_000);
  assert.equal(holding.averagePrice, 100_000_000);
  assert.equal(holding.currentValue, 75_000_000);
  // Was +50,000,000 (+200%) because the basis had been wiped out by proceeds.
  assert.equal(holding.unrealizedPnL, 25_000_000);
  assert.equal(holding.unrealizedPnLPercent, 50);
  assert.equal(holding.realizedPnL, 25_000_000);
});

test("a closed position reports its gain as realized, not as unrealized", () => {
  const holding = holdingFor(
    [
      buy({ price: 100_000_000, amountIdr: 100_000_000, quantity: 1, fee: 0, date: "2026-08-01" }),
      sell({ price: 150_000_000, amountIdr: 150_000_000, quantity: 1, fee: 0, date: "2026-08-10" }),
    ],
    150_000_000,
  );

  assert.equal(holding.totalQuantity, 0);
  // Used to sit at -50,000,000 cost with +50,000,000 "unrealized" forever.
  assert.equal(holding.totalCost, 0);
  assert.equal(holding.currentValue, 0);
  assert.equal(holding.unrealizedPnL, 0);
  assert.equal(holding.unrealizedPnLPercent, 0);
  assert.equal(holding.realizedPnL, 50_000_000);
});

test("fees reduce the realized result on both legs", () => {
  const holding = holdingFor(
    [
      buy({ price: 1_000_000, amountIdr: 10_000_000, quantity: 10, fee: 15_000, date: "2026-08-01" }),
      sell({ price: 1_100_000, amountIdr: 11_000_000, quantity: 10, fee: 25_000, date: "2026-08-10" }),
    ],
    1_100_000,
  );

  // 11,000,000 - 25,000 proceeds against a 10,015,000 basis.
  assert.equal(holding.realizedPnL, 960_000);
  assert.equal(holding.totalQuantity, 0);
  assert.equal(holding.totalCost, 0);
});

test("selling more than is held is flagged instead of passing silently", () => {
  const holding = holdingFor(
    [
      buy({ price: 100_000_000, amountIdr: 100_000_000, quantity: 1, fee: 0, date: "2026-08-01" }),
      sell({ price: 100_000_000, amountIdr: 200_000_000, quantity: 2, fee: 0, date: "2026-08-10" }),
    ],
    100_000_000,
  );

  assert.equal(holding.hasInvalidHistory, true);
  assert.equal(holding.totalCost, 0);
  assert.equal(holding.unrealizedPnL, 0);
});

test("trades are replayed in date order regardless of row order", () => {
  const transactions = [
    sell({ price: 150_000_000, amountIdr: 75_000_000, quantity: 0.5, fee: 0, date: "2026-08-10" }),
    buy({ price: 100_000_000, amountIdr: 100_000_000, quantity: 1, fee: 0, date: "2026-08-01" }),
  ];

  const shuffled = holdingFor(transactions, 150_000_000);
  const ordered = holdingFor([...transactions].reverse(), 150_000_000);

  assert.deepEqual(shuffled, ordered);
  assert.equal(shuffled.hasInvalidHistory, false);
  assert.equal(shuffled.averagePrice, 100_000_000);
});

test("an untouched buy-only position is unaffected by the change", () => {
  const holding = holdingFor([buy()], 150);

  assert.equal(holding.totalQuantity, 10);
  assert.equal(holding.totalCost, 1_010);
  assert.equal(holding.realizedPnL, 0);
  assert.equal(holding.currentValue, 1_500);
  assert.equal(holding.unrealizedPnL, 490);
});

test("sale validation refuses to sell more than is held", () => {
  const result = validateInvestmentSale({
    amountIdr: 200_000_000,
    availableQuantity: 1,
    fee: 0,
    price: 100_000_000,
    quantityInput: "2",
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /more than you currently hold/);
});

test("sale validation returns proceeds net of fee", () => {
  const result = validateInvestmentSale({
    amountIdr: 11_000_000,
    availableQuantity: 10,
    fee: 25_000,
    price: 1_100_000,
    quantityInput: "10",
  });

  assert.deepEqual(result, { ok: true, proceeds: 10_975_000, quantity: 10 });
});

test("sale validation rejects missing quantity and impossible fees", () => {
  const missingQuantity = validateInvestmentSale({
    amountIdr: 1_000,
    availableQuantity: 10,
    fee: 0,
    price: 100,
    quantityInput: "  ",
  });
  assert.equal(missingQuantity.ok, false);

  const swallowedByFee = validateInvestmentSale({
    amountIdr: 1_000,
    availableQuantity: 10,
    fee: 1_000,
    price: 100,
    quantityInput: "10",
  });
  assert.equal(swallowedByFee.ok, false);
});

test("a fetched market price shows up even before anything is held", () => {
  // Pressing "Fetch Latest" on an empty position must still surface the quote.
  // Every other figure on the card is legitimately zero at that point, so the
  // price itself is the only evidence the fetch did anything.
  const holding = calculatePortfolioHoldings([asset()], [], [priceSnapshot(6_400)])[0];

  assert.equal(holding.totalQuantity, 0);
  assert.equal(holding.currentValue, 0);
  assert.equal(holding.currentPrice, 6_400);
});

test("a manual price overrides an older provider snapshot", () => {
  const provider = { ...priceSnapshot(6_400), id: "price-idx", timestamp: 10, isManual: false };
  const manual = { ...priceSnapshot(6_550), id: "price-manual", timestamp: 20, isManual: true };

  const holding = calculatePortfolioHoldings([asset()], [buy()], [provider, manual])[0];

  assert.equal(holding.currentPrice, 6_550);
});

test("a lot purchase carries its fee once, not twice", () => {
  // A broker statement reports the settled total: gross plus fee. Entering that
  // total as the gross amount double-counted the fee and failed validation.
  const grossAmount = 5_000 * 300; // 3 lots at 5,000 per share
  const fee = 2_250;

  const validation = validateInvestmentPurchase({
    amountIdr: grossAmount,
    availableBalance: 10_000_000,
    fee,
    price: 5_000,
    quantityInput: "300",
  });

  assert.equal(validation.ok, true);
  // What actually leaves the bucket is the settled total the statement shows.
  assert.equal(validation.movement, 1_502_250);
  assert.equal(validation.quantity, 300);
});

test("passing the broker's settled total as the gross amount is rejected", () => {
  const settledTotal = 5_000 * 300 + 2_250;

  const validation = validateInvestmentPurchase({
    amountIdr: settledTotal,
    availableBalance: 10_000_000,
    fee: 2_250,
    price: 5_000,
    quantityInput: "300",
  });

  assert.equal(validation.ok, false);
  // The message has to say why, or the user just sees a correct entry refused.
  assert.match(validation.message, /before fees/);
});

test("cost basis for a lot position includes the fee exactly once", () => {
  const holding = calculatePortfolioHoldings(
    [asset()],
    [buy({ price: 5_000, amountIdr: 1_500_000, quantity: 300, fee: 2_250, date: "2025-09-10" })],
    [priceSnapshot(4_200)],
  )[0];

  assert.equal(holding.totalQuantity, 300);
  assert.equal(holding.totalCost, 1_502_250);
  assert.equal(holding.currentValue, 1_260_000);
  assert.equal(holding.unrealizedPnL, -242_250);
});
