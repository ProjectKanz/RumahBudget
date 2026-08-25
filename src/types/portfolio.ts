export type AssetType = "stock" | "crypto" | "cash" | "other";
export type AssetCurrency = "IDR" | "USD";
export type PriceProviderId =
  | "manual"
  | "mock"
  | "coingecko"
  | "idx"
  | "unsupported";

export type Asset = {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: AssetCurrency;
  priceProvider?: PriceProviderId;
};

export type InvestmentTransaction = {
  id: string;
  userId: string;
  assetId: string;
  date: string;
  type: "buy" | "sell";
  price: number;
  amountIdr: number;
  quantity: number;
  fee: number;
  sourceBucketId?: string;
  note: string;
  createdAt: number;
};

export type PriceSnapshot = {
  id: string;
  userId: string;
  assetId: string;
  price: number;
  currency: AssetCurrency;
  source: PriceProviderId;
  timestamp: number;
  isManual: boolean;
};

export type PortfolioHolding = {
  assetId: string;
  symbol: string;
  name: string;
  totalQuantity: number;
  totalCost: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  realizedPnL: number;
  hasInvalidHistory: boolean;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  portfolioAllocationPercent: number;
};

export type PriceQuote = {
  symbol: string;
  price: number;
  currency: AssetCurrency;
  source: PriceProviderId;
  timestamp: number;
  limitation?: string;
};
