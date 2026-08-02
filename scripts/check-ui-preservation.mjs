import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const page = readFileSync(resolve(root, "app/page.tsx"), "utf8");
const overview = readFileSync(
  resolve(root, "src/components/overview-dashboard.tsx"),
  "utf8",
);
const dashboardCharts = readFileSync(
  resolve(root, "src/components/dashboard-charts.tsx"),
  "utf8",
);

const requiredPageMarkers = [
  'import SurvivalMatrix from "@/src/components/survival-matrix";',
  'import SystemDiagnostics from "@/src/components/system-diagnostics";',
  "<SurvivalMatrix",
  "<SystemDiagnostics",
  'sectionId: "dashboard-charts"',
  'getElementById("system-diagnostics")',
  "recordCommitmentPayment",
  "muteCommitmentReminders",
  "approachingCommitments",
  "<OnboardingTutorial",
  "<CommandK",
];

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

const forbiddenOverviewMarkers = [
  "bucketDefinitions",
  "ratio: 0.55",
  "ratio: 0.15",
  "ratio: 0.1",
  "ratio: 0.05",
  "getExpenseForBucket",
  "Check budget leaks",
];

const failures = [];

for (const marker of requiredPageMarkers) {
  if (!page.includes(marker)) {
    failures.push(`Missing legacy feature marker in app/page.tsx: ${marker}`);
  }
}

for (const marker of requiredOverviewMarkers) {
  if (!overview.includes(marker)) {
    failures.push(
      `Missing Vault Split layout marker in src/components/overview-dashboard.tsx: ${marker}`,
    );
  }
}

for (const marker of requiredChartMarkers) {
  if (!dashboardCharts.includes(marker)) {
    failures.push(
      `Missing chart or privacy marker in src/components/dashboard-charts.tsx: ${marker}`,
    );
  }
}

for (const marker of forbiddenOverviewMarkers) {
  if (overview.includes(marker)) {
    failures.push(
      `Experimental product logic must not remain in overview-dashboard.tsx: ${marker}`,
    );
  }
}

if (failures.length > 0) {
  console.error("UI preservation check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "UI preservation check passed: legacy overview features are wired and experimental bucket logic is absent.",
);
