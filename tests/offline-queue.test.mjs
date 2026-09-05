import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfflineQueueInsert,
  createOfflineQueueItem,
  parseOfflineQueue,
  getUserOfflineQueueStorageKey,
  removeSyncedOfflineQueueItems,
  syncUserOfflineQueue,
} from "../src/lib/offline-queue.ts";

function expenseItem({ id, userId, createdAt, budgetLineId }) {
  return createOfflineQueueItem({
    id,
    userId,
    type: "expense",
    data: {
      accountId: "bank",
      affectsDailyAllowance: false,
      amount: 25_000,
      ...(budgetLineId === undefined ? {} : { budgetLineId }),
      category: "Groceries",
      createdAt,
      description: "Rice and vegetables",
      note: "Offline purchase",
      paymentMethod: "Cash",
    },
  });
}

test("offline queue storage keys are scoped per user", () => {
  assert.notEqual(
    getUserOfflineQueueStorageKey("user-a"),
    getUserOfflineQueueStorageKey("user-b"),
  );
});

test("offline inserts retain the original transaction timestamp", () => {
  const createdAt = new Date(2026, 7, 31, 23, 55).getTime();
  const item = expenseItem({ id: "item-1", userId: "user-a", createdAt });
  const insert = buildOfflineQueueInsert(item, "user-a", "owner@example.com");

  assert.equal(insert.table, "expenses");
  assert.equal(insert.values.created_at, new Date(createdAt).toISOString());
  assert.equal(insert.values.client_entry_id, "item-1");
  assert.equal(insert.values.description, "Rice and vegetables");
  assert.equal(insert.values.affects_daily_allowance, false);
  assert.equal(insert.values.transaction_date, "2026-08-31");
  assert.equal(insert.values.user_id, "user-a");
});

test("income and transfer inserts also retain their local transaction date", () => {
  const createdAt = new Date(2026, 8, 1, 0, 5).getTime();
  const income = createOfflineQueueItem({
    id: "income-1",
    userId: "user-a",
    type: "income",
    data: {
      accountId: "bank",
      affectsDailyAllowance: false,
      amount: 100_000,
      createdAt,
      note: "",
      source: "Salary",
    },
  });
  const transfer = createOfflineQueueItem({
    id: "transfer-1",
    userId: "user-a",
    type: "transfer",
    data: {
      affectsDailyAllowance: false,
      amount: 50_000,
      createdAt,
      fromAccountId: "bank",
      note: "",
      toAccountId: "cash",
    },
  });

  assert.equal(
    buildOfflineQueueInsert(income, "user-a", "owner@example.com").values
      .transaction_date,
    "2026-09-01",
  );
  assert.equal(
    buildOfflineQueueInsert(income, "user-a", "owner@example.com").values
      .affects_daily_allowance,
    false,
  );
  assert.equal(
    buildOfflineQueueInsert(transfer, "user-a", null).values.transaction_date,
    "2026-09-01",
  );
  assert.equal(
    buildOfflineQueueInsert(transfer, "user-a", null).values
      .affects_daily_allowance,
    false,
  );
});

test("offline inserts reject queue items owned by another user", () => {
  const item = expenseItem({
    id: "item-1",
    userId: "user-a",
    createdAt: Date.now(),
  });

  assert.throws(
    () => buildOfflineQueueInsert(item, "user-b", "owner@example.com"),
    /different user/,
  );
});

test("sync removes successful items but retains failures and other-user items", async () => {
  const items = [
    expenseItem({ id: "success", userId: "user-a", createdAt: 1 }),
    expenseItem({ id: "failure", userId: "user-a", createdAt: 2 }),
    expenseItem({ id: "other-user", userId: "user-b", createdAt: 3 }),
  ];
  const attemptedIds = [];

  const result = await syncUserOfflineQueue({
    items,
    userId: "user-a",
    syncItem: async (item) => {
      attemptedIds.push(item.id);
      return item.id === "success";
    },
  });

  assert.deepEqual(attemptedIds, ["success", "failure"]);
  assert.deepEqual(
    result.remainingItems.map((item) => item.id),
    ["failure", "other-user"],
  );
  assert.deepEqual(
    {
      failedCount: result.failedCount,
      skippedOtherUserCount: result.skippedOtherUserCount,
      syncedCount: result.syncedCount,
    },
    { failedCount: 1, skippedOtherUserCount: 1, syncedCount: 1 },
  );
});

test("sync retains an item when its insert throws", async () => {
  const item = expenseItem({
    id: "throws",
    userId: "user-a",
    createdAt: Date.now(),
  });
  const result = await syncUserOfflineQueue({
    items: [item],
    userId: "user-a",
    syncItem: async () => {
      throw new Error("network unavailable");
    },
  });

  assert.deepEqual(result.remainingItems, [item]);
  assert.equal(result.failedCount, 1);
});

test("sync completion removes only confirmed IDs from the latest queue", async () => {
  const synced = expenseItem({ id: "synced", userId: "user-a", createdAt: 1 });
  const failed = expenseItem({ id: "failed", userId: "user-a", createdAt: 2 });
  const addedDuringSync = expenseItem({
    id: "new-during-sync",
    userId: "user-a",
    createdAt: 3,
  });

  const result = await syncUserOfflineQueue({
    items: [synced, failed],
    userId: "user-a",
    syncItem: async (item) => item.id === "synced",
  });
  const committedQueue = removeSyncedOfflineQueueItems(
    [synced, failed, addedDuringSync],
    result.syncedItemIds,
  );

  assert.deepEqual(
    committedQueue.map((item) => item.id),
    ["failed", "new-during-sync"],
  );
});

test("a budget line chosen offline survives the replay", () => {
  const createdAt = new Date(2026, 8, 5, 9, 30).getTime();
  const item = expenseItem({
    id: "item-budget",
    userId: "user-a",
    createdAt,
    budgetLineId: "line-food",
  });

  const insert = buildOfflineQueueInsert(item, "user-a", "owner@example.com");

  assert.equal(insert.values.budget_line_id, "line-food");
  // The classification must not disturb anything else about the entry.
  assert.equal(insert.values.amount, 25_000);
  assert.equal(insert.values.category, "Groceries");
  assert.equal(insert.values.transaction_date, "2026-09-05");
});

test("an unclassified offline expense replays as null, never as a string", () => {
  const item = expenseItem({
    id: "item-plain",
    userId: "user-a",
    createdAt: Date.now(),
  });

  const insert = buildOfflineQueueInsert(item, "user-a", "owner@example.com");

  // Items queued before Rencana Uang existed carry no field at all; they must
  // still replay cleanly rather than writing undefined or "".
  assert.equal(insert.values.budget_line_id, null);
});

test("queue items without a budget line still parse after the field was added", () => {
  const legacy = JSON.stringify([
    {
      id: "legacy-1",
      userId: "user-a",
      type: "expense",
      data: {
        accountId: "bank",
        affectsDailyAllowance: true,
        amount: 10_000,
        category: "Other",
        createdAt: new Date(2026, 7, 1, 12, 0).getTime(),
        description: "Legacy entry",
        note: "",
        paymentMethod: "Cash",
      },
    },
  ]);

  const parsed = parseOfflineQueue(legacy);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].data.budgetLineId, undefined);
});
