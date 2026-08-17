# Daily Spending Allowance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified daily spending allowance to the Summary using selected living accounts, exact recurring-payment occurrences, a 25-to-24 WIB pay cycle, and Supabase preferences with local fallback.

**Architecture:** Keep pay-cycle and allowance rules in dependency-free pure modules. Extend the existing client data mapping only enough to retain recurring payment identity, keep preference persistence in the existing page-level Supabase flow, and render one focused client card without changing the existing finance snapshot invariants.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Supabase JS 2.106.1, dependency-free Node test runner, ESLint 9.

## Global Constraints

- Do not add runtime dependencies.
- Do not expose `.env`, credentials, account details, or real financial data.
- Do not commit, push, deploy, or apply a database migration.
- Keep the migration as review-only SQL.
- Preserve existing finance calculation behavior and unrelated worktree state.
- Use Asia/Jakarta calendar semantics for the feature.
- Hide the card in historical month views.
- Show actual-only data with a disclosure in Simulation Mode.
- Never convert missing or inconsistent data into a valid zero.

---

### Task 1: Pay-cycle date domain

**Files:**
- Create: `tests/pay-cycle.test.mjs`
- Create: `src/lib/pay-cycle.ts`

**Interfaces:**
- Produces `getJakartaDateParts(now: Date): { year: number; monthIndex: number; day: number }`.
- Produces `getPayCycle(now: Date): { cycleStartKey: string; cycleEndKey: string; nextPaydayKey: string; remainingSpendableDays: number }`.
- Produces date-key helpers used by the allowance domain without exposing local-device timezone assumptions.

- [ ] Write failing tests for the 24th, 25th, December-to-January rollover, February 25-to-March 24 in leap/non-leap years, invalid dates, and today-inclusive counting.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/pay-cycle.test.mjs` and confirm the module-not-found or missing-export failure.
- [ ] Implement the minimum dependency-free date functions using `Intl.DateTimeFormat` with `timeZone: "Asia/Jakarta"` and UTC-safe date-key arithmetic.
- [ ] Re-run the targeted test and confirm all pay-cycle cases pass.

### Task 2: Daily allowance finance domain

**Files:**
- Create: `tests/daily-allowance.test.mjs`
- Create: `src/lib/daily-allowance.ts`
- Modify: `src/types/expense.ts`

**Interfaces:**
- Extends `Expense` with optional `recurringCommitmentId?: string` and `recurringPeriod?: string`.
- Consumes active `MoneyAccount[]`, account balances, selected living account IDs, `RecurringCommitment[]`, payment expenses, and a pay-cycle snapshot.
- Produces a discriminated `DailyAllowanceResult` with `ready`, `setup-required`, `no-disposable-balance`, and `review-required` states.

- [ ] Write failing tests for selected/excluded accounts, negative balances, every transfer-derived balance outcome, no selection, due-date clamping, exact recurring-period payment matching, previous-period non-matching, overdue commitments, explicit/fallback/archived/missing payment accounts, valid zero, and Rp1,000 rounding.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/daily-allowance.test.mjs` and confirm the expected missing-module failure.
- [ ] Implement the smallest pure calculation that satisfies the tests; reuse pay-cycle date-key helpers and do not inspect transaction descriptions.
- [ ] Re-run the daily-allowance tests and the existing `npm run test:finance` regression suite.

