# RumahBudget

RumahBudget is a private personal finance cockpit for tracking accounts, cashflow, transfers, transaction history, financial reports, and short-term money runway in one dark cyberpunk dashboard.

The app is designed as a portfolio-grade full-stack product: authenticated users can manage their own financial records, review monthly cashflow, preview reports, and test automated email summaries without exposing private data between accounts.

## Problem Statement

Personal finance tools often split important context across multiple screens: account balances, cashflow, transfers, spending history, and reporting are treated as separate workflows. For a household or individual user, this makes it harder to answer simple questions quickly:

- How much money do I have across all accounts?
- Where did my money move this month?
- Is my monthly cashflow healthy?
- Can I review my financial activity without opening a spreadsheet?
- Can I receive a lightweight report without manually preparing one?

RumahBudget focuses on turning those questions into a compact cockpit-style workflow.

## Target Users

- Individuals who want a private money tracker without connecting a bank account.
- Household users who need a simple record of income, expenses, and transfers.
- Freelancers or side-hustle owners who manage cash across several accounts.
- Portfolio reviewers who want to see a practical full-stack app with auth, database privacy, financial logic, UI polish, reporting, automation, and careful product limitations.

## Core Features

- Supabase Auth login, signup, session restore, and logout.
- Private user data protected by Supabase Row Level Security.
- Money accounts with account type, initial balance, and calculated current balance.
- Account-specific income and expense records.
- Transfers between accounts.
- Total Account Balance across all active accounts.
- Monthly Income, Monthly Expenses, and Monthly Net Cashflow.
- Monthly Cashflow Status that distinguishes spending from existing balance versus spending beyond income.
- Hide/show balance privacy mode.
- Dashboard charts for monthly cashflow and category visibility.
- Survival Runway and Spend Signal readings for short-term financial risk.
- Scenario Branching Sandbox for simulating future income, expenses, and transfers without changing real ledger records.
- System Diagnostics for surfacing repeated expense patterns and budget pressure.
- Transaction history with income, expense, and transfer records.
- Financial report preview for weekly or monthly periods.
- Manual email report testing mode using Resend.
- Email report history.
- User-level email report preferences.
- Protected Vercel Cron dry-run endpoint for scheduled reports.
- Recurring commitments for subscriptions, rent, installments, and pay-later obligations.
- Offline transaction queue for income and expense entries while the browser is offline.
- Command palette for fast cockpit navigation and quick entry.
- Optional Telegram bot workflow for logging income/expenses and checking balances from chat.
- Live guided onboarding.
- Cyberpunk cockpit-style view navigation: Overview, Accounts, Add, Transactions, Reports, Sandbox, and Settings.
- Money Allocation + Portfolio Watch view for local/manual allocation templates, bucket balances, manual portfolio transactions, manual price snapshots, mock/static price checks, and safe BTC latest-price fetching through a server-side route.

## Portfolio Demo Scope

For a job-search demo, the most reliable story is the core private finance workflow:

- Authentication and private user-scoped records.
- Money accounts, income, expenses, transfers, and calculated balances.
- Overview metrics, transaction history, charts, report preview, and email report testing.
- Scenario Sandbox as a visual product-thinking feature.
- Scheduled reports as a protected dry-run automation workflow.

The Telegram integration, recurring commitment auto-deduct flow, and offline queue are best presented as experimental extensions unless the target demo database has the required tables and columns configured.

## Tech Stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** React, Tailwind CSS
- **Database:** Supabase Postgres
- **Authentication:** Supabase Auth
- **Security:** Supabase Row Level Security policies
- **Email:** Resend
- **Automation:** Vercel Cron
- **Deployment:** Vercel
- **Tooling:** ESLint, npm

## Architecture Overview

RumahBudget uses a Next.js App Router structure with a client-side finance cockpit and server-side API routes for email and cron workflows.

- `app/page.tsx` contains the main authenticated app shell, view-based navigation, dashboard calculations, and user session handling.
- `src/components/*` contains reusable product modules such as auth, money accounts, forms, transaction history, reports, sandbox controls, recurring commitments, diagnostics, email preferences, onboarding, command palette, and cockpit UI primitives.
- `src/types/*` contains TypeScript models for accounts, income, expenses, transfers, sandbox transactions, recurring commitments, users, and email reports.
- `src/lib/supabase.ts` initializes the Supabase client from public environment variables.
- `app/api/send-report/route.ts` handles manual email report sending in test mode.
- `app/api/cron/send-scheduled-reports/route.ts` handles protected scheduled report dry-runs.
- `app/api/recurring-commitments/route.ts` handles authenticated recurring commitment reads and writes.
- `app/api/telegram/*` contains the optional Telegram webhook registration and bot command workflow.
- `vercel.json` defines the cron schedule for the scheduled report endpoint.

