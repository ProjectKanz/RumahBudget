# RumahBudget Product Spec

## Product Goal

RumahBudget is a mobile-first family expense tracker designed for non-technical household users. The goal is to help family members record daily expenses quickly, monitor monthly spending, and receive weekly or monthly spending summaries by email.

## Target Users

1. Mother
2. Father
3. Admin / Kanzan

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
- Monthly status: Aman / Waspada / Bahaya
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
- Current RLS policies are development-only because anon users can select, insert, and delete rows

Security warning: Development RLS policies must be replaced before public deployment.

### V0.3 Supabase Auth + Real Private Accounts

Next milestone:

- Add Supabase Auth
- Replace local active user mode with real accounts
- Restrict database rows by authenticated user
- Replace development RLS policies with production-safe policies

### Earlier V0.1 Core Tracker Scope

- Add expense
- Add income
- View monthly dashboard
- View transaction history
- Track who paid
- Track category
- Track payment method

### V0.4 Budget Control

- Set monthly budget per category
- Show budget usage percentage
- Show status: Safe, Warning, Over Budget

### V0.5 Email Report

- Generate weekly spending report
- Generate monthly spending report
- Send report to selected family emails
- Save email report history

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

- Belanja Dapur
- Makan Harian
- Transport
- Listrik / Air / Internet
- Kesehatan
- Sekolah / Anak
- Cicilan
- Sedekah / Sosial
- Rumah
- Darurat
- Lainnya

## Success Criteria

The MVP is successful if family members can:

1. Open the app from a phone.
2. Add an expense in under 15 seconds.
3. See monthly income, spending, and remaining balance.
4. Understand whether the month is Safe, Warning, or Over Budget.
5. Receive a weekly or monthly email summary.
