begin;

alter table public.expenses
  add column if not exists affects_daily_allowance boolean not null default true;

alter table public.incomes
  add column if not exists affects_daily_allowance boolean not null default true;

alter table public.transfers
  add column if not exists affects_daily_allowance boolean not null default true;

commit;
