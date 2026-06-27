# RumahBudget Demo Script

Use this script to record a concise portfolio demo for LinkedIn, GitHub, or a project case study page. The tone should be confident, practical, and honest. Avoid overselling the app as a finished commercial banking product.

Recommended demo boundary: focus on auth, accounts, income, expenses, transfers, dashboard metrics, transaction history, reports, privacy mode, and the Scenario Sandbox. Treat Telegram, recurring commitment auto-deduct, and offline queueing as experimental extensions unless the demo database is configured for them.

## 3-Minute Demo Script

### 0:00-0:20 - Opening

"This is RumahBudget, a private personal finance cockpit I built with Next.js, Supabase, and Resend. It helps users track money accounts, income, expenses, transfers, monthly cashflow, transaction history, scenario planning, and financial reports from one authenticated dashboard."

Show the login screen, then sign in.

### 0:20-0:45 - Dashboard Overview

"After login, the user lands in a cyberpunk-style finance cockpit. The main dashboard shows Total Account Balance, Monthly Income, Monthly Expenses, Monthly Net Cashflow, Monthly Cashflow Status, and runway-style risk signals."

Point out hide/show balance mode.

"I also added a privacy mode so balances can be hidden during screen sharing or demos."

### 0:45-1:20 - Accounts and Quick Add

"The Accounts view lets users create money accounts with an initial balance. Current balance is calculated from initial balance, income, expenses, and transfers."

Open Accounts, show an account card, then go to Add.

"The Add view keeps income, expense, and transfer workflows in one command center while showing only one active form at a time."

Add or show an income, expense, and transfer.

### 1:20-1:55 - Transactions and Charts

"Every record flows into the transaction history, including income, expenses, and transfers. Transfers move money between accounts without being counted as income or expenses."

Open Transactions, switch filters, then return to Overview.

"The dashboard charts make the month easier to scan without requiring a spreadsheet."

### 1:55-2:25 - Reports and Email

"The Reports view generates weekly or monthly financial summaries. I also built a manual email report flow using a server-side API route and Resend."

Open Reports, switch weekly/monthly preview, then send a test report if safe.

"Email delivery is currently in Resend testing mode, so real recipient delivery requires a verified sender domain."

### 2:25-2:45 - Scenario Sandbox

Open Sandbox.

"The Sandbox lets users simulate future income, expenses, and transfers without changing the trusted ledger. That helps separate planning from real financial records."

### 2:45-3:00 - Wrap-Up

"The backend uses Supabase Auth and Row Level Security so each user only sees their own financial data. Scheduled report automation is wired through Vercel Cron as a dry-run workflow. This project shows full-stack product thinking: auth, private data, financial logic, simulation, reporting, automation, and a custom UI system."

## 5-Minute Demo Script

### 0:00-0:30 - Product Intro

"RumahBudget is a private finance cockpit for people who want to track money manually without connecting a bank account. The product focuses on account balances, monthly cashflow, transfers, transaction history, scenario planning, and reports."

"I designed it to feel less like a generic budget template and more like a compact financial terminal."

### 0:30-1:00 - Authentication and Privacy

Show login/signup.

"The app uses Supabase Auth for login, signup, session restore, and logout. Each financial record is tied to the authenticated user, and Supabase Row Level Security protects private data at the database level."

Sign in.

### 1:00-1:45 - Overview Cockpit

Show Overview.

"The Overview view gives the user the main financial readout: Total Account Balance, Monthly Income, Monthly Expenses, Monthly Net Cashflow, and Monthly Cashflow Status."

"One important product decision is that initial account balance does not count as monthly income. If a user spends from existing balance without recording income this month, the app explains that clearly instead of incorrectly saying the user is broke."

Toggle hide/show balance.

"The balance privacy mode is useful when recording demos or checking finances in public."

### 1:45-2:25 - Money Accounts

Open Accounts.

"The Money Accounts view is the balance registry. Users can create accounts such as bank accounts, cash wallets, or e-wallets. Each card shows the initial starting balance and the calculated current balance."

"Current balance is calculated from initial balance, linked income, linked expenses, and transfers."

Create or show an account.

### 2:25-3:10 - Quick Add Workflows

Open Add.

"The Quick Add Command Center keeps the three main money movements together: income, expense, and transfer."

Click Income.

"Income increases the selected account and contributes to monthly income."

Click Expense.

"Expenses reduce the selected account and contribute to monthly expenses."

Click Transfer.

"Transfers move money between two accounts. They affect account balances but do not count as income or expenses."

### 3:10-3:45 - Transactions and Charts

Open Transactions.

"The Transaction History view combines all ledger records. Users can filter by income, expenses, or transfer records."

Return to Overview and show charts.

"The charts give a quick visual read of monthly activity and category concentration."

### 3:45-4:15 - Scenario Sandbox

Open Sandbox.

"The Scenario Sandbox is where the cockpit becomes more than a ledger. Users can model a future raise, new subscription, emergency expense, or transfer plan and see how it changes projected balance and runway. These simulated branches are stored separately from real financial records."

### 4:15-4:45 - Reports and Email

Open Reports.

"The Reports view generates weekly or monthly financial summaries. The preview includes income, expenses, net cashflow, status, top spending category, explanation, and recommendation."

Send a test email only if the environment is configured.

"The email report system uses a server-side Next.js route and Resend. Right now this is intentionally in testing mode. Real recipient delivery needs a verified Resend domain."

### 4:45-5:00 - Settings, Automation, and Roadmap

Open Settings.

"Settings includes email report preferences, recurring commitments, onboarding controls, wage-based spending context, and optional Telegram setup. Scheduled reporting is connected to Vercel Cron, currently as a dry-run testing endpoint."

