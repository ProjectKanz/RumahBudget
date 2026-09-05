import assert from "node:assert/strict";
import test from "node:test";

import {
  BUDGET_LINE_CONFLICT_TARGET,
  INITIAL_BUDGET_LINES,
  buildBudgetLineSeedRows,
  getAssignableBudgetLines,
  isAssignableBudgetLineId,
  mapBudgetLineRow,
} from "../src/lib/budget-line-store.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

test("the seed ships exactly nine lines with the expected keys", () => {
  assert.equal(INITIAL_BUDGET_LINES.length, 9);
  assert.deepEqual(
    INITIAL_BUDGET_LINES.map((line) => line.key),
    [
      "food",
      "social_treats",
      "vape",
      "laundry",
      "toiletries",
      "water",
      "fuel",
      "fixed_commitments",
      "unplanned",
    ],
  );
});

test("seed keys are unique, so the upsert conflict target can never collide", () => {
  const keys = INITIAL_BUDGET_LINES.map((line) => line.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("keys stay machine-stable while names carry the display text", () => {
  const byKey = new Map(
    INITIAL_BUDGET_LINES.map((line) => [line.key, line.name]),
  );

  // The key is the reference; renaming a display name must never need a data fix.
  assert.equal(byKey.get("social_treats"), "Nongkrong & Jajan");
  assert.equal(byKey.get("fixed_commitments"), "Fixed Commitments");
  assert.equal(byKey.get("food"), "Food");

  INITIAL_BUDGET_LINES.forEach((line) => {
    assert.match(line.key, /^[a-z][a-z0-9_]*$/, `${line.key} must match the DB check`);
    assert.equal(line.name.trim(), line.name);
    assert.ok(line.name.length > 0);
  });
});

test("every seeded line is a spending line in this slice", () => {
  INITIAL_BUDGET_LINES.forEach((line) => {
    assert.equal(line.kind, "spending", `${line.key} must be assignable`);
  });
});

test("seed row construction is deterministic and carries no generated id", () => {
  const first = buildBudgetLineSeedRows(USER_ID);
  const second = buildBudgetLineSeedRows(USER_ID);

  assert.deepEqual(first, second);
  assert.equal(first.length, 9);
  first.forEach((row) => {
    assert.equal(row.user_id, USER_ID);
    assert.equal("id" in row, false, "an id would break the idempotent upsert");
  });
  assert.equal(BUDGET_LINE_CONFLICT_TARGET, "user_id,key");
});

test("seed rows carry no duplicate (user_id, key) pair", () => {
  const rows = buildBudgetLineSeedRows(USER_ID);
  const pairs = rows.map((row) => `${row.user_id}:${row.key}`);
  assert.equal(new Set(pairs).size, rows.length);
});

test("rows map with safe fallbacks and an unknown kind never becomes assignable", () => {
  const mapped = mapBudgetLineRow(
    {
      created_at: "2026-09-04T00:00:00.000Z",
      id: "line-1",
      is_archived: false,
      key: "food",
      kind: "spending",
      name: "Food",
      sort_order: 10,
      updated_at: "2026-09-04T00:00:00.000Z",
      user_id: USER_ID,
    },
    USER_ID,
  );
  assert.equal(mapped.key, "food");
  assert.equal(mapped.kind, "spending");
  assert.equal(mapped.sortOrder, 10);
  assert.ok(mapped.createdAt > 0);

  const garbage = mapBudgetLineRow({ kind: "nonsense" }, USER_ID);
  assert.equal(garbage.kind, "spending");
  assert.equal(garbage.name, "Untitled budget line");
  assert.equal(garbage.userId, USER_ID);
});

test("only active spending lines are assignable, sorted by sort order", () => {
  const lines = [
    { id: "b", key: "water", kind: "spending", name: "Water", sortOrder: 60, isArchived: false, userId: USER_ID, createdAt: 0, updatedAt: 0 },
    { id: "a", key: "food", kind: "spending", name: "Food", sortOrder: 10, isArchived: false, userId: USER_ID, createdAt: 0, updatedAt: 0 },
    { id: "c", key: "vape", kind: "spending", name: "Vape", sortOrder: 30, isArchived: true, userId: USER_ID, createdAt: 0, updatedAt: 0 },
    { id: "d", key: "emergency", kind: "reserve", name: "Emergency", sortOrder: 20, isArchived: false, userId: USER_ID, createdAt: 0, updatedAt: 0 },
  ];

  assert.deepEqual(
    getAssignableBudgetLines(lines).map((line) => line.id),
    ["a", "b"],
  );
  // Reserve exists for V2.3 but must fail closed until then.
  assert.equal(isAssignableBudgetLineId(lines, "d"), false);
  assert.equal(isAssignableBudgetLineId(lines, "c"), false);
  assert.equal(isAssignableBudgetLineId(lines, "a"), true);
});
