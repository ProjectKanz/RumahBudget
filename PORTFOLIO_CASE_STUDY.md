# RumahBudget Portfolio Case Study

## Project Background

RumahBudget is a private personal finance web application built as a practical full-stack product. It began as a simple expense tracker and evolved into a cyberpunk finance cockpit with authenticated accounts, private database records, account balances, transfers, cashflow visibility, scenario simulation, financial reports, email testing, and scheduled-report automation.

The project was designed to show more than CRUD screens. The goal was to demonstrate product thinking, security-aware architecture, UI direction, and end-to-end implementation across frontend, database, authentication, reporting, and deployment.

## Why I Built It

I built RumahBudget to solve a familiar personal finance problem: money moves through several accounts, but most lightweight trackers focus only on expense entry. I wanted a tool that could show account-level movement, monthly cashflow, and report summaries without feeling like a spreadsheet.

From a portfolio perspective, I also wanted a project that showed:

- Real authentication instead of a prototype user switcher.
- Private user data with database-level protection.
- Account-specific financial records.
- A distinctive visual system instead of a generic dashboard template.
- Server-side workflows such as email reporting and cron automation.
- Product extensions such as sandbox simulation, recurring commitments, offline queueing, and command-style navigation.
- Honest product limitations and a clear roadmap.

## Product Problem

The core product problem is clarity.

Users need to understand the difference between:

- Starting money already available in an account.
- Income recorded during the current month.
- Expenses recorded during the current month.
- Transfers between accounts.
- Current account balance after all linked activity.
- Monthly net cashflow for the current period.

This distinction matters because a user can have no recorded monthly income but still have a positive account balance from an initial balance. RumahBudget keeps those concepts separate so the dashboard does not treat starting balance as income.

## Design Direction

The current visual direction is a cyberpunk financial cockpit:

- Deep black interface.
- Neon cyan, lime, and fuchsia accents.
- Glass-like panels with sharp geometry.
- Monospace numerical values for financial data.
- View-based navigation: Overview, Accounts, Add, Transactions, Reports, Sandbox, Settings.
- Dashboard-style density rather than landing-page spacing.

The design goal is to feel closer to a private trading terminal or finance operating system than a standard personal budget template. The UI uses strong contrast, compact controls, and cockpit language to create a memorable portfolio impression while keeping the product usable.

## Technical Implementation

RumahBudget uses Next.js with TypeScript and React components.

Key implementation areas:

- `app/page.tsx` manages the main app shell, authenticated session, view navigation, state loading, account balance calculations, monthly cashflow calculations, and dashboard metrics.
- `src/components/money-accounts.tsx` handles money account creation, account cards, current balance display, and archive confirmation.
- `src/components/income-form.tsx`, `src/components/expense-form.tsx`, and `src/components/transfer-money.tsx` handle the Quick Add workflows.
- `src/components/transaction-history.tsx` combines income, expense, and transfer records into one ledger view.
- `src/components/dashboard-charts.tsx` visualizes dashboard financial data.
- `src/components/sandbox-controls.tsx` lets users simulate future financial branches without writing real records.
- `src/components/survival-matrix.tsx` and `src/components/system-diagnostics.tsx` turn raw account activity into risk and pattern readouts.
- `src/components/recurring-commitments.tsx` supports subscriptions, rent, installments, and auto-deduct style obligations.
- `src/components/command-k.tsx` provides fast cockpit navigation and command-style transaction entry.
- `src/components/report-preview.tsx` generates weekly and monthly financial summaries.
- `src/components/email-report-history.tsx` and `src/components/email-report-preferences.tsx` support email report workflows.
- `src/components/onboarding-tutorial.tsx` provides guided onboarding.
- `src/components/cockpit-ui.tsx` centralizes reusable UI primitives for the cockpit design system.

The app calculates balances from user-scoped records rather than storing derived balances as a separate source of truth in the UI.

## Database and Security Design

Supabase provides authentication, Postgres persistence, and Row Level Security.

The security model is based on these principles:

