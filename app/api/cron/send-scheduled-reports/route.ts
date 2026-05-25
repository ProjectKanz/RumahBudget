import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type EmailReportStatus = "success" | "failed";

type EmailReportInsert = {
  user_id: string;
  recipient_email: string;
  report_type: string;
  period_label: string;
  status: EmailReportStatus;
  error_message: string;
  sent_at: string;
};

type EmailReportLogger = {
  from: (table: "email_reports") => {
    insert: (values: EmailReportInsert) => PromiseLike<{
      error?: { message: string } | null;
    }>;
  };
};

type ReportPreferenceRow = {
  id?: string | number;
  user_id?: string | null;
  weekly_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  recipient_email?: string | null;
};

type IncomeRow = {
  amount?: number | string | null;
  source?: string | null;
  created_at?: string | null;
};

type ExpenseRow = {
  amount?: number | string | null;
  category?: string | null;
  created_at?: string | null;
};

type WeeklyReportSummary = {
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  remainingBalance: number;
  transactionCount: number;
  topExpenseCategory: string;
};

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;

  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

function getWeekEnd(weekStart: Date) {
  const weekEnd = new Date(weekStart);

  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return weekEnd;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Gagal menjalankan dry-run laporan terjadwal.";
}

function createWeeklyReportSummary({
  expenses,
  incomes,
  weekEnd,
  weekStart,
}: {
  expenses: ExpenseRow[];
  incomes: IncomeRow[];
  weekEnd: Date;
  weekStart: Date;
}): WeeklyReportSummary {
  const totalIncome = incomes.reduce(
    (total, income) => total + Number(income.amount ?? 0),
    0,
  );
  const totalExpense = expenses.reduce(
    (total, expense) => total + Number(expense.amount ?? 0),
    0,
  );
  const categoryTotals = expenses.reduce<Record<string, number>>(
    (totals, expense) => {
      const category = expense.category ?? "Lainnya";

      return {
        ...totals,
        [category]: (totals[category] ?? 0) + Number(expense.amount ?? 0),
      };
    },
    {},
  );
  const topCategory = Object.entries(categoryTotals).sort(
    ([, firstAmount], [, secondAmount]) => secondAmount - firstAmount,
  )[0]?.[0];

  return {
    periodLabel: `${dateFormatter.format(weekStart)} - ${dateFormatter.format(
      weekEnd,
    )}`,
    totalIncome,
    totalExpense,
    remainingBalance: totalIncome - totalExpense,
    transactionCount: incomes.length + expenses.length,
    topExpenseCategory: topCategory ?? "Belum ada",
  };
}

function buildDryRunEmail({
  preference,
  report,
  recipientEmail,
}: {
  preference: ReportPreferenceRow;
  report: WeeklyReportSummary;
  recipientEmail: string;
}) {
  const rows = [
    ["Report type", "weekly"],
    ["Periode", report.periodLabel],
    ["Total pemasukan", rupiahFormatter.format(report.totalIncome)],
    ["Total pengeluaran", rupiahFormatter.format(report.totalExpense)],
    ["Sisa saldo", rupiahFormatter.format(report.remainingBalance)],
    ["Jumlah transaksi", String(report.transactionCount)],
    ["Kategori pengeluaran terbesar", report.topExpenseCategory],
  ];
  const preferredRecipient = preference.recipient_email ?? "Belum diatur";
  const text = [
    "RumahBudget Scheduled Email Dry Run",
    `User ID: ${preference.user_id ?? "unknown"}`,
    `Testing recipient: ${recipientEmail}`,
    `Saved recipient preference: ${preferredRecipient}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Mode testing: email terjadwal hanya dikirim ke email Resend yang terverifikasi. Pengiriman ke email preferensi membutuhkan domain terverifikasi.",
  ].join("\n");
  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 10px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(label)}</td>
          <td style="padding: 10px 12px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
        <h1 style="margin-bottom: 8px;">RumahBudget Scheduled Email Dry Run</h1>
        <p style="margin-top: 0; color: #64748b;">User ID: ${escapeHtml(preference.user_id ?? "unknown")}</p>
        <p style="margin-top: 0; color: #64748b;">Mode testing Resend: email dikirim ke ${escapeHtml(recipientEmail)}</p>
        <p style="margin-top: 0; color: #64748b;">Preferensi penerima tersimpan: ${escapeHtml(preferredRecipient)}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 24px; border: 1px solid #e2e8f0;">
          <tbody>${htmlRows}</tbody>
        </table>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
          Ini dry-run testing mode. Pengiriman ke email preferensi pengguna membutuhkan domain Resend yang terverifikasi.
        </p>
      </div>
    `,
    text,
  };
}

