# Finance Calculation Regression Design

## Goal

Make RumahBudget's financial invariants executable and visible: initial balances affect account totals but never current-month income, while income, expenses, transfers, edits, deletes, and month changes recalculate consistently.

## Scope

- Extract the existing dashboard math into one pure TypeScript module.
- Keep current product behavior and Supabase persistence unchanged.
- Use the device's local calendar month for the current-period boundary.
- Add zero-dependency regression tests with Node's built-in test runner.
- Add one concise explanation under the Initial balance field.

## Calculation Contract

`calculateFinanceSnapshot(input)` receives money accounts, incomes, expenses, transfers, and an optional reference timestamp. It returns:

- balances for every known account;
- total balance across known accounts;
- current-local-month income and expense records;
- current-local-month income, expense, and net cashflow totals.

Initial balances seed account balances but do not enter income. Income and expenses affect both their linked account and the current-month cashflow only when their timestamp is in the reference month. Transfers move money between known accounts without affecting cashflow. Records linked to unknown accounts do not affect account balances, matching current dashboard behavior.

Edits and deletes require no special mutation API: recalculating from the updated arrays must replace or remove the old record's effect.

## UI Copy

Display this helper text immediately below the Initial balance input:

> Saldo awal masuk ke Total Saldo, bukan Pemasukan bulan berjalan.

## Verification

- Tests cover initial balance, income, expense, transfer, edit, delete, prior-month exclusion, December-to-January rollover, and unknown accounts.
- `app/page.tsx` consumes the tested calculation module.
- Run the finance test script, targeted ESLint, TypeScript checking, the existing UI-preservation script, and `git diff --check`.

## Constraints

- No new dependency.
- No database, Supabase, authentication, or deployment changes.
- No unrelated refactor.
- Existing user changes remain uncommitted and untouched outside the scoped files.
