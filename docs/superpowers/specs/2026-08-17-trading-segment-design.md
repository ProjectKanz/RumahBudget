# RumahBudget Trading Segment Design

**Date:** 2026-08-17
**Status:** User-approved design; implementation and production migration not started

## Context

RumahBudget currently treats initial balance, linked income, linked expense, and internal transfers as the sources of account balance. Internal transfers are cashflow-neutral. The Exness account is excluded from the daily spending allowance, but trading activity can still distort household reporting when profit is recorded as income or loss as an expense.

A production read-only audit found exactly one account named `Exness`, two related transfers (one deposit and one withdrawal), four income rows linked directly to Exness, and no expense rows linked directly to Exness. The user confirmed that all four linked income rows are trading profit and may be migrated to positive Trading P/L.

## Goals

- Separate trading performance from household income and living expenses.
- Keep deposits and withdrawals as internal transfers with no cashflow effect.
- Track one signed net result per trading day or session.
- Preserve source records and a reversible audit trail.
- Keep total account balance unchanged when legacy Exness income is migrated.
- Keep Exness excluded from the daily spending allowance unless the user explicitly selects it later.
- Make the Trading segment server-backed and owner-scoped.

## Non-goals

- Import individual Exness orders or connect to the Exness API.
- Track open positions, leverage, margin, or unrealized P/L.
- Replace the existing browser-local Allocation/Portfolio Watch.
- Reclassify unrelated investment, income, expense, or transfer records.
- Delete legacy financial rows during migration.

## Considered Approaches

### 1. Dedicated Trading P/L with derived transfers — selected

Classify Exness as a trading account, store signed session results separately, and derive deposits and withdrawals from the existing transfer ledger. This preserves the current transfer invariant and avoids duplicate balance effects.

### 2. Copy transfers into a new trading ledger — rejected

This creates two monetary records for one movement and makes double-counting or reconciliation drift likely.

### 3. Keep using income and expense with trading categories — rejected

This is smaller technically but continues to contaminate household cashflow, monthly status, reports, and spending decisions.

## Financial Invariants

1. Household account balance remains:

   `initial balance + household income - household expense + transfers in - transfers out + trading P/L`

2. A transfer into Exness is a trading deposit. It moves balance but changes neither household income nor total balance.
3. A transfer out of Exness is a trading withdrawal. It moves balance but changes neither household income nor total balance.
4. Positive Trading P/L increases Exness balance and total balance, but not household income.
5. Negative Trading P/L decreases Exness balance and total balance, but not household expense.
6. Migrating a legacy Exness income row must replace its balance contribution exactly once: the legacy income contribution is excluded and an equal positive Trading P/L contribution is added.
7. Total balance immediately before and after legacy migration must be identical.
8. The daily allowance continues to use only user-selected living accounts. A withdrawal to a selected living account raises the allowance through the destination balance; Exness P/L alone does not.

## Data Model

### Money account purpose

Add an owner-visible purpose to `money_accounts`:

- `general` — default for all existing accounts.
- `trading` — used by Exness and any future trading account.

The production migration marks the single audited Exness account as `trading`. It must abort if the case-insensitive account-name match returns zero or more than one account.

### Trading results

Create an owner-scoped `trading_results` table with:

- Primary key matching project UUID conventions.
- `user_id` owner reference.
- `account_id` reference to a non-archived money account with purpose `trading`.
- `transaction_date` using the existing Asia/Jakarta calendar-date convention.
- `net_amount`, signed and non-zero: positive for profit, negative for loss.
- Optional `note`.
- Optional unique `source_income_id` for reversible legacy migration.
- `created_at` and `updated_at` timestamps.

Rows created from legacy income are immutable through ordinary application CRUD. A future explicit reversal operation may remove the Trading P/L row and reactivate the retained source income, but it must run atomically, verify the balance invariant, and leave an audit record.

### Legacy source preservation

The four source income rows remain in `incomes`. A legacy income is excluded from household balance, household income, reports, and the ordinary transaction ledger whenever an owner-visible `trading_results.source_income_id` points to it. The Trading history displays the migrated result with a `Migrated from income` badge.

This relationship is the audit trail; no legacy row is deleted or overwritten.

## Calculation and Data Flow

The finance calculation receives accounts, incomes, expenses, transfers, and trading results.

1. Build the set of migrated `source_income_id` values.
2. Exclude those income rows from household income and their direct balance contribution.
3. Apply all internal transfers exactly once using the current logic.
4. Add each signed Trading P/L result exactly once to its trading account.
5. Derive Trading deposits and withdrawals for display from transfers whose source or destination has purpose `trading`; derived display rows never affect calculations independently.

