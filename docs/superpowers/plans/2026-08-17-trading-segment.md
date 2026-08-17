# RumahBudget Trading Segment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-scoped Trading view for Exness, move confirmed legacy Exness income into signed Trading P/L without changing total balance, and keep deposits and withdrawals as neutral transfers.

**Architecture:** Extend the existing pure finance calculation with signed trading results and explicit legacy-income replacement. Keep Trading presentation calculations in a separate dependency-free module, integrate one focused client component into the existing page-level Supabase flow, and use one transactional/idempotent SQL migration for schema, RLS, Exness classification, legacy conversion, and balance assertions.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Supabase JS 2.106.1, PostgreSQL/Supabase RLS, dependency-free Node test runner, ESLint 9.

## Global Constraints

- Do not add runtime dependencies.
- Use `account_purpose = 'general' | 'trading'`; all existing accounts default to `general`.
- Use signed, non-zero `net_amount`: positive is profit and negative is loss.
- Use Asia/Jakarta calendar-date semantics through the existing transaction-date mapping.
- Keep transfers as transfers; never copy them into `trading_results`.
- Preserve all source income and transfer rows.
- Exclude a legacy income from household calculations only when an owner-visible `trading_results.source_income_id` references it.
- Reject missing, archived, non-owned, or non-trading accounts.
- Keep migrated Trading P/L immutable through ordinary owner CRUD.
- Do not expose private amounts, account IDs, source IDs, or notes in documentation, logs, screenshots, or migration evidence.
- Do not mutate production until local tests, lint, type checking, build, SQL review, and an aggregate preflight pass.

---

### Task 1: Trading domain and finance invariants

**Files:**
- Create: `src/types/trading-result.ts`
- Create: `src/lib/trading-calculations.ts`
- Create: `tests/trading-calculations.test.mjs`
- Modify: `src/types/money-account.ts`
- Modify: `src/lib/finance-calculations.ts`
- Modify: `tests/finance-calculations.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produce `MoneyAccountPurpose = "general" | "trading"` and `MoneyAccount.purpose`.
- Produce `TradingResult { id, userId, accountId, transactionDate, netAmount, note, sourceIncomeId?, createdAt }`.
- Produce `getHouseholdIncomes(incomes, tradingResults): Income[]`.
- Extend `calculateFinanceSnapshot` with optional `tradingResults?: TradingResult[]`, `monthlyTradingResults`, and `monthlyTradingNet`.
- Produce `calculateTradingSummary({ accounts, accountBalances, transfers, tradingResults, periodReference })` with current balance, period P/L, deposits, withdrawals, and combined history.
- Produce `validateTradingResultDraft({ accountId, transactionDate, netAmount, accounts })` returning a normalized draft or a user-facing validation error.

- [ ] **Step 1: Write failing finance tests**

  Add literal fixtures proving: positive/negative P/L affects only the trading account and total balance; migrated income is excluded and replaced exactly once; prior-month P/L remains in current balance but not current-period P/L; unknown accounts fail closed; and duplicate `sourceIncomeId` values cannot double-count.

- [ ] **Step 2: Run the finance test and verify RED**

  Run: `npm run test:finance`

  Expected: FAIL because `tradingResults` is ignored and the new exports/fields do not exist.

- [ ] **Step 3: Implement the minimal finance behavior**

  Define the trading type, add `purpose` to accounts, filter legacy source income IDs through `getHouseholdIncomes`, add valid signed P/L to known trading-account balances, and calculate selected-period P/L using the existing timestamp/month rule.

- [ ] **Step 4: Run the finance test and verify GREEN**

  Run: `npm run test:finance`

  Expected: all old and new finance cases pass.

- [ ] **Step 5: Write failing Trading summary and validation tests**

  Cover deposit, withdrawal, trading-to-trading transfer exclusion, period filtering, chronological combined history, zero/non-finite result rejection, invalid date rejection, and general/archived/missing account rejection.

- [ ] **Step 6: Run the Trading test and verify RED**

  Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/trading-calculations.test.mjs`

  Expected: FAIL with a missing module or missing exports.

- [ ] **Step 7: Implement Trading summary and validation**

  Derive deposits only when money enters trading from non-trading, withdrawals only when money leaves trading for non-trading, and never apply display rows as monetary effects.

- [ ] **Step 8: Run Trading and finance tests and verify GREEN**

  Add `test:trading` to `package.json`, then run `npm run test:trading` and `npm run test:finance`.

