import { createTelegramLinkToken, isValidTelegramSecret } from "@/src/lib/telegram-security";

export const runtime = "nodejs";

type SupabaseAuthUser = {
  id: string;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const linkSecret = process.env.TELEGRAM_LINK_SECRET;

  if (!supabaseUrl || !supabaseAnonKey || !isValidTelegramSecret(linkSecret)) {
    return Response.json(
      { error: "Telegram link token configuration is missing on server." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!accessToken) {
    return Response.json({ error: "Missing Supabase session token." }, { status: 401 });
  }

  const authUrl = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;
  const authResponse = await fetch(authUrl, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!authResponse.ok) {
    return Response.json({ error: "Invalid Supabase session token." }, { status: 401 });
  }

  const user = (await authResponse.json()) as SupabaseAuthUser;
  if (!user?.id) {
    return Response.json({ error: "Invalid Supabase session token." }, { status: 401 });
  }

  const linkToken = createTelegramLinkToken(user.id, linkSecret);

  return Response.json({
    expiresInSeconds: 15 * 60,
    startCommand: `/start ${linkToken}`,
  });
}
