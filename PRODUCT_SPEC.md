# RumahBudget Product Spec

## Product Goal

RumahBudget is a mobile-first personal expense tracker with optional future family sharing. The goal is to help household users record daily expenses quickly, monitor monthly spending, and receive weekly or monthly spending summaries by email.

## Target Users

1. Mother
2. Father
3. Admin / Demo User

## Main Problem

Family expenses are often small, frequent, and scattered. Without a simple tracking system, it becomes difficult to know where the money goes, whether monthly spending is still safe, and which spending categories need attention.

## Core Promise

Record expenses quickly, understand monthly financial condition, and receive simple spending reports without needing to open a complicated finance app.

## MVP Features

### V0.1 Local Personal Tracker

Status: Completed

- Next.js + TypeScript + Tailwind setup
- Active user selector
- Personal-first local privacy prototype
- Expense tracking
- Income tracking
- Dashboard totals
- Monthly status: Safe / Warning / Critical
- localStorage persistence
- Combined transaction history
- Transaction filters

Limitations:

- Data is saved only in the current browser
- Real privacy is not implemented yet
- No login/authentication yet
- No cloud database yet

### V0.2 Supabase Database Foundation

Status: Completed

- Supabase project connected
- `expenses` table created
- `incomes` table created
- Expenses saved to Supabase
- Incomes saved to Supabase
- Data persists after refresh
- Active user filtering still works locally
- Selected active user may still be saved in localStorage

Limitations:

- No login/authentication yet
- Active user filtering is still local and not real account privacy
- RLS policies were still development-only at this milestone

Security note: This limitation was addressed in V0.3 with authenticated user rows and user-specific RLS policies.

### V0.3 Supabase Auth + Real Private Accounts

Status: Completed

- Basic Supabase Auth
- Sign up, login, and logout
- Auth session restore after refresh
- Expenses linked to authenticated `user_id`
- Incomes linked to authenticated `user_id`
- Dashboard totals only show the logged-in user's data
- Transaction history only shows the logged-in user's data
- RLS policies restrict users to their own rows
- Account A and Account B data separation tested successfully

Limitations:

- Email reports are not implemented yet
- Family sharing is planned for later
- Budget controls and category limits are not implemented yet
- The old Active User prototype concept has been replaced by real authenticated accounts

### V0.4-A Email Report Preview

Status: Completed

- Generate weekly spending report preview
- Generate monthly spending report preview
- Show total income, expense, remaining balance, status, top category, explanation, and recommendation

### V0.4-B Manual Email Report Testing Mode

Status: Completed

- Manual email sending with Resend
- Server-side email API route
- `RESEND_API_KEY` stored server-side
- `REPORT_TEST_RECIPIENT_EMAIL` testing mode
- Email report can be sent manually from the app
- Email sending currently goes only to the verified Resend testing email
- Next.js app deployed to Vercel
- Supabase and Resend environment variables configured in Vercel
- Production URL is available for testing outside localhost

Limitations:

- Email sending is still in testing mode
- Sending reports to other users or family members requires a verified sender domain in Resend
- Automatic weekly/monthly sending is not implemented yet

Deployment environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `REPORT_TEST_RECIPIENT_EMAIL`

### V0.4-C Cron Endpoint Foundation

Status: Completed

- Protected cron endpoint created at `/api/cron/send-scheduled-reports`
- `CRON_SECRET` protects manual cron calls
- Endpoint verifies Supabase readiness
- No real scheduled sending at this stage

### V0.4-D Email Report Preferences

Status: Completed

- `report_preferences` table added
- Users can enable or disable weekly reports
- Users can enable or disable monthly reports
- Users can save a recipient email preference
- Preferences are loaded per authenticated account
- Preferences are saved with user-specific RLS protection

### V0.4-E Cron Reads Report Preferences

Status: Completed

- Cron endpoint reads `report_preferences`
- Endpoint counts total preferences, weekly-enabled users, and monthly-enabled users
- Real scheduled sending remains disabled

### V0.4-F Scheduled Email Dry Run

Status: Completed

- Cron endpoint processes weekly-enabled users
- Endpoint loads each user's incomes and expenses for the weekly period
- Endpoint generates a simple weekly report summary
- Dry-run email sends only to `REPORT_TEST_RECIPIENT_EMAIL`
- Each scheduled attempt is logged to `email_reports`
- Saved recipient email preferences are not used for real delivery yet

### V0.4-G Vercel Cron Schedule

Status: Completed

- `vercel.json` added
- Vercel Cron configured for `/api/cron/send-scheduled-reports`
- Schedule: `0 0 * * 1`
- Runs Monday 00:00 UTC / around Monday 07:00 WIB
- Cron Jobs enabled in Vercel
- Production cron endpoint tested successfully
- Manual calls still support `Authorization: Bearer <CRON_SECRET>`
- Vercel Cron calls are supported

Current limitations:

- Scheduled email behavior is still dry-run testing mode
- Email is sent only to `REPORT_TEST_RECIPIENT_EMAIL`
- Sending to real saved recipient emails requires a verified Resend domain
- Monthly scheduled report sending is not enabled yet
- Family sharing is planned for later

Next milestone: **V0.5 Production Email Readiness / Verified Domain or Family Sharing**

### Earlier V0.1 Core Tracker Scope

- Add expense
- Add income
- View monthly dashboard
- View transaction history
- Track who paid
- Track category
- Track payment method

### V0.5 Budget Control

- Set monthly budget per category
- Show budget usage percentage
- Show status: Safe, Warning, Over Budget

## Non-Goals for MVP

- Receipt scanner
- WhatsApp integration
- AI auto-categorization
- Multi-family support
- Paid subscription
- Bank account integration
- OCR
- Complex financial planning

## Default Categories

- Groceries
- Daily Meals
- Transport
- Utilities / Internet
- Health
- School / Children
- Installments
- Donations / Social
- Home
- Emergency
- Other

## Success Criteria

The MVP is successful if family members can:

1. Open the app from a phone.
2. Add an expense in under 15 seconds.
3. See monthly income, spending, and remaining balance.
4. Understand whether the month is Safe, Warning, or Over Budget.
5. Receive a weekly or monthly email summary.
