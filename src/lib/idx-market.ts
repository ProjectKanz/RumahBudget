/**
 * Indonesia Stock Exchange conventions and the parsing half of the IDX quote
 * lookup. Kept free of network calls so both can be tested directly.
 */

/** IDX trades in lots. One lot has been 100 shares since 2014. */
export const SHARES_PER_LOT = 100;

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9]{1,7}$/;
const YAHOO_CHART_ORIGIN = "https://query1.finance.yahoo.com";

export type IdxQuote = {
  currency: "IDR";
  price: number;
  timestamp: number;
};

export type IdxQuoteResult =
  | ({ ok: true } & IdxQuote)
  | { ok: false; message: string };

export function normalizeIdxSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function isIdxSymbol(symbol: string) {
  return SYMBOL_PATTERN.test(normalizeIdxSymbol(symbol));
}

/**
 * Ticker for an asset traded on IDX. The symbol is pattern-checked before it is
 * ever interpolated into a URL.
 */
export function buildYahooChartUrl(symbol: string): string | null {
  const normalized = normalizeIdxSymbol(symbol);
  if (!isIdxSymbol(normalized)) {
    return null;
  }

  return `${YAHOO_CHART_ORIGIN}/v8/finance/chart/${normalized}.JK?interval=1d&range=1d`;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Pulls the last traded price out of a Yahoo chart response.
 *
 * Fails closed on anything unexpected: a delisted or mistyped ticker comes back
 * as a well-formed body with no price, and quietly reporting 0 would wipe out a
 * holding's valuation.
 */
export function parseYahooChartPayload(payload: unknown): IdxQuoteResult {
  const root = readRecord(payload);
  const chart = readRecord(root?.chart);

  if (!chart) {
    return { ok: false, message: "Market data response was not readable." };
  }

  const chartError = readRecord(chart.error);
  if (chartError) {
    const description =
      typeof chartError.description === "string"
        ? chartError.description
        : "Market data provider rejected the symbol.";
    return { ok: false, message: description };
  }

  const results = Array.isArray(chart.result) ? chart.result : [];
  const meta = readRecord(readRecord(results[0])?.meta);
  if (!meta) {
    return { ok: false, message: "No quote was returned for this symbol." };
  }

  const currency =
    typeof meta.currency === "string" ? meta.currency.toUpperCase() : "";
  if (currency !== "IDR") {
    // This app does not convert currencies, and silently mixing them would
    // corrupt every portfolio total downstream.
    return {
      ok: false,
      message: `Quote came back in ${currency || "an unknown currency"}, not IDR.`,
    };
  }

  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "Quote did not include a usable price." };
  }

  const marketTime = Number(meta.regularMarketTime);
  const timestamp =
    Number.isFinite(marketTime) && marketTime > 0
      ? marketTime * 1000
      : Date.now();

  return { currency: "IDR", ok: true, price, timestamp };
}

/** Whether an asset is quoted per share but traded in lots. */
export function isLotTraded(asset: {
  currency?: string;
  type?: string;
}) {
  return asset.type === "stock" && asset.currency === "IDR";
}

export function lotsToShares(lots: number) {
  return lots * SHARES_PER_LOT;
}

export function sharesToLots(shares: number) {
  return shares / SHARES_PER_LOT;
}

export type LotParseResult =
  | { ok: true; lots: number; shares: number }
  | { ok: false; message: string };

/**
 * IDX orders are whole lots. Accepting 10 when the user meant 10 lots is the
 * difference between a 95,000 and a 9,500,000 position.
 */
export function parseLotInput(value: string): LotParseResult {
  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, message: "Enter how many lots you traded." };
  }

  const lots = Number(normalized);
  if (!Number.isFinite(lots) || lots <= 0) {
    return { ok: false, message: "Lots must be greater than 0." };
  }

  if (!Number.isInteger(lots)) {
    return { ok: false, message: "IDX trades in whole lots." };
  }

  return { lots, ok: true, shares: lotsToShares(lots) };
}
