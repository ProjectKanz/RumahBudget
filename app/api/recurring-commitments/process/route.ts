import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProcessCommitmentBody = {
  commitmentId?: unknown;
  mode?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      { error: "Missing Supabase configuration" },
      { status: 500 },
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return Response.json(
      { error: "Please log in before processing commitments." },
      { status: 401 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json(
      { error: authError?.message ?? "Session invalid" },
      { status: 401 },
    );
  }

  let body: ProcessCommitmentBody;
  try {
    body = (await request.json()) as ProcessCommitmentBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.commitmentId !== "string" ||
    !uuidPattern.test(body.commitmentId)
  ) {
    return Response.json(
      { error: "A valid commitmentId is required." },
      { status: 400 },
    );
  }

  const mode = body.mode ?? "auto";
  if (mode !== "auto" && mode !== "manual") {
    return Response.json(
      { error: "Mode must be either auto or manual." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("process_recurring_commitment", {
    p_commitment_id: body.commitmentId,
    p_mode: mode,
  });

  if (error) {
    const isMissingRpc = error.code === "42883" || error.code === "PGRST202";
    return Response.json(
      {
        error: isMissingRpc
          ? "Recurring processing RPC is not installed. Review and apply the approved migration first."
          : error.message,
      },
      { status: isMissingRpc ? 503 : 409 },
    );
  }

  return Response.json({ data });
}
