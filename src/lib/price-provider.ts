import { isIdxSymbol, normalizeIdxSymbol } from "@/src/lib/idx-market";
import type { AssetCurrency, PriceProviderId, PriceQuote } from "@/src/types/portfolio";

const mockPrices: Record<string, { price: number; currency: AssetCurrency }> = {
  BTC: { price: 1_600_000_000, currency: "IDR" },
  BBCA: { price: 9_500, currency: "IDR" },
  BBRI: { price: 4_300, currency: "IDR" },
};

export type PriceProviderResult =
  | { ok: true; quote: PriceQuote }
  | { ok: false; message: string; source: PriceProviderId };

export function getMockPriceQuote(symbol: string): PriceProviderResult {
  const normalizedSymbol = normalizeIdxSymbol(symbol);
  const mock = mockPrices[normalizedSymbol];

  if (!mock) {
    return {
      ok: false,
      message: "No mock price configured for this symbol.",
      source: "mock",
    };
  }

  return {
    ok: true,
    quote: {
      symbol: normalizedSymbol,
      price: mock.price,
      currency: mock.currency,
      source: "mock",
      timestamp: Date.now(),
      limitation: "Static mock price for UI/model validation, not market data.",
    },
  };
}

/**
 * Every live lookup goes through our own route, so the browser never talks to a
 * third-party market data host directly and no key is exposed.
 */
async function fetchQuoteFromRoute(
  symbol: string,
  source: PriceProviderId,
): Promise<PriceProviderResult> {
  try {
    const response = await fetch(
      `/api/prices/latest?symbol=${encodeURIComponent(symbol)}`,
      { method: "GET" },
    );
    const payload = await response.json();

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        message: payload?.message ?? "Latest price provider failed.",
        source,
      };
    }

    return { ok: true, quote: payload.quote as PriceQuote };
  } catch {
    return {
      ok: false,
      message:
        "Could not reach the latest price route. Use manual price or mock price.",
      source,
    };
  }
}

export async function fetchLatestPrice(
  symbol: string,
): Promise<PriceProviderResult> {
  const normalizedSymbol = normalizeIdxSymbol(symbol);

  if (normalizedSymbol === "BTC") {
    return await fetchQuoteFromRoute(normalizedSymbol, "coingecko");
  }

  if (isIdxSymbol(normalizedSymbol)) {
    return await fetchQuoteFromRoute(normalizedSymbol, "idx");
  }

  return getMockPriceQuote(normalizedSymbol);
}
