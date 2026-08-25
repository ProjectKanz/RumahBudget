-- Allocation buckets and the portfolio tracker move from browser localStorage
-- into user-scoped Postgres tables.
--
-- Stored per browser, this data was invisible from any other device and was
-- erased by clearing site data. Holdings and cost basis are the one thing in
-- the app that cannot be reconstructed from memory, so they belong server-side.
--
-- Identifiers are text, not uuid: the client already mints readable ids such as
-- 'asset-btc' and 'template-default-50-30-20', and rewriting them would orphan
-- every reference held in exported local backups.
--
-- These tables intentionally carry no foreign keys to each other. The reader is
-- already tolerant of dangling references, and keeping them independent lets the
-- client sync all seven collections in any order without ordering hazards.

create table if not exists public.allocation_buckets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  type text not null default 'custom',
  linked_account_id text,
  target_amount numeric,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.allocation_assets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null default '',
  name text not null default '',
  type text not null default 'other',
  currency text not null default 'IDR',
  price_provider text,
  primary key (user_id, id)
);

create table if not exists public.allocation_templates (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  is_default boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.allocation_income_records (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null default '',
  source text not null default '',
  amount numeric not null default 0,
  note text not null default '',
  allocation_status text not null default 'unallocated',
  allocation_template_id text,
  created_at bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.allocation_records (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  income_record_id text not null default '',
  bucket_id text not null default '',
  amount numeric not null default 0,
  percentage numeric not null default 0,
  created_at bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.allocation_investment_transactions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null default '',
  date text not null default '',
  type text not null default 'buy',
  price numeric not null default 0,
  amount_idr numeric not null default 0,
  quantity numeric not null default 0,
  fee numeric not null default 0,
  source_bucket_id text,
  note text not null default '',
  created_at bigint not null default 0,
  primary key (user_id, id),
  constraint allocation_investment_transactions_type_check
    check (type in ('buy', 'sell'))
);

create table if not exists public.allocation_price_snapshots (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null default '',
  price numeric not null default 0,
  currency text not null default 'IDR',
  source text not null default 'manual',
  captured_at bigint not null default 0,
  is_manual boolean not null default true,
  primary key (user_id, id)
);

create index if not exists allocation_records_user_bucket_idx
  on public.allocation_records (user_id, bucket_id);
create index if not exists allocation_investment_transactions_user_asset_idx
  on public.allocation_investment_transactions (user_id, asset_id, date);
create index if not exists allocation_price_snapshots_user_asset_idx
  on public.allocation_price_snapshots (user_id, asset_id, captured_at desc);

-- Row level security: a user reaches their own rows and nothing else.
do $$
declare
  v_table text;
  v_action text;
  v_policy text;
begin
  foreach v_table in array array[
    'allocation_buckets',
    'allocation_assets',
    'allocation_templates',
    'allocation_income_records',
    'allocation_records',
    'allocation_investment_transactions',
    'allocation_price_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);

    foreach v_action in array array['select', 'insert', 'update', 'delete'] loop
      v_policy := format('%s owner %s', v_table, v_action);

      if not exists (
        select 1
          from pg_policies
         where schemaname = 'public'
           and tablename = v_table
           and policyname = v_policy
      ) then
        if v_action = 'insert' then
          execute format(
            'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
            v_policy, v_table
          );
        elsif v_action = 'update' then
          execute format(
            'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
            v_policy, v_table
          );
        else
          execute format(
            'create policy %I on public.%I for %s to authenticated using (auth.uid() = user_id)',
            v_policy, v_table, v_action
          );
        end if;
      end if;
    end loop;

    execute format('revoke all on table public.%I from anon', v_table);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      v_table
    );
  end loop;
end;
$$;
