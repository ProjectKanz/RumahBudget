import type { AllocationRecord, Bucket } from "@/src/types/allocation";
import type {
  Asset,
  InvestmentTransaction,
  PortfolioHolding,
  PriceSnapshot,
} from "@/src/types/portfolio";

export function calculateAllocationBucketBalances(
  buckets: Bucket[],
  allocationRecords: AllocationRecord[],
  investmentTransactions: InvestmentTransaction[],
) {
  const balances = buckets.reduce<Record<string, number>>(
    (nextBalances, bucket) => {
      nextBalances[bucket.id] = 0;
      return nextBalances;
    },
    {},
  );

  allocationRecords.forEach((record) => {
    balances[record.bucketId] =
      (balances[record.bucketId] ?? 0) + record.amount;
  });

  investmentTransactions.forEach((transaction) => {
    if (!transaction.sourceBucketId) {
      return;
    }

    // A fee is always money leaving, on both sides of the trade. Adding it to
    // sell proceeds credited the bucket more than the sale actually returned, so
    // a buy-then-sell round trip at an unchanged price created cash.
    const movement =
      transaction.type === "buy"
        ? -(transaction.amountIdr + transaction.fee)
        : transaction.amountIdr - transaction.fee;

    balances[transaction.sourceBucketId] =
      (balances[transaction.sourceBucketId] ?? 0) + movement;
  });

  return balances;
}

export function getLatestPriceByAsset(priceSnapshots: PriceSnapshot[]) {
  return priceSnapshots.reduce<Record<string, PriceSnapshot>>(
    (latest, snapshot) => {
      const current = latest[snapshot.assetId];
      if (!current || snapshot.timestamp > current.timestamp) {
        latest[snapshot.assetId] = snapshot;
      }
      return latest;
    },
    {},
  );
}

export function calculatePortfolioHoldings(
  assets: Asset[],
  transactions: InvestmentTransaction[],
  priceSnapshots: PriceSnapshot[],
): PortfolioHolding[] {
  const latestPrices = getLatestPriceByAsset(priceSnapshots);
  const rawHoldings = assets.map((asset) => {
    // Average cost is path dependent, so trades must be replayed in the order
    // they happened rather than in whatever order the rows arrived.
    const assetTransactions = transactions
      .filter((transaction) => transaction.assetId === asset.id)
      .sort((first, second) =>
        first.date === second.date
          ? first.createdAt - second.createdAt
          : first.date < second.date
            ? -1
            : 1,
      );

    let quantity = 0;
    let cost = 0;
    let realizedPnL = 0;
    let hasInvalidHistory = false;

    for (const transaction of assetTransactions) {
      const fee = Number.isFinite(transaction.fee) ? transaction.fee : 0;
      const amountIdr = Number.isFinite(transaction.amountIdr)
        ? transaction.amountIdr
        : 0;
      const tradeQuantity = Number.isFinite(transaction.quantity)
        ? transaction.quantity
        : 0;

      if (transaction.type === "buy") {
        quantity += tradeQuantity;
        cost += amountIdr + fee;
        continue;
      }

      // Selling releases a proportional slice of the cost basis. Subtracting the
      // sale proceeds instead left the remaining position carrying a basis it
      // never had, and a fully closed position kept reporting a phantom
      // unrealized gain forever.
      const averageCost = quantity > 0 ? cost / quantity : 0;
      const soldQuantity = Math.min(tradeQuantity, Math.max(0, quantity));
      if (tradeQuantity > quantity) {
        hasInvalidHistory = true;
      }

      const releasedCost = averageCost * soldQuantity;
      realizedPnL += amountIdr - fee - releasedCost;
      quantity -= tradeQuantity;
      cost -= releasedCost;

      if (quantity <= 0) {
        // Nothing is held any more, so nothing is invested any more.
        cost = 0;
      }
    }

    const latestTransaction = assetTransactions[assetTransactions.length - 1];
    const currentPrice =
      latestPrices[asset.id]?.price ?? latestTransaction?.price ?? 0;
    const currentValue = Math.max(0, quantity) * currentPrice;
    const averagePrice = quantity > 0 ? cost / quantity : 0;
    const unrealizedPnL = quantity > 0 ? currentValue - cost : 0;
    const unrealizedPnLPercent =
      cost > 0 ? (unrealizedPnL / cost) * 100 : 0;

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      totalQuantity: quantity,
      totalCost: cost,
      averagePrice,
      currentPrice,
      currentValue,
      realizedPnL,
      unrealizedPnL,
      unrealizedPnLPercent,
      hasInvalidHistory,
      portfolioAllocationPercent: 0,
    };
  });

  const totalPortfolioValue = rawHoldings.reduce(
    (total, holding) => total + holding.currentValue,
    0,
  );
  return rawHoldings.map((holding) => ({
    ...holding,
    portfolioAllocationPercent:
      totalPortfolioValue > 0
        ? (holding.currentValue / totalPortfolioValue) * 100
        : 0,
  }));
}

