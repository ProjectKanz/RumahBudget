import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  buildDetailedHtmlReport,
  AccountRow,
} from "@/src/lib/email-templates";
import {
  calculateFinanceSnapshot,
  getHouseholdIncomes,
} from "@/src/lib/finance-calculations";
import {
  mapAccountRows,
  mapExpenseRows,
  mapIncomeRows,
  mapTradingResultRows,
  mapTransferRows,
} from "@/src/lib/ledger-rows";
import {
  createPeriodFromKeys,
  summarizeReportPeriod,
} from "@/src/lib/report-period";

export const runtime = "nodejs";

type ReportPayload = {
  reportType: "Weekly Report" | "Monthly Report";
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
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
  "periodStart",
  "periodEnd",
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

  if (!requiredFields.every((field) => typeof payload[field] === "string")) {
    return false;
  }

  const reportType = payload.reportType;
  const financialStatus = payload.financialStatus;
  const periodStart = payload.periodStart as string;
  const periodEnd = payload.periodEnd as string;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startTime = Date.parse(`${periodStart}T00:00:00Z`);
  const endTime = Date.parse(`${periodEnd}T00:00:00Z`);
  const textFields = requiredFields.filter(
    (field) => field !== "periodStart" && field !== "periodEnd",
  );

  return (
    (reportType === "Weekly Report" || reportType === "Monthly Report") &&
    (financialStatus === "Safe" ||
      financialStatus === "Warning" ||
      financialStatus === "Critical") &&
    datePattern.test(periodStart) &&
    datePattern.test(periodEnd) &&
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    new Date(startTime).toISOString().slice(0, 10) === periodStart &&
    new Date(endTime).toISOString().slice(0, 10) === periodEnd &&
    endTime >= startTime &&
    endTime - startTime <= 31 * 24 * 60 * 60 * 1000 &&
    textFields.every((field) => (payload[field] as string).length <= 500)
  );
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

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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
  let numIncome = 0;
  let numExpense = 0;
  let numNet = 0;

  try {
    // Fetch accounts
    const { data: accountsData, error: accountsError } = await supabase
      .from("money_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false);

    if (accountsError) {
      throw new Error("Unable to load owner-scoped money accounts.");
    }

    if (accountsData) {
      accounts = accountsData;
    }

    // Every ledger table the dashboard reads, so the email can run the same
    // calculation instead of a reduced copy of it.
    const [allIncomesRes, allExpensesRes, allTransfersRes, allTradingRes] =
      await Promise.all([
        supabase.from("incomes").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
        supabase.from("transfers").select("*").eq("user_id", user.id),
        supabase.from("trading_results").select("*").eq("user_id", user.id),
      ]);

    if (allIncomesRes.error || allExpensesRes.error || allTransfersRes.error) {
      throw new Error("Unable to load complete owner-scoped report data.");
    }

    const period = createPeriodFromKeys(
      body.reportType === "Weekly Report" ? "weekly" : "monthly",
      body.periodStart,
      body.periodEnd,
    );
    if (!period) {
      throw new Error("Report period is not a valid date range.");
    }

    // A missing trading_results table is not fatal: the segment is optional, and
    // a report without it is still correct for a ledger that never used it.
    const mappedAccounts = mapAccountRows(accounts, user.id);
    const mappedIncomes = mapIncomeRows(allIncomesRes.data || [], user.id);
    const mappedExpenses = mapExpenseRows(allExpensesRes.data || [], user.id);
    const mappedTransfers = mapTransferRows(allTransfersRes.data || [], user.id);
    const mappedTradingResults = allTradingRes.error
      ? []
      : mapTradingResultRows(allTradingRes.data || [], user.id);

    const snapshot = calculateFinanceSnapshot({
      accounts: mappedAccounts,
      expenses: mappedExpenses,
      incomes: mappedIncomes,
      tradingResults: mappedTradingResults,
      transfers: mappedTransfers,
    });
    Object.assign(balances, snapshot.accountBalances);

    // Income that was migrated into the Trading ledger is no longer household
    // income. Counting it here is what made emailed totals exceed the app's.
    const householdIncomes = getHouseholdIncomes(
      mappedIncomes,
      mappedTradingResults,
    );

    const summary = summarizeReportPeriod({
      expenses: mappedExpenses,
      incomes: householdIncomes,
      period,
    });

    numIncome = summary.totalIncome;
    numExpense = summary.totalExpense;
    numNet = summary.netCashflow;
    sortedCategories = summary.sortedCategories;
    sortedSources = summary.sortedSources;
  } catch (err) {
    console.error("Graceful database query error in send-report route:", err);
    const message = getErrorMessage(err);
    await saveEmailReportLog({
      errorMessage: message,
      periodLabel: body.periodLabel,
      recipientEmail: reportTestRecipientEmail,
      reportType: body.reportType,
      status: "failed",
      supabase,
      userId: user.id,
    });
    return Response.json({ error: message }, { status: 503 });
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
