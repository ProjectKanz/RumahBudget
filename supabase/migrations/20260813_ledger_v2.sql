-- REVIEW ONLY. Do not run without checking deployed column types, RLS,
-- backups, and a staging dry run. Move to supabase/migrations only after
-- explicit approval.

alter table public.expenses
  add column if not exists transaction_date date,
  add column if not exists description text,
  add column if not exists client_entry_id uuid;

alter table public.incomes
  add column if not exists transaction_date date,
  add column if not exists client_entry_id uuid;

alter table public.transfers
  add column if not exists transaction_date date,
  add column if not exists client_entry_id uuid;

update public.expenses
set transaction_date = timezone('Asia/Jakarta', created_at)::date
where transaction_date is null;

update public.incomes
set transaction_date = timezone('Asia/Jakarta', created_at)::date
where transaction_date is null;

update public.transfers
set transaction_date = timezone('Asia/Jakarta', created_at)::date
where transaction_date is null;

alter table public.expenses
  alter column transaction_date set default (timezone('Asia/Jakarta', now())::date),
  alter column transaction_date set not null;

alter table public.incomes
  alter column transaction_date set default (timezone('Asia/Jakarta', now())::date),
  alter column transaction_date set not null;

alter table public.transfers
  alter column transaction_date set default (timezone('Asia/Jakarta', now())::date),
  alter column transaction_date set not null;

create index if not exists expenses_user_transaction_date_idx
  on public.expenses (user_id, transaction_date desc);

create index if not exists incomes_user_transaction_date_idx
  on public.incomes (user_id, transaction_date desc);

create index if not exists transfers_user_transaction_date_idx
  on public.transfers (user_id, transaction_date desc);

create unique index if not exists expenses_user_client_entry_id_unique
  on public.expenses (user_id, client_entry_id);

create unique index if not exists incomes_user_client_entry_id_unique
  on public.incomes (user_id, client_entry_id);

create unique index if not exists transfers_user_client_entry_id_unique
  on public.transfers (user_id, client_entry_id);

-- Ledger V2 adds owner-scoped edit actions. Existing production policies only
-- cover SELECT, INSERT, and DELETE for these tables, so add UPDATE explicitly.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Users can update their own expenses'
  ) then
    create policy "Users can update their own expenses"
      on public.expenses
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'incomes'
      and policyname = 'Users can update their own incomes'
  ) then
    create policy "Users can update their own incomes"
      on public.incomes
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transfers'
      and policyname = 'Users can update their own transfers'
  ) then
    create policy "Users can update their own transfers"
      on public.transfers
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