"Next steps would be verified-domain email delivery, production scheduled reports, finalized migration docs for extension features, category budgets, exports, and maybe family workspace support."

## Click-by-Click Walkthrough

### Login

1. Open the deployed RumahBudget URL or local app.
2. Enter the demo email and password.
3. Click the login button.
4. Wait for the Overview cockpit to load.

Suggested narration:

"I start by signing into a private account. The app restores the authenticated session and loads only this user's financial records."

### Create Account

1. Click `Accounts`.
2. Find the Create Account form.
3. Enter an account name, account type, and initial balance.
4. Submit the form.
5. Show the new account card.

Suggested narration:

"Each account has an initial starting balance. The current balance is calculated from future income, expenses, and transfers."

### Add Income

1. Click `Add`.
2. Select the `Income` tab.
3. Choose an account.
4. Enter the income source and amount.
5. Save the income.
6. Return to Overview and show Monthly Income or Total Account Balance updating.

Suggested narration:

"Income is attached to a specific account, so the dashboard can update both monthly income and account balance."

### Add Expense

1. Click `Add`.
2. Select the `Expense` tab.
3. Choose an account.
4. Enter amount, category, payment method, and note if needed.
5. Save the expense.
6. Return to Overview and show Monthly Expenses or Monthly Net Cashflow updating.

Suggested narration:

"Expenses are also account-specific, which makes the ledger more useful than a single global expense list."

### Transfer Money

1. Click `Add`.
2. Select the `Transfer` tab.
3. Choose the source account.
4. Choose the destination account.
5. Enter the amount.
6. Save the transfer.
7. Open Accounts and show both account balances changing.

Suggested narration:

"A transfer moves money between accounts. It changes balances, but it does not count as income or expense."

### Hide/Show Balance

1. Go to Overview.
2. Click the hide/show balance control.
3. Show balances becoming hidden.
4. Click again to reveal balances.

Suggested narration:

"This privacy mode is useful for recording demos, screen sharing, or checking the app in public."

### View Charts

1. Go to Overview.
2. Scroll to the dashboard charts.
3. Point out monthly cashflow and category activity.

Suggested narration:

"The charts provide a quick visual scan of the month without forcing users into a spreadsheet."

### Open Transaction History

1. Click `Transactions`.
2. Show all ledger records.
3. Click `Income`.
4. Click `Expenses`.
5. Click `Transfer`.
6. Return to `All`.

Suggested narration:

"Transaction History combines every money movement in one ledger, with filters for each record type."

### Generate Financial Report

1. Click `Reports`.
2. Select `Weekly` or `Monthly`.
3. Review the report preview.
4. Point out income, expenses, net cashflow, top category, and recommendation.

Suggested narration:

"The report preview turns the raw ledger into a readable financial summary."

### Open Scenario Sandbox

1. Click `Sandbox`.
2. Add a simulated recurring expense or one-time expense.
3. Toggle Sandbox mode if it is not already active.
4. Return to Overview and show how the metrics are visually marked as simulated.
5. Remove the simulated branch or disable Sandbox mode before continuing the core ledger demo.

Suggested narration:

"The Sandbox helps users ask 'what if' questions without polluting their real financial records."

### Send Test Email Report

1. Stay in `Reports`.
2. Confirm the local or deployed environment has Resend variables configured.
3. Click the manual send report button.
4. Show the success or history state.

Suggested narration:

"Manual email sending is implemented through a server-side route. At this stage, Resend is still in testing mode, so reports go only to the verified test recipient."

### Show Email Preferences

1. Click `Settings`.
2. Open the email report preferences area.
3. Show weekly and monthly preference toggles.
4. Show recipient email preference.

Suggested narration:

"Users can save report preferences now. Production delivery to saved recipients requires verified-domain email setup."

### Show Onboarding

1. Click `Settings`.
2. Start or restart onboarding.
3. Step through the guided product tour.

Suggested narration:

"The onboarding flow helps new users understand the cockpit views without needing a separate tutorial page."

## Suggested LinkedIn Narration

"I built RumahBudget as a private personal finance cockpit using Next.js, TypeScript, Supabase, Resend, and Vercel. The app includes authentication, Row Level Security, money accounts, income and expense tracking, transfers, calculated balances, monthly cashflow status, transaction history, financial reports, email report testing, Vercel Cron dry-runs, and guided onboarding."

"The main product challenge was separating account balance from monthly income. Initial balance should not be treated as income, transfers should not inflate cashflow, and the dashboard copy needs to explain those differences clearly."

"I also added a Scenario Sandbox so users can simulate future expenses or income without changing the actual ledger. That was important because planning data and real financial history should stay separate."

"Design-wise, I moved away from a standard dashboard template and built a darker cyberpunk cockpit interface with neon accents, compact navigation, glass panels, and monospace financial numbers."

"This is still not a finished commercial banking product. Email sending is in Resend testing mode, scheduled reports are dry-run, Telegram and recurring commitments are experimental extensions, and there is no bank integration, no receipt scanner, and no native mobile app. But as a portfolio project, it demonstrates full-stack execution across product design, frontend architecture, private data, financial logic, simulation, reporting, automation, and deployment."

## Demo Prep Checklist

- Use a dedicated demo account, not a personal account.
- Prepare two accounts before recording if you want the transfer demo to move quickly.
- Use clean sample data with realistic but non-sensitive numbers.
- Keep `.env.local` closed during recording.
- Do not show API keys, Supabase dashboard secrets, Resend keys, or Vercel environment values.
- Mention testing limitations clearly when showing email or cron features.
- Mention Telegram, recurring commitments, and offline queueing as extensions unless they are part of the prepared demo path.
- Keep the recording focused on product flow, not code internals.