async function saveEmailReportLog({
  errorMessage,
  periodLabel,
  recipientEmail,
  status,
  supabase,
  userId,
}: {
  errorMessage: string;
  periodLabel: string;
  recipientEmail: string;
  status: EmailReportStatus;
  supabase: EmailReportLogger;
  userId: string;
}) {
  const { error } = await supabase.from("email_reports").insert({
    user_id: userId,
    recipient_email: recipientEmail,
    report_type: "weekly",
    period_label: periodLabel,
    status,
    error_message: errorMessage,
    sent_at: new Date().toISOString(),
  });

  return error?.message ?? "";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const token = getBearerToken(request);

  if (!cronSecret || token !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const reportTestRecipientEmail = process.env.REPORT_TEST_RECIPIENT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return Response.json(
      {
        error:
          "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before enabling scheduled report preference reads.",
      },
      { status: 500 },
    );
  }

  if (!reportTestRecipientEmail) {
    return Response.json(
      {
        error:
          "Missing REPORT_TEST_RECIPIENT_EMAIL. Add the verified Resend testing recipient before running scheduled email dry runs.",
      },
      { status: 500 },
    );
  }

  if (!resendApiKey) {
    return Response.json(
      {
        error:
          "Missing RESEND_API_KEY. Add it before running scheduled email dry runs.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const resend = new Resend(resendApiKey);
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "RumahBudget <onboarding@resend.dev>";

  // Scheduled email dry-run testing mode:
  // - Vercel Cron can call this protected endpoint.
  // - Preferences are read with a server-only service role because user RLS
  //   correctly prevents anonymous aggregate reads.
  // - Email is sent only to REPORT_TEST_RECIPIENT_EMAIL, never to
  //   report_preferences.recipient_email.
  // - Real recipient sending requires a verified Resend domain.
  const { data: preferencesData, error: preferencesError } = await supabase
    .from("report_preferences")
    .select("id, user_id, weekly_enabled, monthly_enabled, recipient_email")
    .or("weekly_enabled.eq.true,monthly_enabled.eq.true");

  if (preferencesError) {
    return Response.json({ error: preferencesError.message }, { status: 500 });
  }

  const preferences = (preferencesData ?? []) as ReportPreferenceRow[];
  const weeklyPreferences = preferences.filter(
    (preference) => preference.weekly_enabled && preference.user_id,
  );
  const weekStart = getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);
  const results = [];

  for (const preference of weeklyPreferences) {
    const userId = preference.user_id as string;
    let periodLabel = `${dateFormatter.format(weekStart)} - ${dateFormatter.format(
      weekEnd,
    )}`;

    try {
      const [incomesResult, expensesResult] = await Promise.all([
        supabase
          .from("incomes")
          .select("amount, source, created_at")
          .eq("user_id", userId)
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString()),
        supabase
          .from("expenses")
          .select("amount, category, created_at")
          .eq("user_id", userId)
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString()),
      ]);

      if (incomesResult.error) {
        throw new Error(incomesResult.error.message);
      }

      if (expensesResult.error) {
        throw new Error(expensesResult.error.message);
      }

      const report = createWeeklyReportSummary({
        expenses: (expensesResult.data ?? []) as ExpenseRow[],
        incomes: (incomesResult.data ?? []) as IncomeRow[],
        weekEnd,
        weekStart,
      });
      periodLabel = report.periodLabel;
      const email = buildDryRunEmail({
        preference,
        report,
        recipientEmail: reportTestRecipientEmail,
      });
      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: reportTestRecipientEmail,
        subject: `RumahBudget weekly dry run: ${report.periodLabel}`,
        html: email.html,
        text: email.text,
      });

      if (sendError) {
        throw new Error(getErrorMessage(sendError));
      }

      const logError = await saveEmailReportLog({
        errorMessage: "",
        periodLabel,
        recipientEmail: reportTestRecipientEmail,
        status: "success",
        supabase,
        userId,
      });

      results.push({
        userId,
        reportType: "weekly",
        periodLabel,
        recipientEmail: reportTestRecipientEmail,
        status: "success",
        logError: logError || null,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const logError = await saveEmailReportLog({
        errorMessage,
        periodLabel,
        recipientEmail: reportTestRecipientEmail,
        status: "failed",
        supabase,
        userId,
      });

      results.push({
        userId,
        reportType: "weekly",
        periodLabel,
        recipientEmail: reportTestRecipientEmail,
        status: "failed",
        errorMessage,
        logError: logError || null,
      });
    }
  }

  const successCount = results.filter((result) => result.status === "success")
    .length;
  const failedCount = results.filter((result) => result.status === "failed")
    .length;

  return Response.json({
    ok: failedCount === 0,
    mode: "testing",
    processedCount: results.length,
    successCount,
    failedCount,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
