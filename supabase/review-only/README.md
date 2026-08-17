# Review-only database changes

There are no pending review-only SQL changes.

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
