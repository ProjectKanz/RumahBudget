export function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;

  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

export function getWeekEnd(weekStart: Date) {
  const weekEnd = new Date(weekStart);

  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return weekEnd;
}

export function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);

export function getCategoryLabel(cat: string) {
  return categoryLabels.get(cat) || cat;
}

export type AccountRow = {
  id: string;
  name: string;
  initial_balance?: number;
};

export function buildDetailedHtmlReport({
  accountEmail,
  reportType,
  periodLabel,
  totalIncome,
  totalExpense,
  netCashflow,
  financialStatus,
  topExpenseCategory,
  explanation,
  recommendation,
  accounts,
  balances,
  sortedCategories,
  sortedSources,
  isDryRun = false,
  preferredRecipient = "",
}: {
  accountEmail: string;
  reportType: string;
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  financialStatus: string;
  topExpenseCategory: string;
  explanation: string;
  recommendation: string;
  accounts: AccountRow[];
  balances: Record<string, number>;
  sortedCategories: [string, number][];
  sortedSources: [string, number][];
  isDryRun?: boolean;
  preferredRecipient?: string;
}) {
  const formatIdr = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Status-specific colors
  let statusColor = "#22c55e"; // safe - green
  let statusBg = "#f0fdf4";
  if (financialStatus === "Warning") {
    statusColor = "#d97706"; // warning - amber
    statusBg = "#fffbeb";
  } else if (financialStatus === "Critical") {
    statusColor = "#e11d48"; // critical - red
    statusBg = "#fff1f2";
  }

  // Account Balances Rows
  const accountRows = accounts.map((acc) => {
    const bal = balances[acc.id] || 0;
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${escapeHtml(acc.name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${formatIdr(bal)}</td>
      </tr>
    `;
  }).join("");

  // Category Spending Rows
  const categoryRows = sortedCategories.length > 0
    ? sortedCategories
        .map(
          ([cat, amount]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${escapeHtml(getCategoryLabel(cat))}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${formatIdr(amount)}</td>
        </tr>
      `,
        )
        .join("")
    : `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 14px;">No expenses recorded in this period.</td></tr>`;

  // Income Sources Rows
  const sourceRows = sortedSources.length > 0
    ? sortedSources
        .map(
          ([src, amount]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${escapeHtml(src)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${formatIdr(amount)}</td>
        </tr>
      `,
        )
        .join("")
    : `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 14px;">No income recorded in this period.</td></tr>`;

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (balances[acc.id] || 0),
    0,
  );

  const text = [
    `RumahBudget ${reportType}`,
    `Account owner: ${accountEmail}`,
    `Period: ${periodLabel}`,
    `Total Income: ${formatIdr(totalIncome)}`,
    `Total Expenses: ${formatIdr(totalExpense)}`,
    `Net Cashflow: ${formatIdr(netCashflow)}`,
    `Status: ${financialStatus} - ${explanation}`,
    `Recommendation: ${recommendation}`,
    `Top Expense Category: ${topExpenseCategory}`,
    "",
    "Account Balances:",
    ...accounts.map((acc) => `- ${acc.name}: ${formatIdr(balances[acc.id] || 0)}`),
    `Total Net Worth: ${formatIdr(totalBalance)}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${
        isDryRun
          ? `
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #b45309;">
          <strong>DRY RUN MODE:</strong> This report is a test dry-run. 
          It would normally be sent to <strong>${escapeHtml(preferredRecipient)}</strong>.
        </div>
      `
          : ""
      }
      <!-- Header -->
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #1e3a8a;">RumahBudget</h1>
        <p style="font-size: 14px; color: #64748b; margin: 4px 0 0 0;">${escapeHtml(reportType)} &bull; ${escapeHtml(periodLabel)}</p>
      </div>

      <!-- Account Info -->
      <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0;">
        Personal financial summary for <strong>${escapeHtml(accountEmail)}</strong>
      </p>

      <!-- Cashflow Summary Cards -->
      <div style="background-color: #f8fafc; border-radius: 6px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
        <h2 style="font-size: 16px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Cashflow Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #475569; font-size: 14px;">Total Income</td>
            <td style="padding: 6px 0; text-align: right; color: #16a34a; font-weight: 700; font-size: 15px;">${formatIdr(totalIncome)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569; font-size: 14px;">Total Expenses</td>
            <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: 700; font-size: 15px;">${formatIdr(totalExpense)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 8px 0 0 0; color: #0f172a; font-weight: bold; font-size: 14px;">Net Cashflow</td>
            <td style="padding: 8px 0 0 0; text-align: right; color: ${netCashflow >= 0 ? "#16a34a" : "#dc2626"}; font-weight: 800; font-size: 16px;">${formatIdr(netCashflow)}</td>
          </tr>
        </table>
      </div>

      <!-- Status & Recommendations -->
      <div style="background-color: ${statusBg}; border: 1px solid ${statusColor}40; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.05em;">Status: ${escapeHtml(financialStatus)}</h2>
        <p style="font-size: 14px; font-weight: bold; margin: 0 0 8px 0; color: #0f172a;">${escapeHtml(explanation)}</p>
        <p style="font-size: 14px; margin: 0; color: #334155;"><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</p>
        ${
          topExpenseCategory && topExpenseCategory !== "None yet"
            ? `<p style="font-size: 13px; margin: 6px 0 0 0; color: #64748b;">Top Spending: <strong>${escapeHtml(topExpenseCategory)}</strong></p>`
            : ""
        }
      </div>

      <!-- Current Account Balances -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 15px; font-weight: 700; margin: 0 0 8px 0; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Current Account Balances</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0;">Account</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows}
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td style="padding: 10px 12px; color: #0f172a; font-size: 14px; border-top: 1px solid #cbd5e1;">Total Net Worth</td>
              <td style="padding: 10px 12px; color: #0f172a; font-size: 14px; text-align: right; border-top: 1px solid #cbd5e1;">${formatIdr(totalBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <!-- Income Breakdown -->
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 14px; font-weight: 700; margin: 0 0 8px 0; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Income Sources</h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #f1f5f9;">
            <tbody>
              ${sourceRows}
            </tbody>
          </table>
        </div>

        <!-- Expense Breakdown -->
        <div>
          <h2 style="font-size: 14px; font-weight: 700; margin: 0 0 8px 0; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Category Spending</h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #f1f5f9;">
            <tbody>
              ${categoryRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer Info -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          This report was generated and sent automatically via RumahBudget.
        </p>
      </div>
    </div>
  `;

  return { html, text };
}
