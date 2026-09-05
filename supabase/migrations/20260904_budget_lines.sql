begin;

-- Rencana Uang lives beside the ledger, never inside it. A budget line is a
-- planning label; the money itself stays on the account rows. Expenses point at
-- a line through a nullable column, so every existing row simply reads as
-- Uncategorized and no balance calculation changes.

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- `key` is the stable machine identity. Display names are free to change
  -- without breaking references or the idempotent seed.
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  kind text not null default 'spending' check (kind in ('spending', 'reserve')),
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The seed upserts on this target, so re-running it can never duplicate a line.
create unique index if not exists budget_lines_user_key_unique
  on public.budget_lines (user_id, key);

create index if not exists budget_lines_user_sort_idx
  on public.budget_lines (user_id, sort_order, name);

alter table public.expenses
  add column if not exists budget_line_id uuid
  references public.budget_lines(id) on delete restrict;

create index if not exists expenses_user_budget_line_idx
  on public.expenses (user_id, budget_line_id);

-- Guard rails the app cannot bypass: a classified expense must point at the
-- owner's own line, that line must still be active, and in this slice only
-- spending lines may receive expenses. Reserve lines exist in the schema for
-- V2.3 but are not assignable yet.
create or replace function public.validate_expense_budget_line()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only validate when the classification itself changes. Without this an
  -- ordinary edit (amount, date, note) on an expense whose line was archived
  -- later would be rejected for a field the edit never touched.
  -- OLD is referenced inside its own branch so it is never touched on INSERT.
  if tg_op = 'UPDATE' then
    if new.budget_line_id is not distinct from old.budget_line_id then
      return new;
    end if;
  end if;

  if new.budget_line_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.budget_lines line
    where line.id = new.budget_line_id
      and line.user_id = new.user_id
      and line.kind = 'spending'
      and line.is_archived = false
  ) then
    raise exception 'Expense budget line must be an active owner-scoped spending line';
  end if;

  return new;
end
$$;

drop trigger if exists expenses_validate_budget_line on public.expenses;

create trigger expenses_validate_budget_line
before insert or update on public.expenses
for each row execute function public.validate_expense_budget_line();

alter table public.budget_lines enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_lines'
      and policyname = 'Users can view their own budget lines'
  ) then
    create policy "Users can view their own budget lines"
      on public.budget_lines
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_lines'
      and policyname = 'Users can create their own budget lines'
  ) then
    create policy "Users can create their own budget lines"
      on public.budget_lines
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_lines'
      and policyname = 'Users can update their own budget lines'
  ) then
    create policy "Users can update their own budget lines"
      on public.budget_lines
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_lines'
      and policyname = 'Users can delete their own budget lines'
  ) then
    create policy "Users can delete their own budget lines"
      on public.budget_lines
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

commit;
