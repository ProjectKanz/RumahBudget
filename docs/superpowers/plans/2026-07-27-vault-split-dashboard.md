# Vault Split Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the authenticated RumahBudget overview around the selected Vault Split composition while preserving all current data, calculations, controls, routes, and advanced features.

**Architecture:** Keep `app/page.tsx` as the state/data owner. Move only presentation responsibilities: `OverviewDashboard` owns the asymmetric vault spine, recent ledger, and planning placement; `DashboardCharts` owns the truthful current-period/account/category chart. Existing advanced feature components remain mounted below the daily overview and keep their public props and target IDs.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4 Client Components, TypeScript, Tailwind CSS 4, project global CSS, Node preservation script.

## Global Constraints

- Selected visual truth: `C:\Users\Lenovo\.codex\generated_images\019fa1b2-29dd-7043-8cef-ae0790c58447\call_QKt2DI2QRu7FvL7DbQ8S95zU.png`.
- Preserve all existing data, calculations, actions, routes, onboarding targets, Command-K targets, authentication, sandbox, and offline/sync behavior.
- Do not add financial categories, recommendations, ratios, buckets, history, or calculations that are not derived from existing RumahBudget data.
- Do not change database schema, auth flow, API contracts, dependencies, or persistence.
- Keep `#dashboard-charts`, `#survival-matrix`, and `#system-diagnostics` mounted and reachable.
- Privacy hides both numeric text and sensitive chart geometry.
- Use Indonesian product copy in the redesigned overview.
- No new dependency, commit, push, deployment, or unrelated cleanup.
- Verify desktop 1440px/1280px, tablet 768px, and mobile 390px/360px.

---

### Task 1: Lock preservation and privacy contracts

**Files:**
- Modify: `scripts/check-ui-preservation.mjs`
- Test: `scripts/check-ui-preservation.mjs`

**Interfaces:**
- Consumes: existing source files and target IDs.
- Produces: a deterministic preservation gate for the Vault Split implementation.

- [ ] **Step 1: Add failing preservation assertions**

Add source checks for:

```js
const dashboardCharts = readFileSync(
  resolve(root, "src/components/dashboard-charts.tsx"),
  "utf8",
);

const requiredOverviewMarkers = [
  "rb-vault-split",
  "rb-vault-spine",
  "rb-vault-ledger",
  "<DashboardCharts",
];

const requiredChartMarkers = [
  'id="dashboard-charts"',
  "Peta arus kas rumah tangga",
  "isBalanceHidden",
];
```

The production break caught is removal of the selected layout contract, chart target, or privacy wiring while old features still compile.

- [ ] **Step 2: Run the gate and confirm RED**

Run:

```powershell
node scripts/check-ui-preservation.mjs
```

Expected: FAIL because the Vault Split markers do not exist yet.

- [ ] **Step 3: Keep legacy feature assertions**

Retain assertions for `DashboardCharts`, `SurvivalMatrix`, `SystemDiagnostics`, commitments, onboarding, and Command-K diagnostics. Do not weaken the forbidden experimental bucket checks.

- [ ] **Step 4: Re-run after production tasks**

Run:

```powershell
node scripts/check-ui-preservation.mjs
```

Expected after Tasks 2–3: PASS.

### Task 2: Build the truthful hero chart

**Files:**
- Modify: `src/components/dashboard-charts.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `accountBalances`, `expenses`, `isBalanceHidden`, `moneyAccounts`, plus new numeric props `totalIncome`, `totalExpense`, and `remainingBalance`.
- Produces: `DashboardCharts` rendered as the dominant Vault Split chart surface with `id="dashboard-charts"`.

- [ ] **Step 1: Confirm Task 1 remains RED**

Run:

```powershell
node scripts/check-ui-preservation.mjs
```

Expected: FAIL on missing Vault Split markers.

- [ ] **Step 2: Extend the chart props without new business logic**

Add:

```ts
type DashboardChartsProps = {
  accountBalances: Record<string, number>;
  expenses: Expense[];
  highlightClassName?: string;
  isBalanceHidden: boolean;
  moneyAccounts: MoneyAccount[];
  remainingBalance: number;
  totalExpense: number;
  totalIncome: number;
};
```

Reuse the existing account and expense-category aggregation.

- [ ] **Step 3: Replace the nested cockpit cards**

Render:

- title **Peta arus kas rumah tangga**;
- three current-period bars: Pemasukan, Pengeluaran, Selisih;
- a compact account-composition list;
- a compact expense-category list;
- empty states for no accounts or no expenses;
- a text equivalent for every visual mark.

When privacy is active, use the masked label and equalized bar geometry instead of ratios derived from private values.

- [ ] **Step 4: Add chart styling**

Add `.rb-vault-chart`, `.rb-cashflow-columns`, `.rb-cashflow-column`, `.rb-vault-composition`, and responsive rules using only flat colors, borders, stepped corners, and dividers.

- [ ] **Step 5: Run targeted checks**

Run:

```powershell
npx tsc --noEmit
npm run lint -- src/components/dashboard-charts.tsx
```

Expected: PASS.

### Task 3: Recompose the overview into Vault Split

**Files:**
- Modify: `src/components/overview-dashboard.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: all existing `OverviewDashboardProps`, existing active expenses from `app/page.tsx`, and the expanded `DashboardCharts` interface from Task 2.
- Produces: `rb-vault-split`, `rb-vault-spine`, `rb-vault-ledger`, and the secondary analysis placement.

