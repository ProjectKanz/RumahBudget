import assert from "node:assert/strict";
import test from "node:test";

import {
  allocationCollections,
  getRemovedIds,
  hasStoredContent,
  loadAllocationState,
  saveAllocationState,
} from "../src/lib/allocation-store.ts";

const userId = "11111111-2222-4333-8444-555555555555";

function emptyState(overrides = {}) {
  return {
    allocationRecords: [],
    assets: [],
    buckets: [],
    incomeRecords: [],
    investmentTransactions: [],
    priceSnapshots: [],
    templates: [],
    ...overrides,
  };
}

function fakeClient({ rows = {}, failOn = null } = {}) {
  const calls = { deletes: [], selects: [], upserts: [] };

  const client = {
    calls,
    from(table) {
      return {
        select: (columns) => ({
          eq: async (column, value) => {
            calls.selects.push({ column, columns, table, value });
            if (failOn?.table === table && failOn.op === "select") {
              return { data: null, error: { message: failOn.message } };
            }
            return { data: rows[table] ?? [], error: null };
          },
        }),
        upsert: async (upsertRows, options) => {
          calls.upserts.push({ options, rows: upsertRows, table });
          if (failOn?.table === table && failOn.op === "upsert") {
            return { data: null, error: { message: failOn.message } };
          }
          return { data: null, error: null };
        },
        delete: () => ({
          eq: (column, value) => ({
            in: async (idColumn, values) => {
              calls.deletes.push({ column, idColumn, table, value, values });
              return { data: null, error: null };
            },
          }),
        }),
      };
    },
  };

  return client;
}

test("an account with nothing stored reports empty rather than failing", async () => {
  const result = await loadAllocationState(fakeClient(), userId);

  assert.equal(result.ok, true);
  assert.equal(result.isEmpty, true);
  assert.deepEqual(result.state.buckets, []);
  assert.deepEqual(result.state.investmentTransactions, []);
});

test("stored rows are mapped back into portfolio shapes", async () => {
  const client = fakeClient({
    rows: {
      allocation_assets: [
        {
          currency: "IDR",
          id: "asset-bbca",
          name: "Bank Central Asia Tbk",
          price_provider: "manual",
          symbol: "BBCA",
          type: "stock",
          user_id: userId,
        },
      ],
      allocation_investment_transactions: [
        {
          amount_idr: 9_500_000,
          asset_id: "asset-bbca",
          created_at: 1_756_000_000_000,
          date: "2026-08-20",
          fee: 14_250,
          id: "tx-1",
          note: "",
          price: 9_500,
          quantity: 1_000,
          source_bucket_id: "investment-cash",
          type: "buy",
          user_id: userId,
        },
      ],
      allocation_price_snapshots: [
        {
          asset_id: "asset-bbca",
          captured_at: 1_756_100_000_000,
          currency: "IDR",
          id: "price-1",
          is_manual: false,
          price: 9_700,
          source: "manual",
          user_id: userId,
        },
      ],
    },
  });

  const result = await loadAllocationState(client, userId);

  assert.equal(result.ok, true);
  assert.equal(result.isEmpty, false);
  assert.equal(result.state.assets[0].symbol, "BBCA");
  assert.equal(result.state.investmentTransactions[0].amountIdr, 9_500_000);
  assert.equal(result.state.investmentTransactions[0].quantity, 1_000);
  assert.equal(result.state.investmentTransactions[0].type, "buy");
  // captured_at is exposed as `timestamp`, the name the holdings maths expects.
  assert.equal(result.state.priceSnapshots[0].timestamp, 1_756_100_000_000);
  assert.equal(result.state.priceSnapshots[0].isManual, false);
});

test("a load failure surfaces the message instead of showing empty data", async () => {
  const client = fakeClient({
    failOn: { message: "permission denied", op: "select", table: "allocation_buckets" },
  });

  const result = await loadAllocationState(client, userId);

  assert.equal(result.ok, false);
  assert.equal(result.message, "permission denied");
});

