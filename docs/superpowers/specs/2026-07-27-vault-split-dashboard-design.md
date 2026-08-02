# RumahBudget Vault Split Dashboard Design

## Outcome

Redesign the authenticated RumahBudget overview around the selected **Vault Split** visual target:

`C:\Users\Lenovo\.codex\generated_images\019fa1b2-29dd-7043-8cef-ae0790c58447\call_QKt2DI2QRu7FvL7DbQ8S95zU.png`

The result must feel structurally new, not like the old dashboard with a different skin. The first viewport becomes an asymmetric financial workspace:

- a compact vault spine for balance, status, runway, burn, account count, privacy, and the contextual transaction action;
- a dominant data-backed hero chart;
- a recent-transaction ledger attached directly below the split;
- advanced tools placed after the daily dashboard as a lower-priority analysis deck.

## Product Constraints

- Preserve all existing data, calculations, views, actions, onboarding targets, Command-K targets, sandbox behavior, and authentication behavior.
- Do not add financial categories, recommendations, ratios, buckets, historical periods, or calculations that are not already derived from RumahBudget data.
- Do not modify database schema, Supabase configuration, authentication flow, API contracts, or persistence.
- Keep the existing eight destinations: Ringkasan, Catat, Transaksi, Akun, Laporan, Alokasi, Simulasi, and Pengaturan.
- Keep `#dashboard-charts`, `#survival-matrix`, and `#system-diagnostics` mounted and reachable.
- Preserve due-commitment actions, privacy control, sandbox switch, onboarding, offline/sync statuses, and the global transaction CTA.
- Use no new dependency.
- Do not commit, push, deploy, or modify unrelated files.

## Information Architecture

### First viewport

1. Existing global shell:
   - desktop sidebar;
   - compact top bar;
   - privacy control;
   - Catat transaksi;
   - ledger/sandbox context.
2. Vault Split:
   - left spine: page title, total balance, monthly status, runway, average burn, active account count, contextual Catat transaksi;
   - right field: `DashboardCharts` redesigned as the dominant chart surface;
   - attached footer rail: income, expense, and monthly net values.
3. Recent transactions:
   - full-width table on desktop;
   - compact list on mobile;
   - visually attached to the Vault Split surface.

### Secondary dashboard

1. Conditional commitment strip.
2. Planning workbench and spending signal.
3. Survival Matrix.
4. System Diagnostics.
5. Sandbox entry.

These tools remain available but no longer compete with the hero dashboard for first-viewport attention.

## Hero Chart Contract

The hero chart uses only existing values:

- `totalIncome`;
- `totalExpense`;
- `remainingBalance`;
- existing account balances;
- existing expense-category aggregation.

It must not imply a six-month history. The chart is titled **Peta arus kas rumah tangga** and describes current-period/account/category composition.

Visual language:

- olive segmented columns for positive/income/account values;
- clay segmented columns for expense/negative values;
- bone baseline and direct labels;
- stepped, flat pixel geometry;
- no gradients, glow, glass, rounded pills, or nested cards.

Privacy behavior:

- values use the existing masked label;
- sensitive bar geometry switches to equal neutral widths/heights while privacy is active;
- life-energy derivatives remain hidden;
- category amounts and proportions are masked.

## Responsive Behavior

- `>= 1280px`: persistent sidebar; 30/70 Vault Split; chart and spine share one frame.
- `768–1279px`: vault spine becomes a horizontal summary rail; chart remains dominant below it; tablet navigation remains reachable.
- `< 768px`: one column; page title and contextual CTA first, summary definitions in two columns, horizontally compact chart, recent activity list, bottom navigation with More.
- No body-level horizontal overflow at 360px or 390px.
- Touch targets are at least 44px.
- DOM order matches visual and keyboard order; do not use CSS `order` to rearrange interactive controls.

## Accessibility

- Preserve semantic `h1`, section headings, table caption, table headers, status text, and control labels.
- Do not rely on color alone; each bar and state has text.
- Chart marks are keyboard-focusable only when they expose useful labels; otherwise the chart supplies an equivalent data list.
- Privacy, sandbox, More, onboarding, Command-K, and diagnostic controls keep accurate state attributes.
- Reduced-motion settings remove nonessential transitions.
- Focus outline uses the olive highlight token with at least 3:1 non-text contrast.

## Visual Tokens

- Background: `#0A0D0B`
- Sidebar: `#101512`
- Surface: `#151A17`
- Raised surface: `#1A201C`
- Plot: `#0F1311`
- Border: `#343C35`
- Bevel highlight: `#59604F`
- Primary text: `#F1EEE4`
- Muted text: `#A5AAA1`
- Olive: `#9EB83F`
- Olive highlight: `#C3D95E`
- Clay: `#F27726`
- Clay highlight: `#F6A15D`
- Bone: `#E4DCC8`

Pixelify Sans remains the display face. Existing body and numeric font fallbacks remain unchanged unless already configured by the current root layout.

## Verification

- Preservation script passes.
- ESLint passes.
- TypeScript `--noEmit` passes.
- Browser desktop and mobile checks confirm layout, privacy, navigation, transaction CTA, sandbox, onboarding chart target, and diagnostics target.
- Browser console has no application error.
- The implementation is compared with the selected visual in one combined visual input.
- `design-qa.md` ends with `final result: passed` before handoff.
