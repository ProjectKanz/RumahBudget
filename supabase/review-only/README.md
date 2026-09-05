# Review-only database changes

There are no pending review-only SQL changes.

The following migration was applied to the production `rumahbudget` project
through the Supabase SQL editor on 2026-09-04 and is versioned under
`supabase/migrations`:

1. `20260904_budget_lines.sql`
   - Adds `public.budget_lines` (planning labels for Rencana Uang) with a
     `UNIQUE (user_id, key)` index that makes the client-side seed idempotent.
   - Adds the nullable `expenses.budget_line_id` with
     `ON DELETE RESTRICT`, so an existing expense reads as Uncategorized and
     archiving is preferred over deleting a referenced line.
   - Adds the `expenses_validate_budget_line` trigger, which only runs when the
     classification itself changes and rejects any line that is not an active,
     owner-scoped `spending` line. Reserve lines exist for a later slice and are
     not assignable yet.
   - Additive only. No existing row was updated or backfilled.

Pre-migration baseline recorded 172 expense rows table-wide totalling
11,048,059, plus 39 incomes, 15 transfers, 17 money accounts and 11 trading
results. That table total breaks down as 171 owner-scoped rows totalling
10,998,059, one legacy row with a null `user_id` totalling 50,000, and no rows
belonging to any other user. Counts quoted below are table-wide unless they say
owner-scoped; the two differ only by that legacy row, which the 2026-08-13 note
records as deliberately preserved.

Post-migration verification on 2026-09-04 confirmed through
`information_schema.columns`, `pg_constraint`, `pg_trigger` and `pg_policies`:
`budget_line_id` is `YES / uuid`, the foreign key
`expenses_budget_line_id_fkey` carries `ON DELETE RESTRICT`, the validation
trigger is enabled, and four owner-scoped policies exist on `budget_lines`
(SELECT, INSERT, UPDATE, DELETE). Expense row count, total expense amount and
every other ledger table count were unchanged, and all 172 expense rows kept a
null `budget_line_id`.

Seed and reclassification were verified on 2026-09-05 against the local
development build. The application path created exactly nine spending lines
(`food`, `social_treats`, `vape`, `laundry`, `toiletries`, `water`, `fuel`,
`fixed_commitments`, `unplanned`) with no duplicate `(user_id, key)`, and a
second load added no rows and left `created_at` untouched. A single recent
expense was reclassified to `Food` and cleared back to Uncategorized through the
application UI; amount, transaction date, account, category, description, note
and payment method were byte-identical throughout, the 171 owner-scoped expense
rows and their 172-row table total both held steady, account balances for all
seven active accounts were unchanged, and the Daily Allowance figure on screen
did not move. An earlier service-role seed of the same nine rows was removed
before this verification so the application path could be tested from an empty
table; the delete was scoped to the owner's `user_id` and the nine known seed
keys, and was guarded by a check that no expense referenced them.

The following migration was applied to the production `rumahbudget` project
and moved to `supabase/migrations` on 2026-08-17:

1. `20260817_living_account_preferences.sql`
   - Adds `report_preferences.living_account_ids` as a non-null UUID array.
   - Supports Supabase-backed account selection for the daily allowance card.

Post-migration verification through `information_schema.columns` confirmed one
matching column with data type `ARRAY`, `is_nullable = NO`, and default
`'{}'::uuid[]`.

The following migrations were applied to production in the required order on
2026-08-13 and are now versioned under `supabase/migrations`:

1. `20260813_ledger_v2.sql`
2. `20260813_recurring_commitment_idempotency.sql`

Post-migration verification confirmed the required columns, indexes, owner-
scoped update policies, authenticated recurring RPC access, and unchanged row
counts for expenses, incomes, and transfers.

Production inspection on 2026-08-13 found four legacy rows with a null
`user_id` (one expense and three incomes). They cannot be inferred safely from
an account owner or matching authentication email. The migrations preserved
them unchanged; a private UI-level export is stored outside the repository for
manual review. Do not auto-assign or delete these rows.
