# RumahBudget

RumahBudget is a mobile-first personal expense tracker with optional future family sharing. The current version focuses on quick daily tracking, simple monthly totals, and private records per authenticated account.

## Current Milestone

### V0.4-G Vercel Cron Schedule

Completed features:

- Next.js + TypeScript + Tailwind setup
- Basic Supabase Auth
- Sign up, login, and logout
- Auth session restore after refresh
- Expense tracking
- Income tracking
- Dashboard totals
- Monthly status: Aman / Waspada / Bahaya
- Combined transaction history
- Transaction filters
- Supabase project connected
- `expenses` table created
- `incomes` table created
- Expenses linked to authenticated `user_id`
- Incomes linked to authenticated `user_id`
- Data persists after refresh
- Dashboard totals only show the logged-in user's data
- Transaction history only shows the logged-in user's data
- RLS policies restrict users to their own rows
- Account A and Account B data separation tested successfully
- Financial report preview
- Manual email sending with Resend
- Server-side email API route
- `RESEND_API_KEY` stored server-side
- `REPORT_TEST_RECIPIENT_EMAIL` testing mode
- Email report can be sent manually from the app
- Email sending currently goes only to the verified Resend testing email
- Email report history/logging
- User-level email report preferences
- Weekly and monthly report preference toggles
- Recipient email preference saved per authenticated user
- Protected cron endpoint with `CRON_SECRET`
- Scheduled email dry-run endpoint
- Dry-run weekly reports load each user's income and expense data
- Dry-run attempts are logged to `email_reports`
- `vercel.json` cron schedule added for `/api/cron/send-scheduled-reports`
- Vercel Cron schedule: `0 0 * * 1` Monday 00:00 UTC / around Monday 07:00 WIB
- Deployed to Vercel with Supabase and Resend environment variables configured
- Cron Jobs enabled in Vercel
- Production cron endpoint tested successfully
- Production URL is available for testing outside localhost

Current limitations:

- Email sending is still in testing mode
- Scheduled emails are dry-run only
- Scheduled dry-run emails are sent only to `REPORT_TEST_RECIPIENT_EMAIL`
- Saved recipient email preferences are not used for real delivery yet
- Sending to real user or family recipient emails requires a verified Resend domain
- Monthly scheduled processing is not enabled yet
- Family sharing is planned for later
- Budget controls and category limits are not implemented yet

Note: the old Active User prototype has been replaced by real authenticated accounts.

Next milestone: **V0.5 Production Email Readiness / Verified Domain or Family Sharing**

## Deployment

Status: Deployed to Vercel.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `REPORT_TEST_RECIPIENT_EMAIL`
- `CRON_SECRET`

Email sending is still in Resend testing mode, so reports are sent only to the verified testing recipient until a sender domain is verified.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
