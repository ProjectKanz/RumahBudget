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

    const movement = transaction.amountIdr + transaction.fee;
    balances[transaction.sourceBucketId] =
      (balances[transaction.sourceBucketId] ?? 0) +
      (transaction.type === "buy" ? -movement : movement);
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
    const assetTransactions = transactions.filter(
      (transaction) => transaction.assetId === asset.id,
    );
    const totals = assetTransactions.reduce(
      (nextTotals, transaction) => {
        const direction = transaction.type === "buy" ? 1 : -1;
        return {
          quantity: nextTotals.quantity + direction * transaction.quantity,
          cost:
            nextTotals.cost +
            direction * (transaction.amountIdr + transaction.fee),
        };
      },
      { cost: 0, quantity: 0 },
    );
    const latestTransaction = assetTransactions.reduce<
      InvestmentTransaction | undefined
    >(
      (latest, transaction) =>
        !latest || transaction.createdAt > latest.createdAt
          ? transaction
          : latest,
      undefined,
    );
    const currentPrice =
      latestPrices[asset.id]?.price ?? latestTransaction?.price ?? 0;
    const currentValue = Math.max(0, totals.quantity) * currentPrice;
    const averagePrice = totals.quantity > 0 ? totals.cost / totals.quantity : 0;
    const unrealizedPnL = currentValue - totals.cost;
    const unrealizedPnLPercent =
      totals.cost > 0 ? (unrealizedPnL / totals.cost) * 100 : 0;

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      totalQuantity: totals.quantity,
      totalCost: totals.cost,
      averagePrice,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
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
          "Buy price × quantity must match the invested amount (within 0.1%).",
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
