-- REVIEW ONLY. Do not run without checking the deployed column types, RLS
-- policies, backups, and a staging dry run. Move to supabase/migrations only
-- after approval.
--
-- Contract:
-- - one expense per user + commitment + Jakarta calendar month;
-- - expense insert and last_processed update happen in one transaction;
-- - due days 29-31 clamp to the last real day of shorter months;
-- - mode=manual supports the dashboard payment action without a double insert;
-- - only auth.uid() can process its own commitment;
-- - an explicit archived/missing account fails closed; an unlinked commitment
--   uses the oldest active account.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recurring_commitments_positive_amount'
      and conrelid = 'public.recurring_commitments'::regclass
  ) then
    alter table public.recurring_commitments
      add constraint recurring_commitments_positive_amount
      check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'recurring_commitments_valid_due_day'
      and conrelid = 'public.recurring_commitments'::regclass
  ) then
    alter table public.recurring_commitments
      add constraint recurring_commitments_valid_due_day
      check (due_day between 1 and 31) not valid;
  end if;
end
$$;

alter table public.expenses
  add column if not exists recurring_commitment_id uuid
    references public.recurring_commitments(id) on delete set null,
  add column if not exists recurring_period date;

create unique index if not exists expenses_one_recurring_occurrence_per_month
  on public.expenses (user_id, recurring_commitment_id, recurring_period)
  where recurring_commitment_id is not null and recurring_period is not null;

create or replace function public.process_recurring_commitment(
  p_commitment_id uuid,
  p_mode text default 'auto'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := timezone('Asia/Jakarta', now())::date;
  v_period date := date_trunc('month', v_today)::date;
  v_last_day integer := extract(
    day from (v_period + interval '1 month - 1 day')
  )::integer;
  v_effective_due_day integer;
  v_commitment public.recurring_commitments%rowtype;
  v_account_id public.money_accounts.id%type;
  v_expense_id public.expenses.id%type;
  v_was_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
    into v_commitment
    from public.recurring_commitments
   where id = p_commitment_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'Commitment not found' using errcode = 'P0002';
  end if;

  if not coalesce(v_commitment.is_auto_deduct, false) then
    if p_mode = 'auto' then
      raise exception 'Auto-deduct is disabled for this commitment'
        using errcode = '22023';
    end if;
  end if;

  if p_mode not in ('auto', 'manual') then
    raise exception 'Invalid processing mode' using errcode = '22023';
  end if;

  if v_commitment.due_day is null
     or v_commitment.due_day < 1
     or v_commitment.due_day > 31 then
    raise exception 'Invalid commitment due day' using errcode = '22023';
  end if;

  if v_commitment.amount is null or v_commitment.amount <= 0 then
    raise exception 'Invalid commitment amount' using errcode = '22023';
  end if;

  v_effective_due_day := least(v_commitment.due_day, v_last_day);
  if p_mode = 'auto'
     and extract(day from v_today)::integer < v_effective_due_day then
    raise exception 'Commitment is not due yet' using errcode = '22023';
  end if;

  select id
    into v_account_id
    from public.money_accounts
   where id = v_commitment.account_id
     and user_id = v_user_id
     and is_archived = false;

  if v_account_id is null then
    if v_commitment.account_id is not null then
      raise exception 'Linked money account is missing or archived'
        using errcode = 'P0002';
    end if;

    select id
      into v_account_id
      from public.money_accounts
     where user_id = v_user_id
       and is_archived = false
     order by created_at asc
     limit 1;
  end if;

  if v_account_id is null then
    raise exception 'No active money account is available'
      using errcode = 'P0002';
  end if;

  insert into public.expenses (
    user_id,
    owner,
    account_id,
    amount,
    category,
    description,
    payment_method,
    note,
    created_at,
    transaction_date,
    recurring_commitment_id,
    recurring_period
  ) values (
    v_user_id,
    coalesce(auth.jwt() ->> 'email', 'Recurring commitment'),
    v_account_id,
    v_commitment.amount,
    v_commitment.category,
    v_commitment.name,
    'Debit Card',
    case
      when p_mode = 'manual' then 'Manual payment for commitment: '
      else 'Auto-Deducted commitment: '
    end || v_commitment.name,
    now(),
    v_today,
    v_commitment.id,
    v_period
  )
  on conflict (user_id, recurring_commitment_id, recurring_period)
    where recurring_commitment_id is not null and recurring_period is not null
  do nothing
  returning id into v_expense_id;

  if v_expense_id is not null then
    v_was_created := true;
  else
    select id
      into v_expense_id
      from public.expenses
     where user_id = v_user_id
       and recurring_commitment_id = v_commitment.id
       and recurring_period = v_period;
  end if;

  update public.recurring_commitments
     set last_processed = now()
   where id = v_commitment.id
     and user_id = v_user_id;

  return jsonb_build_object(
    'expenseId', v_expense_id::text,
    'accountId', v_account_id::text,
    'period', v_period,
    'wasCreated', v_was_created
  );
end;
$$;

revoke all on function public.process_recurring_commitment(uuid, text) from public;
revoke all on function public.process_recurring_commitment(uuid, text) from anon;
grant execute on function public.process_recurring_commitment(uuid, text)
  to authenticated;
