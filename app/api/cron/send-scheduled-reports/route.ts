import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  buildDetailedHtmlReport,
  getWeekStart,
  getWeekEnd,
  getCategoryLabel,
} from "@/src/lib/email-templates";
import {
  isAuthorizedCronRequest,
  prepareCronResultsForResponse,
} from "@/src/lib/cron-security";

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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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

  return "Failed to run scheduled report dry run.";
}

function getFinancialStatus(totalIncome: number, totalExpense: number) {
  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;

  if (totalExpense > totalIncome) {
    return {
      label: "Critical" as const,
      explanation: "Expenses are higher than income for this period.",
    };
  }

  if (expenseRatio >= 0.7) {
    return {
      label: "Warning" as const,
      explanation: "Expenses are getting close to income for this period.",
    };
  }

  return {
    label: "Safe" as const,
    explanation: "Expenses are still under control for this period.",
  };
}

function getRecommendation(
  status: "Safe" | "Warning" | "Critical",
  topCategory: string,
  totalIncome: number,
) {
  if (totalIncome <= 0) {
    return "Start by adding income so net cashflow is clearer.";
  }

  if (status === "Critical") {
    return topCategory === "None yet"
      ? "Review expenses and postpone non-urgent purchases."
      : `Reduce spending in ${topCategory} and prioritize essentials.`;
  }

  if (status === "Warning") {
    return topCategory === "None yet"
      ? "Keep monitoring expenses before adding new transactions."
      : `Watch ${topCategory} so expenses do not exceed income.`;
  }

  return "Keep tracking consistently and set aside part of your income when possible.";
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
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
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

  // Fetch users with weekly or monthly reports enabled
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
    const periodLabel = `${dateFormatter.format(weekStart)} - ${dateFormatter.format(
      weekEnd,
    )}`;

    try {
      // Get user email
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const accountEmail = authUser?.user?.email || preference.recipient_email || "user@email.com";

      // Fetch all accounts, incomes, expenses, and transfers for the user
      const [accountsRes, incomesRes, expensesRes, transfersRes] = await Promise.all([
        supabase.from("money_accounts").select("*").eq("user_id", userId).eq("is_archived", false),
        supabase.from("incomes").select("*").eq("user_id", userId),
        supabase.from("expenses").select("*").eq("user_id", userId),
        supabase.from("transfers").select("*").eq("user_id", userId),
      ]);

      if (accountsRes.error) throw new Error(accountsRes.error.message);
      if (incomesRes.error) throw new Error(incomesRes.error.message);
      if (expensesRes.error) throw new Error(expensesRes.error.message);
      if (transfersRes.error) throw new Error(transfersRes.error.message);

      const accounts = accountsRes.data || [];
      const balances: Record<string, number> = {};

      // Compute current balances
      accounts.forEach((acc) => {
        balances[acc.id] = Number(acc.initial_balance || 0);
      });
      (incomesRes.data || []).forEach((inc) => {
        if (inc.account_id && inc.account_id in balances) {
          balances[inc.account_id] += Number(inc.amount || 0);
        }
      });
      (expensesRes.data || []).forEach((exp) => {
        if (exp.account_id && exp.account_id in balances) {
          balances[exp.account_id] -= Number(exp.amount || 0);
        }
      });
      (transfersRes.data || []).forEach((tf) => {
        if (tf.to_account_id && tf.to_account_id in balances) {
          balances[tf.to_account_id] += Number(tf.amount || 0);
        }
        if (tf.from_account_id && tf.from_account_id in balances) {
          balances[tf.from_account_id] -= Number(tf.amount || 0);
        }
      });

      // Filter period incomes & expenses
      const periodIncomes = (incomesRes.data || []).filter((inc) => {
        const d = inc.created_at ? new Date(inc.created_at).getTime() : 0;
        return d >= weekStart.getTime() && d <= weekEnd.getTime();
      });

      const periodExpenses = (expensesRes.data || []).filter((exp) => {
        const d = exp.created_at ? new Date(exp.created_at).getTime() : 0;
        return d >= weekStart.getTime() && d <= weekEnd.getTime();
      });

      const totalIncome = periodIncomes.reduce((sum, inc) => sum + Number(inc.amount || 0), 0);
      const totalExpense = periodExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
      const netCashflow = totalIncome - totalExpense;

      // Category breakdown
      const categoryTotals: Record<string, number> = {};
      periodExpenses.forEach((exp) => {
        const cat = exp.category || "Other";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
      });
      const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
      const topCategoryEntry = sortedCategories[0];
      const topCategory = topCategoryEntry
        ? getCategoryLabel(topCategoryEntry[0])
        : "None yet";

      // Source breakdown
      const sourceTotals: Record<string, number> = {};
      periodIncomes.forEach((inc) => {
        const src = inc.source || "Other Inflow";
        sourceTotals[src] = (sourceTotals[src] || 0) + Number(inc.amount || 0);
      });
      const sortedSources = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]);

      const statusObj = getFinancialStatus(totalIncome, totalExpense);
      const recommendation = getRecommendation(statusObj.label, topCategory, totalIncome);

      // Build structured HTML report
      const emailContent = buildDetailedHtmlReport({
        accountEmail,
        reportType: "Weekly Report",
        periodLabel,
        totalIncome,
        totalExpense,
        netCashflow,
        financialStatus: statusObj.label,
        topExpenseCategory: topCategory,
        explanation: statusObj.explanation,
        recommendation,
        accounts,
        balances,
        sortedCategories,
        sortedSources,
        isDryRun: true,
        preferredRecipient: preference.recipient_email || "Not set",
      });

      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: reportTestRecipientEmail,
        subject: `RumahBudget weekly dry run: ${periodLabel}`,
        html: emailContent.html,
        text: emailContent.text,
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

  const responseResults = prepareCronResultsForResponse(
    results,
    process.env.NODE_ENV === "production",
  );

  return Response.json({
    ok: failedCount === 0,
    mode: "testing",
    processedCount: results.length,
    successCount,
    failedCount,
    results: responseResults,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
