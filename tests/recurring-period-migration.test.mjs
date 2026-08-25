import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20260825_recurring_period_pay_cycle.sql",
  import.meta.url,
);

test("the stamped period comes from the pay cycle, not the payment month", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  // The old bug: v_period := date_trunc('month', v_today).
  assert.doesNotMatch(sql, /v_period\s*:?=\s*date_trunc\('month',\s*v_today\)/);

  // The cycle opens on the 25th and runs a month minus a day.
  assert.match(sql, /make_date\([\s\S]*?25\s*\)/);
  assert.match(sql, /interval '1 month' - interval '1 day'/);

  // The period is the month the occurrence falls in.
  assert.match(sql, /v_period\s*:=\s*v_month_start/);
  assert.match(sql, /v_occurrence_date\s*:=\s*v_candidate/);
});

test("short months clamp the due day the same way the client does", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.match(sql, /least\(v_commitment\.due_day,\s*v_last_day\)/);
  assert.match(sql, /between v_cycle_start and v_cycle_end/);
});

test("auto-deduct waits for the occurrence, manual payment does not", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.match(sql, /p_mode = 'auto'\s+and v_today < v_occurrence_date/);
  assert.match(sql, /commitment is not due yet/);
});

test("the migration stays idempotent and owner-scoped", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.match(
    sql,
    /on conflict \(user_id, recurring_commitment_id, recurring_period\)/,
  );
  assert.match(sql, /do nothing/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /raise exception 'authentication required'/);
  assert.match(sql, /revoke all on function[\s\S]*?from anon/);
  assert.match(sql, /grant execute on function[\s\S]*?to authenticated/);
});

test("existing payment history is never rewritten", async () => {
  const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

  assert.doesNotMatch(sql, /update\s+public\.expenses/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.expenses/);
  assert.doesNotMatch(sql, /drop\s+(table|column)/);
});
