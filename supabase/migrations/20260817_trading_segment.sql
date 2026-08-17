begin;

alter table public.money_accounts
  add column if not exists account_purpose text not null default 'general';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.money_accounts'::regclass
      and conname = 'money_accounts_account_purpose_check'
  ) then
    alter table public.money_accounts
      add constraint money_accounts_account_purpose_check
      check (account_purpose in ('general', 'trading'));
  end if;
end
$$;

create table if not exists public.trading_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.money_accounts(id) on delete restrict,
  transaction_date date not null default (timezone('Asia/Jakarta', now())::date),
  net_amount numeric not null check (net_amount <> 0),
  note text not null default '',
  source_income_id uuid references public.incomes(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trading_results_user_transaction_date_idx
  on public.trading_results (user_id, transaction_date desc);

create index if not exists trading_results_account_transaction_date_idx
  on public.trading_results (account_id, transaction_date desc);

create unique index if not exists trading_results_source_income_unique
  on public.trading_results (source_income_id)
  where source_income_id is not null;

create or replace function public.validate_trading_result_account()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.money_accounts account
    where account.id = new.account_id
      and account.user_id = new.user_id
      and account.account_purpose = 'trading'
      and account.is_archived = false
  ) then
    raise exception 'Trading result requires an active owner-scoped trading account';
  end if;

  if new.source_income_id is not null and not exists (
    select 1
    from public.incomes income
    where income.id = new.source_income_id
      and income.user_id = new.user_id
      and income.account_id = new.account_id
      and income.amount = new.net_amount
      and new.net_amount > 0
  ) then
    raise exception 'Migrated trading result must exactly match its owner-scoped source income';
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trading_results_validate_account
  on public.trading_results;

create trigger trading_results_validate_account
before insert or update on public.trading_results
for each row execute function public.validate_trading_result_account();

alter table public.trading_results enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trading_results'
      and policyname = 'Users can view their own trading results'
  ) then
    create policy "Users can view their own trading results"
      on public.trading_results
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trading_results'
      and policyname = 'Users can create their own trading results'
  ) then
    create policy "Users can create their own trading results"
      on public.trading_results
      for insert
      to authenticated
      with check (auth.uid() = user_id and source_income_id is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trading_results'
      and policyname = 'Users can update their manual trading results'
  ) then
    create policy "Users can update their manual trading results"
      on public.trading_results
      for update
      to authenticated
      using (auth.uid() = user_id and source_income_id is null)
      with check (auth.uid() = user_id and source_income_id is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trading_results'
      and policyname = 'Users can delete their manual trading results'
  ) then
    create policy "Users can delete their manual trading results"
      on public.trading_results
      for delete
      to authenticated
      using (auth.uid() = user_id and source_income_id is null);
  end if;
end
$$;

do $$
declare
  v_exness_count integer;
  v_exness_id uuid;
  v_exness_user_id uuid;
  v_eligible_count integer;
  v_counterpart_count integer;
  v_pre_total numeric;
  v_post_total numeric;
begin
  lock table public.money_accounts in share row exclusive mode;
  lock table public.incomes in share row exclusive mode;
  lock table public.trading_results in share row exclusive mode;

  select count(*)
    into v_exness_count
  from public.money_accounts
  where lower(trim(name)) = 'exness';

  if v_exness_count <> 1 then
    raise exception 'Expected exactly one Exness account, found %', v_exness_count;
  end if;

  select id, user_id
    into strict v_exness_id, v_exness_user_id
  from public.money_accounts
  where lower(trim(name)) = 'exness';

  if exists (
    select 1
    from public.incomes income
    where income.account_id = v_exness_id
      and (
        income.user_id is null
        or income.user_id <> v_exness_user_id
        or income.amount <= 0
      )
  ) then
    raise exception 'Exness source income failed owner or positive-amount validation';
  end if;

  select count(*)
    into v_eligible_count
  from public.incomes
  where account_id = v_exness_id
    and user_id = v_exness_user_id;

  select coalesce(sum(
    account.initial_balance
    + coalesce((
        select sum(income.amount)
        from public.incomes income
        where income.account_id = account.id
          and not exists (
            select 1
            from public.trading_results result
            where result.source_income_id = income.id
          )
      ), 0)
    - coalesce((
        select sum(expense.amount)
        from public.expenses expense
        where expense.account_id = account.id
      ), 0)
    + coalesce((
        select sum(transfer.amount)
        from public.transfers transfer
        where transfer.to_account_id = account.id
      ), 0)
    - coalesce((
        select sum(transfer.amount)
        from public.transfers transfer
        where transfer.from_account_id = account.id
      ), 0)
    + coalesce((
        select sum(result.net_amount)
        from public.trading_results result
        where result.account_id = account.id
      ), 0)
  ), 0)
    into v_pre_total
  from public.money_accounts account;

  update public.money_accounts
  set account_purpose = 'trading',
      updated_at = now()
  where id = v_exness_id
    and user_id = v_exness_user_id;

  insert into public.trading_results (
    user_id,
    account_id,
    transaction_date,
    net_amount,
    note,
    source_income_id,
    created_at,
    updated_at
  )
  select
    income.user_id,
    income.account_id,
    income.transaction_date,
    income.amount,
    coalesce(income.note, ''),
    income.id,
    income.created_at,
    income.created_at
  from public.incomes income
  where income.account_id = v_exness_id
    and income.user_id = v_exness_user_id
  on conflict (source_income_id) where source_income_id is not null do nothing;

  select count(*)
    into v_counterpart_count
  from public.incomes income
  join public.trading_results result
    on result.source_income_id = income.id
   and result.user_id = income.user_id
   and result.account_id = income.account_id
   and result.net_amount = income.amount
  where income.account_id = v_exness_id
    and income.user_id = v_exness_user_id;

  if v_counterpart_count <> v_eligible_count then
    raise exception 'Trading migration counterpart mismatch';
  end if;

  select coalesce(sum(
    account.initial_balance
    + coalesce((
        select sum(income.amount)
        from public.incomes income
        where income.account_id = account.id
          and not exists (
            select 1
            from public.trading_results result
            where result.source_income_id = income.id
          )
      ), 0)
    - coalesce((
        select sum(expense.amount)
        from public.expenses expense
        where expense.account_id = account.id
      ), 0)
    + coalesce((
        select sum(transfer.amount)
        from public.transfers transfer
        where transfer.to_account_id = account.id
      ), 0)
    - coalesce((
        select sum(transfer.amount)
        from public.transfers transfer
        where transfer.from_account_id = account.id
      ), 0)
    + coalesce((
        select sum(result.net_amount)
        from public.trading_results result
        where result.account_id = account.id
      ), 0)
  ), 0)
    into v_post_total
  from public.money_accounts account;

  if v_pre_total is distinct from v_post_total then
    raise exception 'Trading migration changed total balance';
  end if;
end
$$;

commit;
