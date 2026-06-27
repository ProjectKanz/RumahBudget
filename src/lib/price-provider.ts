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
  const normalizedSymbol = symbol.trim().toUpperCase();
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

export async function fetchLatestPrice(symbol: string): Promise<PriceProviderResult> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (normalizedSymbol === "BTC") {
    try {
      const response = await fetch(`/api/prices/latest?symbol=${encodeURIComponent(normalizedSymbol)}`, {
        method: "GET",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        return {
          ok: false,
          message: payload?.message ?? "Latest price provider failed.",
          source: "coingecko",
        };
      }

      return {
        ok: true,
        quote: payload.quote as PriceQuote,
      };
    } catch {
      return {
        ok: false,
        message: "Could not reach latest price route. Use manual price or mock price.",
        source: "coingecko",
      };
    }
  }

  if (normalizedSymbol === "BBCA" || normalizedSymbol === "BBRI") {
    return {
      ok: false,
      message:
        "Live IDX stock prices are not enabled. Use manual price for BBCA/BBRI until a reliable licensed market-data provider is selected.",
      source: "unsupported",
    };
  }

  return getMockPriceQuote(normalizedSymbol);
}
