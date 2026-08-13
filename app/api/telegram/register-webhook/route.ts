import { createClient } from "@supabase/supabase-js";
import { isValidTelegramSecret } from "@/src/lib/telegram-security";

export const runtime = "nodejs";

type RegisterWebhookBody = {
  baseUrl?: string;
  botToken?: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

async function getUserFromAccessToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string,
) {
  const authUrl = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;
  const res = await fetch(authUrl, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      error: detail || `Supabase Auth rejected the session token with status ${res.status}.`,
      user: null,
    };
  }

  const user = (await res.json()) as SupabaseAuthUser;
  if (!user?.id) {
    return {
      error: "Supabase Auth returned an empty user.",
      user: null,
    };
  }

  return {
    error: "",
    user,
  };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const linkSecret = process.env.TELEGRAM_LINK_SECRET;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceKey ||
    !isValidTelegramSecret(webhookSecret) ||
    !isValidTelegramSecret(linkSecret)
  ) {
    return Response.json(
      { error: "Telegram webhook security configuration is missing on server." },
      { status: 503 },
    );
  }

  let body: RegisterWebhookBody;
  try {
    body = (await request.json()) as RegisterWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const botToken = body.botToken?.trim();
  const baseUrl = normalizeBaseUrl(body.baseUrl ?? "");

  if (!botToken) {
    return Response.json({ error: "Telegram bot token is required." }, { status: 400 });
  }

  if (!baseUrl.startsWith("https://")) {
    return Response.json({ error: "Webhook URL must start with https://." }, { status: 400 });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!accessToken) {
    return Response.json({ error: "Missing Supabase session token." }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: authError, user } = await getUserFromAccessToken(
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
  );

  if (authError || !user) {
    return Response.json(
      {
        error:
          "Invalid Supabase session token. Please log out, log back in, then try registering the webhook again.",
        detail: authError,
      },
      { status: 401 },
    );
  }

  const { data: existingPreference, error: selectError } = await supabaseAdmin
    .from("report_preferences")
    .select("weekly_enabled, monthly_enabled, recipient_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    return Response.json(
      {
        error:
          selectError.code === "42P01"
            ? "report_preferences table is missing. Run the database migration first."
            : selectError.message,
      },
      { status: 500 },
    );
  }

  const { error: upsertError } = await supabaseAdmin
    .from("report_preferences")
    .upsert(
      {
        user_id: user.id,
        weekly_enabled: Boolean(existingPreference?.weekly_enabled),
        monthly_enabled: Boolean(existingPreference?.monthly_enabled),
        recipient_email: existingPreference?.recipient_email ?? user.email ?? "",
        telegram_bot_token: botToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: false },
    );

  if (upsertError) {
    return Response.json(
      {
        error:
          upsertError.code === "42703" || upsertError.message.includes("telegram_bot_token")
            ? "Telegram columns are missing in report_preferences. Run the Telegram database migration first."
            : upsertError.message,
      },
      { status: 500 },
    );
  }

  const webhookUrl = `${baseUrl}/api/telegram`;
  const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: true,
      secret_token: webhookSecret,
      url: webhookUrl,
    }),
  });

  const telegramData = await telegramRes.json().catch(() => null);

  if (!telegramRes.ok || !telegramData?.ok) {
    return Response.json(
      {
        error: telegramData?.description || "Failed to register Telegram webhook.",
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    description: telegramData.description,
    webhookUrl,
  });
}
