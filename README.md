# RumahBudget

RumahBudget is a mobile-first personal expense tracker with optional future family sharing. The current prototype focuses on quick daily tracking, simple monthly totals, and privacy-first local records per selected user.

## Current Milestone

### V0.2 Supabase Database Foundation

Completed features:

- Next.js + TypeScript + Tailwind setup
- Active user selector
- Personal-first local privacy prototype
- Expense tracking
- Income tracking
- Dashboard totals
- Monthly status: Aman / Waspada / Bahaya
- Combined transaction history
- Transaction filters
- Supabase project connected
- `expenses` table created
- `incomes` table created
- Expenses saved to Supabase
- Incomes saved to Supabase
- Data persists after refresh
- Active user filtering still works locally

Current limitations:

- Selected active user may still be saved in localStorage
- Active user filtering is a local prototype, not real account privacy
- No login/authentication yet
- Current RLS policies are development-only because anon users can select, insert, and delete rows

Security warning: **Development RLS policies must be replaced before public deployment.**

Next milestone: **V0.3 Supabase Auth + Real Private Accounts**

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