Financial calculations are performed in the application layer from authenticated, user-scoped records:

```text
Current account balance =
initial balance
+ linked income
- linked expenses
+ transfers in
- transfers out
```

Monthly cashflow only uses transactions recorded in the selected month. Initial account balance is not counted as monthly income.

## Security and Privacy

RumahBudget is built around private authenticated records.

- Supabase Auth identifies the current user.
- Financial rows are linked to the authenticated user.
- Supabase Row Level Security restricts users to their own data.
- The public Supabase anon key is used only for client-safe operations.
- Server-only secrets such as Resend and cron credentials are stored in environment variables.
- The Supabase service role key is used only in server-side cron/report workflows where elevated access is required.
- Telegram bot tokens are optional demo/extension secrets and should never be committed.
- Hide/show balance mode is a UI privacy feature for screen sharing and demos, not a replacement for authentication or database security.

No API keys or secret values should be committed to the repository.

## Product Flow

1. User signs up or logs in with Supabase Auth.
2. User lands in the private finance cockpit.
3. User creates one or more money accounts with starting balances.
4. User records income, expenses, or transfers from the Add view.
5. The Overview view updates Total Account Balance, Monthly Net Cashflow, charts, and Spend Signal readings.
6. The Accounts view shows current balance and initial balance context per account.
7. The Transactions view shows ledger records across income, expenses, and transfers.
8. The Reports view previews weekly or monthly financial summaries.
9. The Sandbox view lets the user model possible future money movement without writing records to the database.
10. The Settings view contains email report history, report preferences, recurring commitments, optional Telegram setup, wage-based life-energy settings, and onboarding controls.

## Current Limitations

- Email sending is still in Resend testing mode.
- Real recipient email delivery requires a verified Resend sender domain.
- Scheduled email reporting is currently dry-run/testing.
- Saved recipient preferences are prepared for reporting workflows, but production delivery requires verified email setup.
- Telegram support is an optional experimental extension and requires bot setup plus database columns for chat linking.
- Recurring commitments require the `recurring_commitments` table; the app includes fallback messaging when the table is not available.
- Some extension fields such as `net_hourly_wage`, `telegram_bot_token`, and `telegram_chat_id` must exist in `report_preferences` before those settings are fully persistent.
- No bank API integration.
- No receipt scanner or OCR.
- No native mobile app.
- No automatic transaction import.
- No multi-user family workspace yet.
- No budget caps or category limit alerts yet.
- Money Allocation + Portfolio Watch V1-V3 stores allocation and portfolio records in browser localStorage first; core Supabase ledger tables are not migrated yet.
- BTC latest price uses a server-side public CoinGecko request. BBCA/BBRI live prices remain manual until a reliable licensed IDX market-data provider is selected.

## Roadmap

- Production-ready email delivery with a verified Resend domain.
- Real scheduled weekly and monthly reports to saved recipients.
- Category budgets and spending limits.
- Better account analytics and historical balance trends.
- Family or shared household mode.
- Export reports to CSV or PDF.
- Promote Telegram and recurring commitments from experimental to fully documented production features after migrations and final QA.
- Receipt scanning or OCR-assisted expense entry.
- Optional bank integration if privacy and reliability requirements can be met.
- More responsive polish for small mobile screens.

## Deployment Note

The app is designed for deployment on Vercel with Supabase and Resend environment variables configured in the deployment dashboard.

The cron endpoint is scheduled through `vercel.json`. In the current version, scheduled report execution remains a dry-run/testing workflow.

## Environment Variables

Copy `.env.example` to `.env.local` for local development and configure the same keys in Vercel for deployment. Do not commit actual values.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
REPORT_TEST_RECIPIENT_EMAIL=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_LINK_SECRET=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required by the client app.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `REPORT_TEST_RECIPIENT_EMAIL` are used for email report testing.
- `CRON_SECRET` protects manual cron endpoint calls.
- `TELEGRAM_BOT_TOKEN` is an optional server-side fallback for Telegram replies.
- `TELEGRAM_WEBHOOK_SECRET` authenticates Telegram webhook requests and `TELEGRAM_LINK_SECRET` signs short-lived account-link commands. Use separate random values of at least 32 URL-safe characters.

## Database Notes

The core portfolio demo expects Supabase tables for authenticated user financial records:

- `money_accounts`
- `incomes`
- `expenses`
- `transfers`
- `email_reports`
- `report_preferences`

Extension features may also require:

- `recurring_commitments`
- `report_preferences.net_hourly_wage`
- `report_preferences.telegram_bot_token`
- `report_preferences.telegram_chat_id`

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) to view the app locally.