Historical month selection filters Trading P/L by `transaction_date` for period reporting but does not change current account balances, matching the existing ledger behavior.

## Trading Segment UX

Add a dedicated `Trading` view separate from `Ringkasan`, `Transaksi`, and the browser-local `Alokasi` view.

The first slice contains:

- Current trading-account balance.
- Selected-period net Trading P/L.
- Selected-period deposits and withdrawals.
- A `Catat hasil sesi` form with date, trading account, signed net result, and optional note.
- A combined history of session results plus derived deposits and withdrawals.
- Clear labels: `Profit`, `Loss`, `Deposit`, `Withdrawal`, and `Migrated from income`.
- Privacy Mode masking for every monetary value.

The form does not collect individual orders, symbols, position size, leverage, or screenshots.

## Production Migration

The migration is idempotent and transactional.

1. Create the account-purpose field, Trading P/L table, indexes, constraints, and owner-scoped RLS policies.
2. Lock or otherwise stabilize the exact Exness source set for the transaction.
3. Assert exactly one case-insensitive Exness account exists.
4. Mark that account as `trading`.
5. Insert one positive Trading P/L row for every income linked to Exness, copying its amount, transaction date, safe note fields, owner, and source income ID.
6. Use the unique source-income constraint so reruns cannot duplicate migrated P/L.
7. Do not insert, update, or delete the two existing transfer rows. They become visible in Trading automatically through account purpose.
8. Assert all audited Exness-linked income rows have exactly one Trading P/L counterpart.
9. Compare the calculated pre-migration and post-migration total balance. Raise an exception and roll back if they differ.
10. Record only aggregate verification counts in migration evidence; do not export private amounts or notes.

The preflight count observed on 2026-08-17 was one Exness account, two transfers, four incomes, and zero expenses. The migration must evaluate the live source set again instead of hard-coding those counts, because the user may add records before execution.

## Error and Recovery Behavior

- Reject zero or non-finite session results.
- Reject results for missing, archived, non-owned, or non-trading accounts.
- Fail closed when a migrated source reference is malformed or duplicated.
- Keep the household ledger usable if Trading data fails to load; show Trading as unavailable without substituting income or expense behavior.
- Never silently convert an existing income, expense, or transfer based on its description or note.
- A migration failure rolls back schema data changes in the transaction; source rows remain unchanged.

## Security and Privacy

- Enable RLS on `trading_results` before application use.
- Allow authenticated users to select and create only rows whose `user_id = auth.uid()`.
- Allow ordinary update and delete only for owner-scoped manual rows where `source_income_id IS NULL`; migrated rows require the explicit reversal operation.
- Validate that `account_id` belongs to the same authenticated owner.
- Do not expose Exness data, notes, balances, or source IDs in documentation, logs, screenshots, or migration reports.
- Keep migration verification aggregate-only.

## Tests

### Domain regressions

- Deposit and withdrawal remain cashflow-neutral and total-balance-neutral.
- Positive and negative Trading P/L affect only the trading account and total balance.
- Migrated income is excluded exactly once and replaced by equal Trading P/L.
- Previous-period Trading P/L affects current balance but not selected-period P/L.
- Duplicate `source_income_id` cannot double-count.
- Unknown, archived, or non-trading accounts fail closed.
- Daily allowance ignores Exness P/L while responding to a withdrawal into a selected living account.

### Migration verification

- Preflight account and source counts are internally consistent.
- Every eligible legacy income maps to exactly one Trading P/L row.
- Existing transfer IDs and row counts remain unchanged.
- Existing income IDs and row counts remain unchanged.
- Total balance before and after migration is equal.
- Household monthly income decreases only by the migrated source income set.
- RLS denies cross-user reads and writes.

### Application verification

- TypeScript, ESLint, production build, finance regressions, data-integrity regressions, and new Trading tests pass.
- Production browser verification confirms the Trading view, migrated history badges, Privacy Mode, and a safe session-result flow with non-private test data where practical.

## Acceptance Criteria

- Exness is classified as a trading account.
- The two existing Exness transfers appear once as Deposit/Withdrawal and remain ordinary transfer rows.
- The four confirmed legacy Exness incomes appear once as migrated positive Trading P/L and no longer affect household income.
- No existing financial row is deleted.
- Pre/post migration total balance matches exactly.
- New profit or loss is recorded through `Catat hasil sesi`, never household income or expense.
- Daily allowance behavior remains unchanged except when money is transferred into or out of a selected living account.
- Trading data is owner-scoped, server-backed, privacy-masked, tested, and verified in production before completion is claimed.