---

### Task 2: Transactional Supabase migration

**Files:**
- Create: `supabase/migrations/20260817_trading_segment.sql`
- Create: `tests/trading-migration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Add `public.money_accounts.account_purpose text not null default 'general'` with `general|trading` constraint.
- Add `public.trading_results` with UUID keys, owner/account/source foreign keys, Jakarta date default, signed non-zero numeric result, note, and timestamps.
- Add trigger validation that account owner matches, account is active, and purpose is `trading`.
- Add owner-scoped SELECT/INSERT and manual-row-only UPDATE/DELETE policies.
- Migrate exactly one case-insensitive Exness account and every confirmed linked positive income.

- [ ] **Step 1: Write a failing executable SQL contract test**

  The test reads the migration and requires one explicit transaction, account-purpose constraint, non-zero result constraint, unique non-null source-income index, RLS enablement, owner policies, account-validation trigger, exact-one-Exness assertion, no transfer mutation statements, no income deletion/update statements, pre/post balance variables, and a rollback-raising mismatch assertion.

- [ ] **Step 2: Run the SQL contract test and verify RED**

  Run: `node --test tests/trading-migration.test.mjs`

  Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Write the migration**

  Use deployed UUID/numeric/date/timestamptz types. Lock `money_accounts`, `incomes`, and `trading_results`; assert one Exness account, owner alignment, and positive eligible amounts; calculate the current semantic total; classify Exness; insert missing source-linked Trading P/L rows; assert one counterpart per source; recalculate and raise if the total changed; return no private result set.

- [ ] **Step 4: Run SQL and domain tests and verify GREEN**

  Add `test:trading-migration` to `package.json`, then run `npm run test:trading-migration`, `npm run test:trading`, and `npm run test:finance`.

- [ ] **Step 5: Perform a manual SQL safety review**

  Confirm the migration contains no `delete from public.incomes`, no `update public.incomes`, no transfer mutation, no amount/note output, and that a failure after `begin` reaches PostgreSQL rollback semantics.

---

### Task 3: Supabase client mapping and signed session CRUD

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/trading-calculations.test.mjs`

**Interfaces:**
- Add `SupabaseTradingResultRow` and `account_purpose` mapping.
- Add Trading state, loading state, error state, and `loadTradingResultsFromSupabase()`.
- Add `addTradingResult({ accountId, transactionDate, netAmount, note }): Promise<boolean>`.
- Add `deleteTradingResult(id): Promise<void>` restricted in UI to manual rows.
- Feed `tradingResults` into finance and use `getHouseholdIncomes` for reports, ordinary transactions, and recent activity.

- [ ] **Step 1: Add a failing domain fixture for page-consumer behavior**

  Prove `getHouseholdIncomes` keeps unrelated income and removes only IDs referenced by Trading results.

- [ ] **Step 2: Run the Trading test and verify RED**

  Run: `npm run test:trading`

  Expected: FAIL on the new household-ledger fixture before implementation adjustment.

- [ ] **Step 3: Extend page mapping and data loading**

  Default a missing account purpose to `general`, map Trading results using `getTransactionTimestamp`, load owner rows from `trading_results`, clear state on logout, and report Trading load failures without altering income/expense state.

- [ ] **Step 4: Add validated session CRUD**

  Validate through `validateTradingResultDraft`, insert only owner/account/date/net/note fields, reload after success, and allow deleting only results with no `sourceIncomeId`.

- [ ] **Step 5: Wire finance and household consumers**

  Pass Trading results into `calculateFinanceSnapshot`; ensure reports, transaction history, and Summary recent activity receive only household incomes; keep Trading results out of the ordinary ledger.

- [ ] **Step 6: Run targeted tests and static checks**

  Run `npm run test:trading`, `npm run test:finance`, and `npx tsc --noEmit`.

---

### Task 4: Dedicated Trading view

**Files:**
- Create: `src/components/trading-dashboard.tsx`
- Modify: `app/page.tsx`
- Modify: `src/components/overview-dashboard.tsx`

**Interfaces:**
- `TradingDashboard` consumes trading accounts, `TradingSummary`, results, loading/error/privacy state, `onAddResult`, and `onDeleteResult`.
- `AppView` adds `trading`; desktop navigation places it under `Perencanaan`, and mobile More includes it.
- Overview may open Trading through one secondary action without showing Trading P/L as household income.

