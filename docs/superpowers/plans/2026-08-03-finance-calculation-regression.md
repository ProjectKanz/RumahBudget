# Finance Calculation Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add executable regression coverage for RumahBudget's ledger calculations and clarify that initial balance is not monthly income.

**Architecture:** Move the current pure ledger aggregation from `app/page.tsx` into `src/lib/finance-calculations.ts`. The page consumes the returned snapshot and layers existing sandbox simulation values on top, while `node:test` exercises the production module directly with deterministic local-calendar timestamps.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript, Node.js 24 built-in test runner.

## Global Constraints

- The current month follows the device's local calendar month.
- Initial balance affects Total Saldo but never current-month income.
- Internal transfers never change total balance or cashflow.
- No new dependency, schema change, auth change, or unrelated refactor.
- Do not commit because the user did not authorize a commit.

---

### Task 1: Finance calculation contract

**Files:**
- Create: `tests/finance-calculations.test.mjs`
- Create: `src/lib/finance-calculations.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `MoneyAccount[]`, `Income[]`, `Expense[]`, `Transfer[]`, and `now: number`.
- Produces: `calculateFinanceSnapshot(input): FinanceSnapshot` with `accountBalances`, `totalBalance`, `monthlyIncomes`, `monthlyExpenses`, `monthlyIncome`, `monthlyExpense`, and `netCashflow`.

- [ ] **Step 1: Write failing tests**

  Add separate `node:test` cases for initial balance, income, expense, transfer, edit, delete, previous-month exclusion, December-to-January rollover, and unknown-account records. Each test imports the production TypeScript module and asserts numeric outcomes.

- [ ] **Step 2: Verify RED**

  Run `node --test tests/finance-calculations.test.mjs` and confirm failure because `src/lib/finance-calculations.ts` does not exist.

- [ ] **Step 3: Add minimal implementation**

  Implement local-month filtering and account aggregation without React, browser APIs, Supabase, or mutation side effects.

- [ ] **Step 4: Verify GREEN**

  Run `node --test tests/finance-calculations.test.mjs` and confirm every case passes.

- [ ] **Step 5: Add the reusable command**

  Add `"test:finance": "node --test tests/finance-calculations.test.mjs"` to `package.json`, then run `npm run test:finance`.

### Task 2: Dashboard integration and copy

**Files:**
- Modify: `app/page.tsx`
- Modify: `src/components/money-accounts.tsx`

**Interfaces:**
- Consumes: `calculateFinanceSnapshot` from Task 1.
- Produces: the same dashboard values and sandbox behavior already consumed by existing components.

- [ ] **Step 1: Replace duplicated page calculations**

  Create one memoized finance snapshot from active accounts, incomes, expenses, transfers, and the current render time. Keep sandbox recurring income/expense/net adjustments outside the pure snapshot exactly as before.

- [ ] **Step 2: Add the initial-balance explanation**

  Render `Saldo awal masuk ke Total Saldo, bukan Pemasukan bulan berjalan.` directly below the numeric input.

- [ ] **Step 3: Run focused verification**

  Run `npm run test:finance`, ESLint for the modified source files, `npx tsc --noEmit`, `node scripts/check-ui-preservation.mjs`, and `git diff --check`.

- [ ] **Step 4: Inspect the scoped diff**

  Confirm only the calculation module, regression test, package script, page integration, copy, design spec, and plan were added or changed by this slice.
