# 3D Pixel Ledger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use sub-agent review for each independently reviewable slice. Repository instructions prohibit commits unless the user explicitly requests one, so this plan keeps all changes uncommitted.

**Goal:** Recreate the selected 3D Pixel Ledger visual direction across RumahBudget without removing or changing existing financial data, calculations, routes, actions, states, onboarding targets, or Command-K behavior.

**Architecture:** Keep `app/page.tsx` as the behavior and data-flow owner. Rebuild the overview as a presentation-only component that consumes existing calculated props, then apply a shared graphite/olive/clay pixel-ledger design system through global tokens and existing primitives. Restore the legacy overview modules and commitment actions that the previous dirty redesign removed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, existing Supabase integration.

## Global Constraints

- Use the selected source visual at `C:\Users\Lenovo\.codex\generated_images\019fa1b2-29dd-7043-8cef-ae0790c58447\call_b4dvLQxwvr8jOAX5g47MVtKW.png`.
- Preserve existing persisted data, Supabase behavior, local fallback behavior, financial calculations, and schemas.
- Do not add dependencies, change database/auth/deployment configuration, or read sensitive environment values.
- Remove the experimental 55/15/15/10/5 buckets and any category inference introduced only by the dirty redesign.
- Restore `DashboardCharts`, `SurvivalMatrix`, `SystemDiagnostics`, commitment radar actions, the `dashboard-charts` onboarding target, and the `system-diagnostics` Command-K target.
- Keep all eight destinations reachable on desktop and mobile.
- Use Indonesian-first product copy for the redesigned shell and overview while retaining unchanged feature behavior.
- Use dummy data only in screenshots and visual QA.
- Do not commit, push, deploy, or install packages.

---

### Task 1: Add preservation gate and restore removed feature wiring

**Files:**
- Create: `scripts/check-ui-preservation.mjs`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: existing `moneyAccounts`, `moneyAccountBalances`, `activeExpenses`, `averageMonthlyBurn`, `totalIncome`, `isBalanceHidden`, `autoStartScanTrigger`, commitments state, and existing callbacks.
- Produces: render targets `dashboard-charts` and `system-diagnostics`, restored commitment actions, and all legacy overview modules in the current overview route.

- [ ] Write a source-level preservation script that requires legacy overview imports/rendering and rejects experimental bucket logic.
- [ ] Run `node scripts/check-ui-preservation.mjs` and confirm it fails on the current dirty redesign.
- [ ] Restore the removed imports, callbacks, commitment radar, simulation entry, survival matrix, diagnostics, and dashboard charts.
- [ ] Run the preservation script and confirm it passes.

### Task 2: Rebuild the overview from existing data only

**Files:**
- Modify: `src/components/overview-dashboard.tsx`

**Interfaces:**
- Consumes: the existing `OverviewDashboardProps` values calculated by `app/page.tsx`.
- Produces: summary strip, monthly cashflow visualization, recent transaction ledger, privacy action, quick transaction action, and compact advanced-insight entry points.

- [ ] Remove bucket definitions, word matching, invented allocation targets, and ungrounded recommendations.
- [ ] Build the selected 3D Pixel Ledger hierarchy using only existing totals, monthly status, runway, decision checks, planned-spend calculations, and recent activity.
- [ ] Keep privacy formatting on every exposed overview amount.
- [ ] Keep expense, income, transfer, transaction, allocation, reports, and advanced overview actions reachable.
- [ ] Verify empty recent-activity rendering and narrow-screen overflow behavior.

### Task 3: Apply the selected design system across the existing app shell

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/cockpit-ui.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: existing Tailwind classes and component primitives.
- Produces: graphite surfaces, olive positive/brand accents, clay outflow states, stepped pixel borders, restrained block depth, readable numeric typography, desktop rail, and compact mobile navigation.

- [ ] Define semantic colors and shared surface/control classes.
- [ ] Remove ambient neon/glass/cyberpunk effects from the authenticated shell.
- [ ] Restyle existing primitives without changing their props or behavior.
- [ ] Group desktop navigation while keeping every destination.
- [ ] Replace the eight-cell mobile grid with a smaller primary bar plus a reachable overflow/menu path.
- [ ] Preserve sandbox/offline/sync state labels with text, not color alone.
- [ ] Update document language and metadata.

### Task 4: Verify behavior and visual fidelity

**Files:**
- Create: `design-qa.md`

**Interfaces:**
- Consumes: selected visual reference and rendered local app.
- Produces: preservation output, lint output, browser evidence, responsive screenshots, interaction evidence, and a blocking QA result.

- [ ] Run `node scripts/check-ui-preservation.mjs`.
- [ ] Run `npm run lint`.
- [ ] Start the existing dev server without installing packages.
- [ ] Verify overview navigation, privacy toggle, transaction CTA, mobile navigation, onboarding target, Command-K scan target, and console errors using dummy/local state only.
- [ ] Capture desktop and mobile screenshots.
- [ ] Compare the desktop screenshot with the selected visual at matching dimensions.
- [ ] Fix all actionable P0/P1/P2 findings and record the comparison history.
- [ ] Write `design-qa.md` with `final result: passed` only when browser evidence supports it; otherwise mark it `blocked`.
