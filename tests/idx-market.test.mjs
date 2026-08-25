import assert from "node:assert/strict";
import test from "node:test";

import {
  SHARES_PER_LOT,
  buildYahooChartUrl,
  isIdxSymbol,
  isLotTraded,
  lotsToShares,
  parseLotInput,
  parseYahooChartPayload,
  sharesToLots,
} from "../src/lib/idx-market.ts";

function chartPayload(meta) {
  return { chart: { error: null, result: [{ meta }] } };
}

test("a ticker becomes a Jakarta-listed symbol", () => {
  assert.equal(
    buildYahooChartUrl("bbca"),
    "https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=1d",
  );
  assert.equal(
    buildYahooChartUrl("  BBRI "),
    "https://query1.finance.yahoo.com/v8/finance/chart/BBRI.JK?interval=1d&range=1d",
  );
});

test("anything that is not a plain ticker is refused before it reaches a URL", () => {
  assert.equal(buildYahooChartUrl(""), null);
  assert.equal(buildYahooChartUrl("BBCA.JK"), null);
  assert.equal(buildYahooChartUrl("../../etc/passwd"), null);
  assert.equal(buildYahooChartUrl("BBCA?a=b"), null);
  assert.equal(buildYahooChartUrl("BBCA/../BBRI"), null);
  assert.equal(buildYahooChartUrl("TOOLONGSYMBOL"), null);
  assert.equal(buildYahooChartUrl("1BCA"), null);
  assert.equal(isIdxSymbol("BBCA"), true);
  assert.equal(isIdxSymbol("bb ca"), false);
});

test("a normal quote yields price, currency, and market time", () => {
  const result = parseYahooChartPayload(
    chartPayload({
      currency: "IDR",
      regularMarketPrice: 9_675,
      regularMarketTime: 1_756_100_000,
      symbol: "BBCA.JK",
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.price, 9_675);
  assert.equal(result.currency, "IDR");
  assert.equal(result.timestamp, 1_756_100_000_000);
});

test("a quote in another currency is refused rather than mixed in", () => {
  const result = parseYahooChartPayload(
    chartPayload({ currency: "USD", regularMarketPrice: 12.5 }),
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /USD/);
});

test("a well-formed response with no usable price fails closed", () => {
  // A delisted or mistyped ticker answers like this. Reporting 0 would wipe out
  // the holding's valuation.
  assert.equal(
    parseYahooChartPayload(chartPayload({ currency: "IDR" })).ok,
    false,
  );
  assert.equal(
    parseYahooChartPayload(
      chartPayload({ currency: "IDR", regularMarketPrice: 0 }),
    ).ok,
    false,
  );
  assert.equal(
    parseYahooChartPayload(
      chartPayload({ currency: "IDR", regularMarketPrice: "n/a" }),
    ).ok,
    false,
  );
});

test("a provider error is surfaced with its own description", () => {
  const result = parseYahooChartPayload({
    chart: { error: { code: "Not Found", description: "No data found, symbol may be delisted" }, result: null },
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /delisted/);
});

test("junk bodies do not throw", () => {
  for (const payload of [null, undefined, "", 42, [], {}, { chart: {} }]) {
    const result = parseYahooChartPayload(payload);
    assert.equal(result.ok, false);
    assert.equal(typeof result.message, "string");
  }
});

test("a missing market time falls back to now instead of 1970", () => {
  const before = Date.now();
  const result = parseYahooChartPayload(
    chartPayload({ currency: "IDR", regularMarketPrice: 4_310 }),
  );

  assert.equal(result.ok, true);
  assert.ok(result.timestamp >= before);
});

test("one lot is one hundred shares", () => {
  assert.equal(SHARES_PER_LOT, 100);
  assert.equal(lotsToShares(10), 1_000);
  assert.equal(sharesToLots(1_000), 10);
  assert.deepEqual(parseLotInput("10"), { lots: 10, ok: true, shares: 1_000 });
});

test("lots must be whole and positive", () => {
  // Entering "10" meaning shares instead of lots is a 100x error, so partial
  // lots are refused rather than quietly accepted.
  assert.equal(parseLotInput("2.5").ok, false);
  assert.equal(parseLotInput("0").ok, false);
  assert.equal(parseLotInput("-3").ok, false);
  assert.equal(parseLotInput("").ok, false);
  assert.equal(parseLotInput("abc").ok, false);
});

test("only IDR-quoted stocks are traded in lots", () => {
  assert.equal(isLotTraded({ currency: "IDR", type: "stock" }), true);
  assert.equal(isLotTraded({ currency: "IDR", type: "crypto" }), false);
  assert.equal(isLotTraded({ currency: "USD", type: "stock" }), false);
  assert.equal(isLotTraded({}), false);
});
