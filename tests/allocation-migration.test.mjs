import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { allocationCollections } from "../src/lib/allocation-store.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260825_allocation_portfolio_tables.sql",
  import.meta.url,
);

async function readMigration() {
  return (await readFile(migrationUrl, "utf8")).toLowerCase();
}

test("every table the store writes to is actually created", async () => {
  const sql = await readMigration();

  for (const spec of Object.values(allocationCollections)) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${spec.table}\\b`),
      `${spec.table} is missing from the migration`,
    );
  }
});

test("rows are owned, and the primary key is scoped to the owner", async () => {
  const sql = await readMigration();
  const owners = sql.match(
    /user_id uuid not null references auth\.users\(id\) on delete cascade/g,
  );
  const keys = sql.match(/primary key \(user_id, id\)/g);

  assert.equal(owners?.length, 7);
  assert.equal(keys?.length, 7);
});

test("identifiers stay text so existing client-minted ids keep working", async () => {
  const sql = await readMigration();

  // Ids like 'asset-btc' and 'template-default-50-30-20' are not uuids.
  assert.match(sql, /id text not null/);
  assert.doesNotMatch(sql, /^\s*id uuid/m);
});

test("row level security is enabled with owner-only policies", async () => {
  const sql = await readMigration();

  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /array\['select', 'insert', 'update', 'delete'\]/);
  assert.match(sql, /with check \(auth\.uid\(\) = user_id\)/);
});

test("anonymous access is revoked and only authenticated users are granted", async () => {
  const sql = await readMigration();

  assert.match(sql, /revoke all on table public\.%i from anon/);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.%i to authenticated/,
  );
});

test("a transaction can only be a buy or a sell", async () => {
  const sql = await readMigration();

  assert.match(sql, /check \(type in \('buy', 'sell'\)\)/);
});

test("the migration is re-runnable and destroys nothing", async () => {
  const sql = await readMigration();

  assert.match(sql, /create table if not exists/);
  assert.match(sql, /create index if not exists/);
  assert.doesNotMatch(sql, /drop table/);
  assert.doesNotMatch(sql, /drop column/);
  assert.doesNotMatch(sql, /truncate/);
});
