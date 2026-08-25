-- Recurring commitment periods follow the 25th -> 24th pay cycle.
--
-- The period used to be date_trunc('month', today): the month a payment happened
-- to be made in. The daily allowance keys the same occurrence to the month the
-- bill is DUE inside the current pay cycle. Any payment made in a different
-- calendar month than its due date therefore stopped matching its reservation,
-- so the money was deducted from the balance AND held in reserve for the rest of
-- the cycle. Paying a bill early was enough to trigger it.
--
-- Existing rows are left untouched on purpose. Old and new stamps already agree
-- for any payment made in the same calendar month as its due date, which covers
-- on-time payments, and rewriting payment history is not reversible.

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
  v_cycle_start date;
  v_cycle_end date;
  v_month_start date;
  v_last_day integer;
  v_effective_day integer;
  v_candidate date;
  v_occurrence_date date;
  v_period date;
  v_offset integer;
  v_commitment public.recurring_commitments%rowtype;
  v_account_id public.money_accounts.id%type;
  v_expense_id public.expenses.id%type;
  v_was_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_mode not in ('auto', 'manual') then
    raise exception 'Invalid processing mode' using errcode = '22023';
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

  if not coalesce(v_commitment.is_auto_deduct, false) and p_mode = 'auto' then
    raise exception 'Auto-deduct is disabled for this commitment'
      using errcode = '22023';
  end if;

  if v_commitment.due_day is null
     or v_commitment.due_day < 1
     or v_commitment.due_day > 31 then
    raise exception 'Invalid commitment due day' using errcode = '22023';
  end if;

  if v_commitment.amount is null or v_commitment.amount <= 0 then
    raise exception 'Invalid commitment amount' using errcode = '22023';
  end if;

  -- The pay cycle containing today runs from the 25th to the 24th.
  v_cycle_start := make_date(
    extract(year from v_today)::integer,
    extract(month from v_today)::integer,
    25
  );
  if extract(day from v_today)::integer < 25 then
    v_cycle_start := (v_cycle_start - interval '1 month')::date;
  end if;
  v_cycle_end := (v_cycle_start + interval '1 month' - interval '1 day')::date;

  -- Exactly one occurrence of this due day falls inside that cycle: either in
  -- the month the cycle opens, or in the month it closes. Short months clamp to
  -- their last day, matching getCycleOccurrence in src/lib/recurring-occurrence.
  for v_offset in 0..1 loop
    v_month_start := (
      date_trunc('month', v_cycle_start) + (v_offset || ' month')::interval
    )::date;
    v_last_day := extract(
      day from (v_month_start + interval '1 month' - interval '1 day')
    )::integer;
    v_effective_day := least(v_commitment.due_day, v_last_day);
    v_candidate := v_month_start + (v_effective_day - 1);

    if v_candidate between v_cycle_start and v_cycle_end then
      v_occurrence_date := v_candidate;
      v_period := v_month_start;
      exit;
    end if;
  end loop;

  if v_occurrence_date is null then
    raise exception 'Commitment occurrence not found in the current pay cycle'
      using errcode = '22023';
  end if;

  -- Auto-deduct waits for the occurrence itself, which may sit in the next
  -- calendar month. Manual payment stays allowed at any point in the cycle.
  if p_mode = 'auto' and v_today < v_occurrence_date then
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
    'dueDate', v_occurrence_date,
    'period', v_period,
    'wasCreated', v_was_created
  );
end;
$$;

revoke all on function public.process_recurring_commitment(uuid, text) from public;
revoke all on function public.process_recurring_commitment(uuid, text) from anon;
grant execute on function public.process_recurring_commitment(uuid, text)
  to authenticated;