type ValidateInvestmentSaleInput = {
  amountIdr: number;
  availableQuantity: number;
  fee: number;
  price: number;
  quantityInput: string;
};

/**
 * Sells were never validated, so a mistyped quantity could drive a holding
 * negative and credit the bucket with money that was never received.
 */
export function validateInvestmentSale({
  amountIdr,
  availableQuantity,
  fee,
  price,
  quantityInput,
}:
ValidateInvestmentSaleInput):
  | { ok: true; proceeds: number; quantity: number }
  | { ok: false; message: string } {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(amountIdr) ||
    amountIdr <= 0 ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    return {
      ok: false,
      message: "Enter valid sell price, proceeds amount, and fee.",
    };
  }

  const normalizedQuantity = quantityInput.trim();
  const typedQuantity = normalizedQuantity ? Number(normalizedQuantity) : null;
  if (
    typedQuantity === null ||
    !Number.isFinite(typedQuantity) ||
    typedQuantity <= 0
  ) {
    return { ok: false, message: "Enter the quantity you are selling." };
  }

  if (!Number.isFinite(availableQuantity) || typedQuantity > availableQuantity) {
    return {
      ok: false,
      message: "You cannot sell more than you currently hold.",
    };
  }

  if (fee >= amountIdr) {
    return { ok: false, message: "Fee cannot be equal to or above proceeds." };
  }

  return { ok: true, proceeds: amountIdr - fee, quantity: typedQuantity };
}

type ValidateInvestmentPurchaseInput = {
  amountIdr: number;
  availableBalance: number;
  fee: number;
  price: number;
  quantityInput: string;
};

export function validateInvestmentPurchase({
  amountIdr,
  availableBalance,
  fee,
  price,
  quantityInput,
}: ValidateInvestmentPurchaseInput):
  | { ok: true; movement: number; quantity: number }
  | { ok: false; message: string } {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(amountIdr) ||
    amountIdr <= 0 ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    return {
      ok: false,
      message: "Enter valid buy price, invested amount, and fee.",
    };
  }

  const normalizedQuantity = quantityInput.trim();
  const typedQuantity = normalizedQuantity ? Number(normalizedQuantity) : null;
  if (
    typedQuantity !== null &&
    (!Number.isFinite(typedQuantity) || typedQuantity <= 0)
  ) {
    return {
      ok: false,
      message: "Quantity must be greater than 0 when provided.",
    };
  }

  const quantity = typedQuantity ?? amountIdr / price;
  if (typedQuantity !== null) {
    const expectedAmount = price * typedQuantity;
    const tolerance = Math.max(1, amountIdr * 0.001);
    if (Math.abs(expectedAmount - amountIdr) > tolerance) {
      return {
        ok: false,
        message:
          "Buy price × quantity must match the invested amount (within 0.1%). Enter the amount before fees; the fee has its own field, and a broker statement usually shows the two already added together.",
      };
    }
  }

  const movement = amountIdr + fee;
  if (!Number.isFinite(availableBalance) || movement > availableBalance) {
    return {
      ok: false,
      message:
        "This buy exceeds the available source bucket balance. Allocate more cash or reduce the purchase first.",
    };
  }

  return { ok: true, movement, quantity };
}

export function getAllocationBarPercent(
  percentage: number,
  isBalanceHidden: boolean,
) {
  if (isBalanceHidden) {
    return 50;
  }

  return Number.isFinite(percentage)
    ? Math.max(0, Math.min(100, percentage))
    : 0;
}

const allocationStateCollectionKeys = [
  "assets",
  "buckets",
  "incomeRecords",
  "allocationRecords",
  "investmentTransactions",
  "priceSnapshots",
  "templates",
] as const;

export function isAllocationStateOwnedByUser(
  userId: string,
  value: unknown,
) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return allocationStateCollectionKeys.every((key) => {
    const collection = candidate[key];
    return (
      Array.isArray(collection) &&
      collection.every(
        (item) =>
          Boolean(item) &&
          typeof item === "object" &&
          (item as { userId?: unknown }).userId === userId,
      )
    );
  });
}
