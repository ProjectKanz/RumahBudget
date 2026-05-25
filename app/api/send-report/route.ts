import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

  return "Failed to send email report.";
}

function buildReportEmail(
  report: ReportPayload,
  accountEmail: string,
  recipientEmail: string,
) {
  const rows = [
    ["Report type", report.reportType],
    ["Period", report.periodLabel],
    ["Total income", report.totalIncome],
    ["Total expenses", report.totalExpense],
    ["Remaining balance", report.remainingBalance],
    ["Financial status", report.financialStatus],
    ["Top expense category", report.topExpenseCategory],
    ["Explanation", report.explanation],
    ["Recommendation", report.recommendation],
  ];

  const text = [
    "RumahBudget Financial Report",
    `Account owner: ${accountEmail}`,
    `Sent to: ${recipientEmail}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
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

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h1 style="margin-bottom: 8px;">RumahBudget Financial Report</h1>
      <p style="margin-top: 0; color: #64748b;">Personal summary for ${escapeHtml(accountEmail)}</p>
      <p style="margin-top: 0; color: #64748b;">Resend testing mode: email sent to ${escapeHtml(recipientEmail)}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; border: 1px solid #e2e8f0;">
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
        This email was sent manually from the RumahBudget report preview.
      </p>
    </div>
  `;

  return { html, text };
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

  const resend = new Resend(resendApiKey);
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "RumahBudget <onboarding@resend.dev>";
  const email = buildReportEmail(body, user.email, reportTestRecipientEmail);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: reportTestRecipientEmail,
      subject: `RumahBudget ${body.reportType}`,
      html: email.html,
      text: email.text,
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
