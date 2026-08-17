# Daily Spending Allowance Design

## Goal

Add a trustworthy daily spending allowance to the current Summary view so the user can see how much money is safe to spend each day until the next payday.

The allowance must use only user-selected living-expense accounts, exclude accounts such as Exness unless explicitly selected, reserve unpaid commitments that will be paid from those accounts, and avoid presenting uncertain data as a valid zero.

## Confirmed Product Decisions

- Payday is the 25th of every month.
- A pay cycle runs from the 25th through the 24th.
- Financial day boundaries use Asia/Jakarta time.
- Today is included in the remaining-day denominator.
- The displayed allowance is rounded down to the nearest Rp1,000.
- Living-expense accounts are selected explicitly by the user.
- The primary preference store is Supabase `report_preferences`; per-user localStorage is the fallback.
- The card is hidden when a historical calendar month is selected.
- In Simulation Mode the card shows the actual allowance with a clear `Tidak termasuk simulasi` disclosure.
- Automatic safety buffers and partial commitment payments are outside the MVP.

## Existing Financial Invariants

Current account balance remains:

```text
initial balance
+ linked income
- linked expenses
+ transfers in
- transfers out
```

Internal transfers remain neutral to total balance. The new feature derives a subset balance from the existing per-account balances and must not alter the existing finance snapshot behavior.

## Calculation Model

```text
livingBalance
= sum of current balances for selected, active living accounts

reservedCommitments
= sum of eligible unpaid commitment occurrences whose effective payment
   account is a selected living account

disposableBalance
= max(0, livingBalance - reservedCommitments)

rawDailyAllowance
= disposableBalance / remainingSpendableDays

dailyAllowance
= floor(rawDailyAllowance / 1000) * 1000
```

`remainingSpendableDays` is the number of Asia/Jakarta calendar dates from today through the 24th, inclusive. It is always at least one for a valid cycle.

## Pay-Cycle Semantics

- If the WIB date is on or after the 25th, the cycle starts on the 25th of the current month.
- If the WIB date is before the 25th, the cycle starts on the 25th of the previous month.
- The cycle ends on the 24th of the month after the cycle start.
- On the 24th, one spendable day remains.
- On the 25th, a new cycle begins even if salary income has not yet been recorded.
- Recording salary into a selected living account changes the allowance through the existing reactive account-balance calculation.
- The date calculation must cover year rollover and the February 25 to March 24 cycle in leap and non-leap years.
- The client must refresh the financial date when the window regains focus and when midnight WIB passes.

## Living-Account Preference

The preferred Supabase representation is `report_preferences.living_account_ids`, containing account UUIDs. The exact migration must be drafted under `supabase/review-only/` and must not be applied to production without separate approval.

The fallback key is:

```text
rumahbudget.livingAccountIds.{userId}
```

Rules:

- A successfully loaded Supabase value is authoritative.
- If Supabase or the new column is unavailable, use the local value.
- Saving writes the Supabase preference and a local copy.
- A failed remote save keeps the session selection and local copy, and exposes a non-blocking unsynced warning.
- A new account is excluded until the user opts in.
- Archived, missing, and stale account IDs do not participate in the calculation.
- No selection produces a setup state, not a numeric zero.

## Commitment Occurrence and Payment Truth

The existing `lastProcessed` field is not sufficient to prove that the commitment occurrence inside the current pay cycle was paid. A payment is proven by the recurring metadata on its expense:

```text
expense.recurringCommitmentId == commitment.id
AND
expense.recurringPeriod == calendar month containing the effective due date
```

The client expense type and Supabase row mapping must retain `recurring_commitment_id` and `recurring_period`, which already exist in the database.

For each commitment:

1. Derive the single effective due date inside the current 25-to-24 cycle, clamping a due day beyond the month's last day.
2. Resolve its effective payment account:
   - use its explicit active `accountId`; or
   - when no account is linked, use the oldest active account, matching the current RPC behavior.
3. Include the amount in the reserve only when the effective payment account is selected as a living account and no matching recurring expense exists.
4. Keep overdue unpaid occurrences reserved.
5. Exclude occurrences paid from either living or non-living accounts, because the liability is settled.
6. If amount, due day, effective account, date, or recurring metadata is inconsistent, return a review-required state instead of a numeric allowance.

Do not match payments by transaction description, note, or name.

## Result States

- `ready`: calculation is complete and trustworthy.
- `setup-required`: no living account is selected.
- `no-disposable-balance`: the calculation is valid but the disposable balance is zero.
- `review-required`: required account, commitment, date, or payment data is inconsistent.

The result must keep `livingBalance`, `reservedCommitments`, `disposableBalance`, `remainingSpendableDays`, and `dailyAllowance` together so UI states do not reconstruct finance logic independently.

## Summary Card

The card appears near the current total balance and does not replace it.

Primary copy:

```text
Rp105.000
boleh dipakai hari ini
```

Supporting values:

- Saldo akun hidup
- Disiapkan untuk tagihan
- Saldo bebas
- Days remaining and selected-account count

Minimum actions:

- `Atur akun`
- `Lihat komitmen`

All monetary values must follow Privacy Mode. Day and account counts may remain visible.

Additional behavior:

- Historical calendar month selected: hide the entire card.
- Simulation Mode active: show the actual allowance and `Tidak termasuk simulasi`.
- Preference save failed: keep the card usable and show `Pilihan belum tersinkron`.
- Review required: hide the primary allowance and explain what must be reviewed.
- Valid zero: show Rp0 with an explicit explanation rather than presenting it as missing data.

## MVP Exclusions

- Automatic or inferred safety buffer
- Partial commitment payments
- Historical daily-allowance reconstruction
- Per-account sandbox projections
- Account eligibility inferred from name or account type
- Description-based payment matching
- Broad finance-calculation refactors
- New runtime dependencies

## Verification Requirements

Automated tests must cover:

- selected living accounts versus excluded Exness balance;
- every transfer direction across living/non-living boundaries;
- expenses from living and non-living accounts;
- the 24th and 25th boundaries;
- WIB day semantics, year rollover, and February 25 to March 24 in leap and non-leap years;
- conservative Rp1,000 rounding;
- valid zero versus setup-required and review-required states;
- exact recurring-period payment matching;
- a previous calendar-period payment not settling the new occurrence;
- overdue commitments;
- explicit, fallback, missing, and archived payment accounts;
- negative selected-account balances;
- Privacy Mode rendering;
- Historical Month hiding;
- Simulation Mode disclosure;
- Supabase preference success and local fallback behavior where practical.

Verification must include targeted Node tests, ESLint, TypeScript checking, a production build, and a focused browser check when a local authenticated runtime is available.

## Expected File Boundaries

- `src/lib/pay-cycle.ts`: pure Asia/Jakarta pay-cycle functions.
- `src/lib/daily-allowance.ts`: pure allowance and commitment-occurrence calculation.
- `src/components/daily-allowance-card.tsx`: presentation and account-selection UI.
- `src/types/expense.ts`: recurring payment metadata.
- `app/page.tsx`: data mapping, preference persistence, financial-date refresh, and component wiring.
- `tests/pay-cycle.test.mjs`: date-boundary regressions.
- `tests/daily-allowance.test.mjs`: finance and commitment regressions.
- `supabase/migrations/20260817_living_account_preferences.sql`: approved and applied preference-column migration.
