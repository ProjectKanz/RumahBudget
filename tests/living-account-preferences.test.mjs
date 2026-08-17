import assert from "node:assert/strict";
import test from "node:test";

import {
  getLivingAccountStorageKey,
  parseLivingAccountIds,
  updateLivingAccountPreference,
} from "../src/lib/living-account-preferences.ts";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("Supabase UUID arrays are normalized and deduplicated", () => {
  assert.deepEqual(
    parseLivingAccountIds([firstId, secondId, firstId]),
    [firstId, secondId],
  );
});

test("localStorage JSON arrays use the same parser", () => {
  assert.deepEqual(
    parseLivingAccountIds(JSON.stringify([secondId, firstId])),
    [secondId, firstId],
  );
});

test("malformed or mixed preference values fail closed", () => {
  assert.deepEqual(parseLivingAccountIds("not-json"), []);
  assert.deepEqual(parseLivingAccountIds([firstId, "not-an-account-id"]), []);
  assert.deepEqual(parseLivingAccountIds({ account: firstId }), []);
});

test("local fallback keys are scoped to a non-empty user", () => {
  assert.equal(
    getLivingAccountStorageKey("user-a"),
    "rumahbudget.livingAccountIds.user-a",
  );
  assert.throws(
    () => getLivingAccountStorageKey("  "),
    /User ID is required/,
  );
});

test("existing report preferences are updated without an insert payload", async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const query = {
    update(values) {
      calls.push(["update", values]);
      return {
        eq(column, value) {
          calls.push(["eq", column, value]);
          return {
            abortSignal(receivedSignal) {
              calls.push(["abortSignal", receivedSignal]);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const result = await updateLivingAccountPreference(query, {
    livingAccountIds: [firstId, secondId],
    signal,
    updatedAt: "2026-08-17T13:30:00.000Z",
    userId: "user-a",
  });

  assert.deepEqual(result, { error: null });
  assert.deepEqual(calls, [
    [
      "update",
      {
        living_account_ids: [firstId, secondId],
        updated_at: "2026-08-17T13:30:00.000Z",
      },
    ],
    ["eq", "user_id", "user-a"],
    ["abortSignal", signal],
  ]);
});
