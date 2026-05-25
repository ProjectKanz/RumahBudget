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

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Scheduling foundation only:
  // - Vercel Cron can call this protected endpoint.
  // - Testing mode keeps REPORT_TEST_RECIPIENT_EMAIL as the only recipient.
  // - Full production scheduling is still disabled while this endpoint reads
  //   aggregate preference readiness.
  const [
    totalPreferencesResult,
    weeklyEnabledResult,
    monthlyEnabledResult,
  ] = await Promise.all([
    supabase
      .from("report_preferences")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("report_preferences")
      .select("id", { count: "exact", head: true })
      .eq("weekly_enabled", true),
    supabase
      .from("report_preferences")
      .select("id", { count: "exact", head: true })
      .eq("monthly_enabled", true),
  ]);

  const preferenceReadError =
    totalPreferencesResult.error ??
    weeklyEnabledResult.error ??
    monthlyEnabledResult.error;

  if (preferenceReadError) {
    return Response.json({ error: preferenceReadError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    mode: "testing",
    totalPreferences: totalPreferencesResult.count ?? 0,
    weeklyEnabledCount: weeklyEnabledResult.count ?? 0,
    monthlyEnabledCount: monthlyEnabledResult.count ?? 0,
    message:
      "Cron endpoint can read report preferences, but real scheduled email sending is not enabled yet.",
  });
}

export async function POST(request: Request) {
  return GET(request);
}
