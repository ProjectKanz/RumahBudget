# RumahBudget

RumahBudget is a mobile-first personal expense tracker with optional future family sharing. The current version focuses on quick daily tracking, simple monthly totals, and private records per authenticated account.

## Current Milestone

### V0.3 Supabase Auth + Real Private Accounts

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

Current limitations:

- Email reports are not implemented yet
- Family sharing is planned for later
- Budget controls and category limits are not implemented yet

Note: the old Active User prototype has been replaced by real authenticated accounts.

Next milestone: **V0.4 Email Reports**

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
