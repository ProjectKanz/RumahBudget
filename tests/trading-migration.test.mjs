import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260817_trading_segment.sql",
  import.meta.url,
);

test("Trading migration is transactional, owner-scoped, and fail-closed", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /account_purpose/);
  assert.match(sql, /check \(account_purpose in \('general', 'trading'\)\)/);
  assert.match(sql, /check \(net_amount <> 0\)/);
  assert.match(sql, /create unique index[^;]+source_income_id[^;]+where source_income_id is not null/s);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /validate_trading_result_account/);
  assert.match(sql, /v_exness_count <> 1/);
  assert.match(sql, /v_pre_total/);
  assert.match(sql, /v_post_total/);
  assert.match(sql, /v_pre_total is distinct from v_post_total/);
});

test("Trading migration preserves source income and transfer rows", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.doesNotMatch(sql, /delete\s+from\s+public\.incomes/);
  assert.doesNotMatch(sql, /update\s+public\.incomes/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.transfers/);
  assert.doesNotMatch(sql, /update\s+public\.transfers/);
  assert.match(sql, /on conflict \(source_income_id\) where source_income_id is not null do nothing/);
});