- Every user signs in through Supabase Auth.
- Financial rows are connected to the authenticated user.
- RLS policies prevent users from reading or writing other users' records.
- Client-side queries use the Supabase anon key and authenticated session.
- Sensitive server workflows use environment variables.
- The service role key is reserved for server-side reporting and cron workflows.

This creates a meaningful privacy boundary for a personal finance product. The hide/show balance feature improves demo and screen-sharing privacy, but the real data protection comes from authentication and RLS.

## Automation and Email Report System

RumahBudget includes a report system with both manual and scheduled paths.

Manual report testing:

- The user previews a weekly or monthly report in the app.
- The app sends the selected report through a server-side Next.js API route.
- Resend handles email delivery.
- Current delivery is limited to a verified testing recipient.

Scheduled report dry-run:

- Vercel Cron calls the protected scheduled report endpoint.
- The endpoint checks report preferences.
- Weekly-enabled users are processed for report generation.
- Dry-run attempts are logged in email report history.
- Current scheduled behavior is testing-only and does not yet send production reports to saved recipients.

This setup demonstrates automation architecture while staying honest about the current delivery limitations.

## Portfolio Demo Boundary

The strongest demo path is the private money workflow: login, accounts, income, expenses, transfers, dashboard metrics, transaction history, reports, privacy mode, and the Scenario Sandbox. These features show the full product loop without relying on external setup beyond Supabase and the configured demo environment.

Recurring commitment auto-deduct behavior and offline queueing are useful extension features, but I present them as experimental unless the target demo database has all required tables and columns. This keeps the portfolio story honest and avoids implying that every integration is production-hardened.

## Challenges Solved

### Separating Balance From Income

Initial account balance is not monthly income. The app keeps current balance and monthly cashflow separate, so a user can spend from existing money without incorrectly inflating monthly income.

### Transfer-Aware Account Balances

Transfers affect account balances without affecting monthly income or expenses. The app subtracts transfers from the source account and adds them to the destination account.

### Private Multi-User Data

The app moved away from prototype active-user switching and now uses real Supabase Auth with private user rows and RLS.

### Product-Ready UI Direction

The UI went through multiple polish passes to reduce generic dashboard styling and create a more cohesive cyberpunk cockpit system.

### Email and Cron Safety

Email delivery and scheduled reporting were implemented in testing mode first, with protected cron access and clear separation between test recipient delivery and future production delivery.

### Simulation Without Data Pollution

The Scenario Branching Sandbox lets users model future income, expenses, or transfers without mutating real account records. That separation keeps exploratory planning distinct from the trusted ledger.

## What I Learned

- Strong financial UX depends on precise language. "Balance", "income", "expenses", and "cashflow" must not be mixed casually.
- Database privacy should be enforced at the data layer, not only through frontend filtering.
- A portfolio project becomes stronger when it includes product constraints and honest limitations.
- Visual uniqueness needs a design system, not just isolated styling changes.
- Automation features should be shipped carefully, especially when email delivery and private data are involved.
- Portfolio projects are stronger when experimental extensions are clearly labeled instead of hidden or oversold.

## Next Roadmap

- Verify a Resend sender domain for real recipient delivery.
- Enable production scheduled weekly and monthly reports.
- Add category budgets and spend limits.
- Add historical balance charts per account.
- Add CSV or PDF report export.
- Finalize database migrations and QA for recurring commitments and offline sync.
- Add family/shared workspace support.
- Add receipt scanning or OCR-assisted entry.
- Improve small-screen cockpit density and touch ergonomics.
- Explore optional bank integration only if privacy, reliability, and user trust requirements are clear.

## Current Limitations

- Email sending is still in Resend testing mode.
- Real recipient email delivery requires a verified Resend domain.
- Scheduled email is currently dry-run/testing.
- Recurring commitment flows are extension features that need final migration documentation before being treated as production-ready.
- No bank API integration.
- No receipt scanner.
- No native mobile app.
- No automatic transaction import.
- No production family sharing yet.
