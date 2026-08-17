-- Stores the user's selected spending accounts for the daily allowance card.

alter table public.report_preferences
  add column if not exists living_account_ids uuid[] not null default '{}'::uuid[];
