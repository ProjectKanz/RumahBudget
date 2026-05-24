import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type ReportPayload = {
  reportType: "Weekly Report" | "Monthly Report";
  periodLabel: string;
  totalIncome: string;
  totalExpense: string;
  remainingBalance: string;
  financialStatus: "Aman" | "Waspada" | "Bahaya";
  topExpenseCategory: string;
  explanation: string;
  recommendation: string;
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

  return "Gagal mengirim laporan email.";
}

function buildReportEmail(
  report: ReportPayload,
  accountEmail: string,
  recipientEmail: string,
) {
  const rows = [
    ["Report type", report.reportType],
    ["Periode", report.periodLabel],
    ["Total pemasukan", report.totalIncome],
    ["Total pengeluaran", report.totalExpense],
    ["Sisa saldo", report.remainingBalance],
    ["Status keuangan", report.financialStatus],
    ["Kategori terbesar", report.topExpenseCategory],
    ["Penjelasan", report.explanation],
    ["Rekomendasi", report.recommendation],
  ];

  const text = [
    "Laporan Keuangan RumahBudget",
    `Pemilik akun: ${accountEmail}`,
    `Dikirim ke: ${recipientEmail}`,
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
      <h1 style="margin-bottom: 8px;">Laporan Keuangan RumahBudget</h1>
      <p style="margin-top: 0; color: #64748b;">Ringkasan pribadi untuk ${escapeHtml(accountEmail)}</p>
      <p style="margin-top: 0; color: #64748b;">Mode testing Resend: email dikirim ke ${escapeHtml(recipientEmail)}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; border: 1px solid #e2e8f0;">
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
        Email ini dikirim manual dari preview laporan RumahBudget.
      </p>
    </div>
  `;

  return { html, text };
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const reportTestRecipientEmail = process.env.REPORT_TEST_RECIPIENT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!resendApiKey) {
    return Response.json(
      {
        error:
          "Missing RESEND_API_KEY. Tambahkan ke .env.local lalu restart npm run dev.",
      },
      { status: 500 },
    );
  }

  if (!reportTestRecipientEmail) {
    return Response.json(
      {
        error:
          "Missing REPORT_TEST_RECIPIENT_EMAIL. Tambahkan email Resend yang terverifikasi ke .env.local lalu restart npm run dev.",
      },
      { status: 500 },
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      {
        error:
          "Missing Supabase environment variables. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY tersedia lalu restart npm run dev.",
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
      { error: "Login diperlukan sebelum mengirim laporan email." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as unknown;

  if (!isReportPayload(body)) {
    return Response.json(
      { error: "Format laporan tidak valid." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
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
      return Response.json({ error: getErrorMessage(error) }, { status: 400 });
    }

    return Response.json({ id: data?.id ?? null });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
