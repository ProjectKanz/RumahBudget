# RumahBudget

RumahBudget is a private personal finance cockpit for tracking accounts, cashflow, transfers, transaction history, and financial reports in one dark cyberpunk dashboard.

The app is designed as a portfolio-focused full-stack prototype: authenticated users can manage their own financial records, review monthly cashflow, preview reports, and test automated email summaries without exposing private data between accounts.

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
- Portfolio reviewers who want to see a practical full-stack app with auth, database privacy, UI polish, reporting, and automation.

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
- Dashboard metrics and charts for monthly cashflow, account balances, and category visibility.
- Transaction history with income, expense, and transfer records.
- Financial report preview for weekly or monthly periods.
- Manual email report testing mode using Resend.
- Email report history.
- User-level email report preferences.
- Protected Vercel Cron dry-run endpoint for scheduled reports.
- Live guided onboarding.
- Cyberpunk cockpit-style view navigation: Overview, Accounts, Add, Transactions, Reports, and Settings.

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
- `src/components/*` contains reusable product modules such as auth, money accounts, forms, transaction history, reports, email preferences, onboarding, and cockpit UI primitives.
- `src/types/*` contains TypeScript models for accounts, income, expenses, transfers, users, and email reports.
- `src/lib/supabase.ts` initializes the Supabase client from public environment variables.
- `app/api/send-report/route.ts` handles manual email report sending in test mode.
- `app/api/cron/send-scheduled-reports/route.ts` handles protected scheduled report dry-runs.
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
9. The Settings view contains email report history, report preferences, manual email testing, and onboarding controls.

## Current Limitations

- Email sending is still in Resend testing mode.
- Real recipient email delivery requires a verified Resend sender domain.
- Scheduled email reporting is currently dry-run/testing.
- Saved recipient preferences are prepared for reporting workflows, but production delivery requires verified email setup.
- No bank API integration.
- No receipt scanner or OCR.
- No native mobile app.
- No automatic transaction import.
- No multi-user family workspace yet.
- No budget caps or category limit alerts yet.

## Roadmap

- Production-ready email delivery with a verified Resend domain.
- Real scheduled weekly and monthly reports to saved recipients.
- Category budgets and spending limits.
- Better account analytics and historical balance trends.
- Family or shared household mode.
- Export reports to CSV or PDF.
- Receipt scanning or OCR-assisted expense entry.
- Optional bank integration if privacy and reliability requirements can be met.
- More responsive polish for small mobile screens.

## Deployment Note

The app is designed for deployment on Vercel with Supabase and Resend environment variables configured in the deployment dashboard.

The cron endpoint is scheduled through `vercel.json`. In the current version, scheduled report execution remains a dry-run/testing workflow.

## Environment Variables

Create `.env.local` for local development and configure the same keys in Vercel for deployment. Do not commit actual values.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
REPORT_TEST_RECIPIENT_EMAIL=
CRON_SECRET=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required by the client app.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `REPORT_TEST_RECIPIENT_EMAIL` are used for email report testing.
- `CRON_SECRET` protects manual cron endpoint calls.

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
