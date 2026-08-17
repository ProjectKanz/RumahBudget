import assert from "node:assert/strict";
import test from "node:test";

import {
  getLivingAccountStorageKey,
  parseLivingAccountIds,
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
