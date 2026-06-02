import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  buildDetailedHtmlReport,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  AccountRow,
} from "@/src/lib/email-templates";

export const runtime = "nodejs";

type ReportPayload = {
  reportType: "Weekly Report" | "Monthly Report";
  periodLabel: string;
  totalIncome: string;
  totalExpense: string;
  remainingBalance: string;
  financialStatus: "Safe" | "Warning" | "Critical";
  topExpenseCategory: string;
  explanation: string;
  recommendation: string;
};

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
    insert: (values: EmailReportInsert) => PromiseLike<unknown>;
  };
};

const requiredFields: (keyof ReportPayload)[] = [
  "reportType",
  "periodLabel",
  "totalIncome",
  "totalExpense",
  "remainingBalance",
  "financialStatus",
  "topExpenseCategory",
  "explanation",
  "recommendation",
];

function isReportPayload(value: unknown): value is ReportPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return requiredFields.every((field) => typeof payload[field] === "string");
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

  return "Failed to send email report.";
}

async function saveEmailReportLog({
  errorMessage,
  periodLabel,
  recipientEmail,
  reportType,
  status,
  supabase,
  userId,
}: {
  errorMessage: string;
  periodLabel: string;
  recipientEmail: string;
  reportType: string;
  status: EmailReportStatus;
  supabase: EmailReportLogger;
  userId: string;
}) {
  try {
    await supabase.from("email_reports").insert({
      user_id: userId,
      recipient_email: recipientEmail,
      report_type: reportType,
      period_label: periodLabel,
      status,
      error_message: errorMessage,
      sent_at: new Date().toISOString(),
    });
  } catch {
    // The email send result should still be returned even if history logging fails.
  }
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const reportTestRecipientEmail = process.env.REPORT_TEST_RECIPIENT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      {
        error:
          "Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are available, then restart npm run dev.",
      },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return Response.json(
      { error: "Please log in before sending an email report." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as unknown;

  if (!isReportPayload(body)) {
    return Response.json(
      { error: "Invalid report format." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user?.email) {
    return Response.json(
      { error: authError?.message ?? "Sesi login tidak valid." },
      { status: 401 },
    );
  }

  if (!reportTestRecipientEmail) {
    const message =
      "Missing REPORT_TEST_RECIPIENT_EMAIL. Add the verified Resend email to .env.local, then restart npm run dev.";

    await saveEmailReportLog({
      errorMessage: message,
      periodLabel: body.periodLabel,
      recipientEmail: "",
      reportType: body.reportType,
      status: "failed",
      supabase,
      userId: user.id,
    });

    return Response.json({ error: message }, { status: 500 });
  }

  if (!resendApiKey) {
    const message =
      "Missing RESEND_API_KEY. Add it to .env.local, then restart npm run dev.";

    await saveEmailReportLog({
      errorMessage: message,
      periodLabel: body.periodLabel,
      recipientEmail: reportTestRecipientEmail,
      reportType: body.reportType,
      status: "failed",
      supabase,
      userId: user.id,
    });

    return Response.json({ error: message }, { status: 500 });
  }

  // --- Compile data for the structured HTML report ---
  let accounts: AccountRow[] = [];
  const balances: Record<string, number> = {};
  let sortedCategories: [string, number][] = [];
  let sortedSources: [string, number][] = [];
  let numIncome = parseFloat(body.totalIncome.replace(/[^0-9.-]/g, "")) || 0;
  let numExpense = parseFloat(body.totalExpense.replace(/[^0-9.-]/g, "")) || 0;
  let numNet = parseFloat(body.remainingBalance.replace(/[^0-9.-]/g, "")) || 0;

  try {
    const isWeekly = body.reportType === "Weekly Report";
    const today = new Date();
    const startDate = isWeekly ? getWeekStart(today) : getMonthStart(today);
    const endDate = isWeekly ? getWeekEnd(startDate) : getMonthEnd(today);

    // Fetch accounts
    const { data: accountsData } = await supabase
      .from("money_accounts")
      .select("*")
      .eq("is_archived", false);

    if (accountsData) {
      accounts = accountsData;
    }

    // Fetch all incomes, expenses, and transfers to compute correct balances
    const [allIncomesRes, allExpensesRes, allTransfersRes] = await Promise.all([
      supabase.from("incomes").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("transfers").select("*"),
    ]);

    const allIncomes = allIncomesRes.data || [];
    const allExpenses = allExpensesRes.data || [];
    const allTransfers = allTransfersRes.data || [];

    // Calculate balances
    accounts.forEach((acc) => {
      balances[acc.id] = Number(acc.initial_balance || 0);
    });
    allIncomes.forEach((inc) => {
      if (inc.account_id && inc.account_id in balances) {
        balances[inc.account_id] += Number(inc.amount || 0);
      }
    });
    allExpenses.forEach((exp) => {
      if (exp.account_id && exp.account_id in balances) {
        balances[exp.account_id] -= Number(exp.amount || 0);
      }
    });
    allTransfers.forEach((tf) => {
      if (tf.to_account_id && tf.to_account_id in balances) {
        balances[tf.to_account_id] += Number(tf.amount || 0);
      }
      if (tf.from_account_id && tf.from_account_id in balances) {
        balances[tf.from_account_id] -= Number(tf.amount || 0);
      }
    });

    // Filter for current period
    const periodIncomes = allIncomes.filter((inc) => {
      const d = inc.created_at ? new Date(inc.created_at).getTime() : 0;
      return d >= startDate.getTime() && d <= endDate.getTime();
    });

    const periodExpenses = allExpenses.filter((exp) => {
      const d = exp.created_at ? new Date(exp.created_at).getTime() : 0;
      return d >= startDate.getTime() && d <= endDate.getTime();
    });

    // Recalculate totals for accuracy
    numIncome = periodIncomes.reduce((sum, inc) => sum + Number(inc.amount || 0), 0);
    numExpense = periodExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    numNet = numIncome - numExpense;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    periodExpenses.forEach((exp) => {
      const cat = exp.category || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount || 0);
    });
    sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    // Source breakdown
    const sourceTotals: Record<string, number> = {};
    periodIncomes.forEach((inc) => {
      const src = inc.source || "Other Inflow";
      sourceTotals[src] = (sourceTotals[src] || 0) + Number(inc.amount || 0);
    });
    sortedSources = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]);
  } catch (err) {
    console.error("Graceful database query error in send-report route:", err);
    // If it fails, fall back using the body values
    if (accounts.length === 0) {
      accounts = [{ id: "fallback", name: "Default Account" }];
      balances["fallback"] = numNet;
    }
  }

  const resend = new Resend(resendApiKey);
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "RumahBudget <onboarding@resend.dev>";

  const emailContent = buildDetailedHtmlReport({
    accountEmail: user.email,
    reportType: body.reportType,
    periodLabel: body.periodLabel,
    totalIncome: numIncome,
    totalExpense: numExpense,
    netCashflow: numNet,
    financialStatus: body.financialStatus,
    topExpenseCategory: body.topExpenseCategory,
    explanation: body.explanation,
    recommendation: body.recommendation,
    accounts,
    balances,
    sortedCategories,
    sortedSources,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: reportTestRecipientEmail,
      subject: `RumahBudget ${body.reportType}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (error) {
      const message = getErrorMessage(error);

      await saveEmailReportLog({
        errorMessage: message,
        periodLabel: body.periodLabel,
        recipientEmail: reportTestRecipientEmail,
        reportType: body.reportType,
        status: "failed",
        supabase,
        userId: user.id,
      });

      return Response.json({ error: message }, { status: 400 });
    }

    await saveEmailReportLog({
      errorMessage: "",
      periodLabel: body.periodLabel,
      recipientEmail: reportTestRecipientEmail,
      reportType: body.reportType,
      status: "success",
      supabase,
      userId: user.id,
    });

    return Response.json({ id: data?.id ?? null });
  } catch (error) {
    const message = getErrorMessage(error);

    await saveEmailReportLog({
      errorMessage: message,
      periodLabel: body.periodLabel,
      recipientEmail: reportTestRecipientEmail,
      reportType: body.reportType,
      status: "failed",
      supabase,
      userId: user.id,
    });

    return Response.json({ error: message }, { status: 500 });
  }
}
