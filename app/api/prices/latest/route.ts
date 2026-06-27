export const dynamic = "force-dynamic";

type CoinGeckoSimplePriceResponse = {
  bitcoin?: {
    idr?: number;
    last_updated_at?: number;
  };
};

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();

  if (!symbol) {
    return jsonResponse(
      { ok: false, message: "Missing symbol query parameter." },
      400,
    );
  }

  if (symbol !== "BTC") {
    return jsonResponse(
      {
        ok: false,
        message:
          "Only BTC latest price is supported in the safe V3 provider. BBCA/BBRI require a reliable licensed market-data provider and remain manual for now.",
      },
      400,
    );
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr&include_last_updated_at=true",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
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
        {
          ok: false,
          message: "CoinGecko returned an invalid BTC/IDR price.",
        },
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
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Failed to fetch BTC price. Use manual price or mock price.",
      },
      502,
    );
  }
}
