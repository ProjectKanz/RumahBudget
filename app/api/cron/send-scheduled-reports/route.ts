import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const token = getBearerToken(request);

  if (!cronSecret || token !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportTestRecipientEmail = process.env.REPORT_TEST_RECIPIENT_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!reportTestRecipientEmail) {
    return Response.json(
      {
        error:
          "Missing REPORT_TEST_RECIPIENT_EMAIL. Add it to the deployment environment before enabling scheduled reports.",
      },
      { status: 500 },
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      {
        error:
          "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before enabling scheduled reports.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Scheduling foundation only:
  // - Vercel Cron can call this protected endpoint.
  // - Testing mode keeps REPORT_TEST_RECIPIENT_EMAIL as the only recipient.
  // - Full production scheduling still needs user report preferences and
  //   a secure way to select eligible users without weakening RLS.
  const { count, error } = await supabase
    .from("email_reports")
    .select("id", { count: "exact", head: true });

  return Response.json({
    ok: true,
    message:
      "Cron endpoint ready. User preference scheduling not implemented yet.",
    mode: "testing",
    recipientEmail: reportTestRecipientEmail,
    emailReportLogCount: error ? null : (count ?? 0),
    supabaseReadiness: error ? error.message : "ok",
  });
}

export async function POST(request: Request) {
  return GET(request);
}
