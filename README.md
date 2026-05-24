# RumahBudget

RumahBudget is a mobile-first personal expense tracker with optional future family sharing. The current version focuses on quick daily tracking, simple monthly totals, and private records per authenticated account.

## Current Milestone

### V0.4-B Manual Email Report Testing Mode

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

Current limitations:

- Email sending is still in testing mode
- Sending reports to other users or family members requires a verified sender domain in Resend
- Automatic weekly/monthly sending is not implemented yet
- Family sharing is planned for later
- Budget controls and category limits are not implemented yet

Note: the old Active User prototype has been replaced by real authenticated accounts.

Next milestone: **V0.4-C Automatic Weekly / Monthly Email Scheduling**

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
