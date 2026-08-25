import {
  buildYahooChartUrl,
  isIdxSymbol,
  normalizeIdxSymbol,
  parseYahooChartPayload,
} from "@/src/lib/idx-market";

export const dynamic = "force-dynamic";

type CoinGeckoSimplePriceResponse = {
  bitcoin?: {
    idr?: number;
    last_updated_at?: number;
  };
};

const IDX_LIMITATION =
  "Delayed IDX close/last price via Yahoo Finance, an unofficial endpoint. Not real-time, not guaranteed, and not financial advice. Use a manual price if it disagrees with your broker.";

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function fetchBitcoinQuote() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr&include_last_updated_at=true",
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        message: `CoinGecko request failed with status ${response.status}. Use manual price if this persists.`,
      },
      502,
    );
  }

  const data = (await response.json()) as CoinGeckoSimplePriceResponse;
  const price = Number(data.bitcoin?.idr ?? 0);

  if (!Number.isFinite(price) || price <= 0) {
    return jsonResponse(
      { ok: false, message: "CoinGecko returned an invalid BTC/IDR price." },
      502,
    );
  }

  return jsonResponse({
    ok: true,
    quote: {
      symbol: "BTC",
      price,
      currency: "IDR",
      source: "coingecko",
      timestamp: data.bitcoin?.last_updated_at
        ? data.bitcoin.last_updated_at * 1000
        : Date.now(),
      limitation:
        "BTC/IDR latest price from CoinGecko public endpoint. Not guaranteed real-time, not financial advice.",
    },
  });
}

/**
 * IDX equities are looked up server-side so no third-party request is made from
 * the browser and no key is ever exposed. The symbol is pattern-checked in
 * buildYahooChartUrl before it reaches the URL.
 */
async function fetchIdxQuote(symbol: string) {
  const url = buildYahooChartUrl(symbol);
  if (!url) {
    return jsonResponse(
      { ok: false, message: "That is not a valid IDX ticker." },
      400,
    );
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      // Yahoo rejects requests without a browser-like agent.
      "User-Agent": "Mozilla/5.0 (compatible; RumahBudget/1.0)",
    },
  });

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        message:
          response.status === 429
            ? "Market data provider is rate limiting right now. Try again shortly or enter a manual price."
            : `Market data request failed with status ${response.status}. Enter a manual price if this persists.`,
      },
      502,
    );
  }

  const parsed = parseYahooChartPayload(await response.json());
  if (!parsed.ok) {
    return jsonResponse({ ok: false, message: parsed.message }, 502);
  }

  return jsonResponse({
    ok: true,
    quote: {
      symbol: normalizeIdxSymbol(symbol),
      price: parsed.price,
      currency: parsed.currency,
      source: "idx",
      timestamp: parsed.timestamp,
      limitation: IDX_LIMITATION,
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = normalizeIdxSymbol(url.searchParams.get("symbol") ?? "");

  if (!symbol) {
    return jsonResponse(
      { ok: false, message: "Missing symbol query parameter." },
      400,
    );
  }

  try {
    if (symbol === "BTC") {
      return await fetchBitcoinQuote();
    }

    if (isIdxSymbol(symbol)) {
      return await fetchIdxQuote(symbol);
    }

    return jsonResponse(
      {
        ok: false,
        message:
          "Only BTC and IDX equity tickers are supported by this route. Use a manual price for anything else.",
      },
      400,
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Failed to reach the price provider. Use a manual price.",
      },
      502,
    );
  }
}