### Task 3: Recurring payment metadata mapping

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/daily-allowance.test.mjs`

**Interfaces:**
- Adds `recurring_commitment_id` and `recurring_period` to `SupabaseExpenseRow`.
- Maps those fields to the optional `Expense` properties from Task 2.

- [ ] Add a failing domain fixture proving an expense for the previous calendar recurring period does not settle the current occurrence.
- [ ] Run the targeted test and confirm the expected assertion failure.
- [ ] Extend the row type and mapping without changing unrelated expense behavior.
- [ ] Run the targeted allowance and finance tests.

### Task 4: Living-account preference persistence

**Files:**
- Create: `src/lib/living-account-preferences.ts`
- Create: `tests/living-account-preferences.test.mjs`
- Modify: `app/page.tsx`
- Create: `supabase/review-only/20260817_living_account_preferences.sql`
- Modify: `supabase/review-only/README.md`

**Interfaces:**
- Produces `parseLivingAccountIds(value: unknown): string[]` and `getLivingAccountStorageKey(userId: string): string`.
- Page state produces selected IDs, loading state, unsynced state, and `saveLivingAccountIds(ids: string[])`.
- Draft SQL adds nullable or default-empty `living_account_ids uuid[]` to `report_preferences` without applying it.

- [ ] Write failing parser tests for valid UUID lists, duplicates, malformed values, and safe empty fallback.
- [ ] Run the targeted parser tests and confirm the missing-module failure.
- [ ] Implement the parser and per-user key helper.
- [ ] Add page-level load/save behavior following the existing `net_hourly_wage` preference pattern: Supabase authoritative, error code `42703` and network failures use localStorage, every successful selection writes the local copy, and remote failure raises the unsynced state.
- [ ] Draft review-only SQL and document that it has not been applied.
- [ ] Run preference tests, TypeScript checking, and a scoped diff review for preference/error paths.

### Task 5: Daily allowance card and account selection

**Files:**
- Create: `src/components/daily-allowance-card.tsx`
- Modify: `src/components/overview-dashboard.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css` only if existing utility classes cannot express the required compact layout.

**Interfaces:**
- Card consumes `DailyAllowanceResult`, active accounts, selected IDs, privacy state, simulation state, preference loading/unsynced state, and callbacks for selection and navigation.
- Overview remains a client child of the existing client page and receives only serializable data plus existing in-client callbacks.

- [ ] Add the result calculation and visibility condition in `app/page.tsx`; historical selection must omit the card.
- [ ] Create the card with primary allowance, living/reserved/disposable supporting values, selected-account count, setup/review/zero states, `Atur akun`, and `Lihat komitmen`.
- [ ] Add an accessible checkbox list or compact account selector using existing input/button styles; new accounts remain unchecked by default.
- [ ] Mask every monetary value when Privacy Mode is active.
- [ ] Show `Tidak termasuk simulasi` when Simulation Mode is active and `Pilihan belum tersinkron` after a failed remote preference save.
- [ ] Run ESLint and TypeScript checking; fix only issues caused by this slice.

### Task 6: Financial-date refresh and integration regressions

**Files:**
- Modify: `app/page.tsx`
- Modify: `tests/pay-cycle.test.mjs`
- Modify: `tests/daily-allowance.test.mjs`
- Modify: `package.json` if a focused test script materially improves repeatability.

**Interfaces:**
- Page maintains a timestamp that refreshes on window focus and at the next WIB midnight.
- Allowance calculation depends on that timestamp so an open tab cannot remain on yesterday's denominator.

- [ ] Add a failing pure test for timestamps immediately before and after WIB midnight.
- [ ] Run the pay-cycle test and confirm the expected failure.
- [ ] Implement the minimum focus/midnight refresh effect and pass its timestamp to the pure domain.
- [ ] Run all new targeted tests plus existing finance, recurring schedule, and data-integrity tests.

### Task 7: Verification and handoff

**Files:**
- Review all paths changed by Tasks 1-6.

**Interfaces:**
- Produces verification evidence only; no commit or deployment.

- [ ] Run new pay-cycle, allowance, and preference tests.
- [ ] Run `npm run test:finance` and `npm run test:data-integrity`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`, `git status --short`, and a scoped diff review.
- [ ] If an authenticated local runtime is already available, check the current Summary behavior without exposing real balances; otherwise label browser verification not performed.
- [ ] Report files changed, verification commands and outcomes, known limitations, review-only migration status, and the next safe step.