test("every written row is stamped with the signed-in user", async () => {
  const state = emptyState({
    buckets: [
      {
        createdAt: 1,
        id: "investment-cash",
        name: "Investment Cash",
        type: "investment_cash",
        updatedAt: 2,
        userId: "someone-else",
      },
    ],
  });

  const client = fakeClient();
  const result = await saveAllocationState(client, userId, state);

  assert.equal(result.ok, true);
  const bucketUpsert = client.calls.upserts.find(
    (call) => call.table === "allocation_buckets",
  );
  // The row's own userId is never trusted; the session's id is written.
  assert.equal(bucketUpsert.rows[0].user_id, userId);
  assert.equal(bucketUpsert.options.onConflict, "user_id,id");
});

test("rows dropped locally are removed remotely, and nothing else is", async () => {
  const state = emptyState({
    assets: [
      {
        currency: "IDR",
        id: "asset-bbca",
        name: "BCA",
        symbol: "BBCA",
        type: "stock",
        userId,
      },
    ],
  });

  const client = fakeClient({
    rows: {
      allocation_assets: [
        { id: "asset-bbca", user_id: userId },
        { id: "asset-stale", user_id: userId },
      ],
    },
  });

  const result = await saveAllocationState(client, userId, state);

  assert.equal(result.ok, true);
  const assetDelete = client.calls.deletes.find(
    (call) => call.table === "allocation_assets",
  );
  assert.deepEqual(assetDelete.values, ["asset-stale"]);
  assert.equal(assetDelete.value, userId);
});

test("an empty collection still prunes what the account used to hold", async () => {
  const client = fakeClient({
    rows: { allocation_records: [{ id: "allocation-old", user_id: userId }] },
  });

  await saveAllocationState(client, userId, emptyState());

  const pruned = client.calls.deletes.find(
    (call) => call.table === "allocation_records",
  );
  assert.deepEqual(pruned.values, ["allocation-old"]);
  // Nothing to upsert, so no write was attempted for that table.
  assert.equal(
    client.calls.upserts.some((call) => call.table === "allocation_records"),
    false,
  );
});

test("a failed write stops the sync and reports why", async () => {
  const state = emptyState({
    buckets: [{ createdAt: 1, id: "living", name: "Living", type: "living", updatedAt: 1, userId }],
  });
  const client = fakeClient({
    failOn: { message: "row level security", op: "upsert", table: "allocation_buckets" },
  });

  const result = await saveAllocationState(client, userId, state);

  assert.equal(result.ok, false);
  assert.equal(result.message, "row level security");
  // It stopped at the first table rather than continuing to delete elsewhere.
  assert.equal(client.calls.deletes.length, 0);
});

test("removed ids are the remote ones the client no longer holds", () => {
  assert.deepEqual(getRemovedIds(["a", "b", "c"], ["b"]), ["a", "c"]);
  assert.deepEqual(getRemovedIds([], ["b"]), []);
  assert.deepEqual(getRemovedIds(["a"], ["a"]), []);
  assert.deepEqual(getRemovedIds(["", "a"], []), ["a"]);
});

test("every collection maps to its own table exactly once", () => {
  const tables = Object.values(allocationCollections).map((spec) => spec.table);

  assert.equal(new Set(tables).size, tables.length);
  assert.equal(tables.length, 7);
  assert.ok(tables.every((table) => table.startsWith("allocation_")));
});

test("seeded defaults do not count as stored content", () => {
  const seeded = emptyState({
    buckets: [{ createdAt: 1, id: "living", name: "Living", type: "living", updatedAt: 1, userId }],
    assets: [{ currency: "IDR", id: "asset-btc", name: "Bitcoin", symbol: "BTC", type: "crypto", userId }],
    templates: [{ createdAt: 1, id: "template-a", isDefault: true, items: [], name: "Default", updatedAt: 1, userId }],
  });

  // Opening the app in a fresh browser must not look like a populated account.
  assert.equal(hasStoredContent(seeded), false);
});

test("a single recorded buy makes an account authoritative", () => {
  const withHoldings = emptyState({
    investmentTransactions: [
      {
        amountIdr: 9_500_000,
        assetId: "asset-bbca",
        createdAt: 1,
        date: "2026-08-20",
        fee: 0,
        id: "tx-1",
        note: "",
        price: 9_500,
        quantity: 1_000,
        type: "buy",
        userId,
      },
    ],
  });

  assert.equal(hasStoredContent(withHoldings), true);
  assert.equal(hasStoredContent(emptyState({ priceSnapshots: [{ id: "p" }] })), true);
  assert.equal(hasStoredContent(emptyState()), false);
});