- [ ] **Step 1: Keep the gate RED for the intended reason**

Run:

```powershell
node scripts/check-ui-preservation.mjs
```

Expected: FAIL only on the not-yet-created overview Vault Split markers.

- [ ] **Step 2: Add chart data to the overview boundary**

Add `expenses: Expense[]` to `OverviewDashboardProps`, import `Expense`, and pass `activeExpenses` from `app/page.tsx`.

- [ ] **Step 3: Build the Vault Split DOM order**

Use this order:

```text
section#overview
  div.rb-vault-split
    aside.rb-vault-spine
    DashboardCharts
    article.rb-vault-ledger
  section.rb-planning-workbench
```

The spine contains the `h1`, masked total balance, monthly status, runway, average burn, active account count, privacy state, ledger/sandbox state, and contextual transaction CTA.

- [ ] **Step 4: Attach recent transactions**

Reuse all existing recent activity data, desktop table semantics, mobile list, transfer labels, navigation button, and empty state. Keep derived life-energy text hidden when privacy is active.

- [ ] **Step 5: Reframe planning and signal**

Keep the existing planned amount input, presets, projections, decision checks, action protocol, and five navigation/actions. Present them as one connected workbench with an internal divider rather than two peer cards.

- [ ] **Step 6: Remove the standalone chart render**

Delete only the second `<DashboardCharts>` instance from the overview branch of `app/page.tsx`. Do not remove the import, target ID, onboarding target, Survival Matrix, System Diagnostics, commitments, or sandbox entry.

- [ ] **Step 7: Add responsive Vault Split CSS**

Implement:

- desktop `minmax(250px, 0.3fr) minmax(0, 0.7fr)`;
- tablet stacked summary rail plus chart;
- mobile single-column layout and compact chart;
- no CSS `order` for interactive elements;
- minimum 44px control targets;
- no body horizontal overflow.

- [ ] **Step 8: Run preservation, lint, and type checks**

Run:

```powershell
node scripts/check-ui-preservation.mjs
npm run lint
npx tsc --noEmit
```

Expected: PASS.

### Task 4: Browser QA and visual fidelity gate

**Files:**
- Modify: `design-qa.md`
- Create: `tmp/design-qa/vault-split-desktop.png`
- Create: `tmp/design-qa/vault-split-mobile.png`

**Interfaces:**
- Consumes: running app at `http://localhost:3001`, selected visual truth, authenticated user session.
- Produces: browser evidence and a blocking `design-qa.md` verdict.

- [ ] **Step 1: Reload the authenticated app**

Use the user browser. Keep privacy active before saving screenshots.

- [ ] **Step 2: Test core interactions**

Verify:

- all eight destinations;
- privacy toggle;
- Catat transaksi;
- ledger/sandbox switch;
- recent activity link;
- planned-spend input and presets;
- mobile More sheet;
- onboarding chart target;
- Command-K diagnostics target;
- no application console error.

- [ ] **Step 3: Capture desktop and mobile**

Capture the implementation at the selected desktop state and at 390px. Do not expose unmasked financial data.

- [ ] **Step 4: Compare source and implementation together**

Put the selected visual and desktop implementation screenshot into one comparison input. Review composition, typography, spacing, colors, image quality, copy, responsive behavior, and accessibility.

- [ ] **Step 5: Fix P0/P1/P2 findings**

Apply scoped fixes, recapture, and compare again. Do not loop on P3 polish.

- [ ] **Step 6: Save the QA report**

`design-qa.md` must record paths, viewport, state, interaction checks, console check, comparison history, findings, and end exactly with:

```text
final result: passed
```

- [ ] **Step 7: Run final verification**

Run:

```powershell
node scripts/check-ui-preservation.mjs
npm run lint
npx tsc --noEmit
git diff --check
```

Expected: preservation/lint/type-check pass; `git diff --check` has no whitespace errors.