- [ ] **Step 1: Add the Trading route state and summary calculation**

  Calculate the summary from current account balances, transfers, Trading results, accounts, and selected month; expose `trading` through all duplicated `AppView` types.

- [ ] **Step 2: Build the signed-session form**

  Render date, trading account, signed numeric net result, optional note, validation feedback, loading state, and success reset. Explain positive=profit and negative=loss.

- [ ] **Step 3: Build summary metrics and history**

  Show current Trading balance, selected-period net P/L, deposits, withdrawals, and chronologically combined Profit/Loss/Deposit/Withdrawal rows. Mark source-linked rows `Migrated from income` and hide their delete action.

- [ ] **Step 4: Apply privacy and unavailable states**

  Mask every monetary value and private note/account label when Privacy Mode is active. Show no-account and schema/load failure states without falling back to household income/expense entry.

- [ ] **Step 5: Integrate navigation and Overview action**

  Add Trading to desktop/mobile navigation and add a compact `Buka Trading` action in the Overview workbench.

- [ ] **Step 6: Run targeted verification**

  Run `npm run test:trading`, `npm run test:finance`, `npm run lint`, and `npx tsc --noEmit`.

---

### Task 5: Full local verification and scoped review

**Files:**
- Review every path changed by Tasks 1-4.

**Interfaces:**
- Produce local evidence before any production mutation.

- [ ] **Step 1: Run domain regressions**

  Run `npm run test:trading`, `npm run test:trading-migration`, `npm run test:finance`, `npm run test:daily-allowance`, and `npm run test:data-integrity`.

- [ ] **Step 2: Run static and production checks**

  Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

- [ ] **Step 3: Audit the diff**

  Run `git diff --check`, `git status --short`, inspect the complete branch diff against `main`, and confirm no secrets, unrelated files, generated build output, or private financial values are present.

- [ ] **Step 4: Verify local UI**

  Start the worktree app on an available non-conflicting port, inspect desktop and mobile Trading views, verify Privacy Mode and validation, and avoid creating production data during local UI verification.

---

### Task 6: Production migration and aggregate verification

**Files:**
- Execute: `supabase/migrations/20260817_trading_segment.sql` in the authenticated RumahBudget Supabase SQL editor.

**Interfaces:**
- Produce aggregate-only evidence: Exness account count, related transfer/deposit/withdrawal counts, source/counterpart counts, table/purpose existence, and a zero balance delta.

- [ ] **Step 1: Run read-only preflight**

  Re-query live counts and types; abort if Exness count is not exactly one, any eligible income is non-positive/owner-mismatched, or deployed column types differ from the migration.

- [ ] **Step 2: Request action-time confirmation**

  Immediately before clicking Run on the mutating SQL, tell the user the exact destination and effects: add schema/RLS, mark the single Exness account as trading, insert one source-linked Trading P/L per eligible Exness income, preserve all source rows/transfers, and roll back on invariant failure.

- [ ] **Step 3: Apply the migration once**

  Paste the reviewed migration into the RumahBudget production SQL editor and execute it. Do not retry a serious failure without a new diagnosis.

- [ ] **Step 4: Run aggregate-only postflight**

  Verify the schema, one trading Exness account, unchanged transfer/source row counts, exactly one Trading result per eligible source income, owner-scoped RLS policies, and calculated balance delta `0` without displaying amounts or notes.

- [ ] **Step 5: Verify application behavior**

  After the verified code is integrated/deployed through the project's existing path, open RumahBudget, confirm Trading navigation and migrated badges, confirm household income excludes migrated sources, confirm Privacy Mode, and do not create or delete a live session result solely for testing.

---

### Task 7: Integration handoff

**Files:**
- Review branch and main worktree state.

**Interfaces:**
- Produce a truthful final status with code, database, runtime, and deployment distinguished.

- [ ] **Step 1: Run fresh final verification**

  Repeat the full relevant test, lint, type-check, build, diff, and aggregate database postflight commands immediately before completion claims.

- [ ] **Step 2: Follow branch-finishing workflow**

  Use `superpowers:finishing-a-development-branch`; do not merge, commit, push, or deploy unless allowed by the user's explicit instruction and project rules.

- [ ] **Step 3: Report exact outcomes**

  List files changed, commands/results, migration status, runtime/deployment status, known limitations, and the safest next step. Never describe production UI as updated unless deployment and browser evidence prove it.
