import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface CommitmentBody {
  accountId?: unknown;
  name?: unknown;
  amount?: unknown;
  category?: unknown;
  commitmentType?: unknown;
  dueDay?: unknown;
  isAutoDeduct?: unknown;
  disableReminders?: unknown;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const commitmentTypes = new Set([
  "subscription",
  "installment",
  "paylater",
  "rent",
  "other",
]);

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      { error: "Missing Supabase configuration" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return Response.json(
      { error: "Please log in before accessing commitments." },
      { status: 401 },
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

  if (authError || !user) {
    return Response.json(
      { error: authError?.message ?? "Session invalid" },
      { status: 401 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("recurring_commitments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        // Do not seed financial commitments when persistence is unavailable.
        return Response.json({
          data: [],
          isFallback: true,
          warning:
            "Table 'recurring_commitments' does not exist. No synthetic commitments were created.",
        });
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data, isFallback: false });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: errMsg || "Failed to load commitments" },
      { status: 500 },
    );
  }
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

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return Response.json(
      { error: "Please log in before saving commitments." },
      { status: 401 },
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

  if (authError || !user) {
    return Response.json(
      { error: authError?.message ?? "Session invalid" },
      { status: 401 },
    );
  }

  let body: CommitmentBody;
  try {
    body = (await request.json()) as CommitmentBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    accountId,
    name,
    amount,
    category,
    commitmentType,
    dueDay,
    isAutoDeduct = false,
    disableReminders = false,
  } = body;

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedCategory =
    typeof category === "string" ? category.trim() : "";
  const normalizedAccountId =
    typeof accountId === "string" ? accountId.trim() : "";
  const numericAmount = Number(amount);
  const numericDueDay = Number(dueDay);
  const hasAccountId = accountId !== undefined && accountId !== null && accountId !== "";

  if (
    !normalizedName ||
    normalizedName.length > 120 ||
    !normalizedCategory ||
    normalizedCategory.length > 80 ||
    typeof commitmentType !== "string" ||
    !commitmentTypes.has(commitmentType) ||
    (hasAccountId && !uuidPattern.test(normalizedAccountId)) ||
    typeof isAutoDeduct !== "boolean" ||
    typeof disableReminders !== "boolean" ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !Number.isInteger(numericDueDay) ||
    numericDueDay < 1 ||
    numericDueDay > 31
  ) {
    return Response.json(
      {
        error:
          "Provide a name (max 120), category (max 80), positive finite amount, valid commitment type/account, boolean flags, and due day from 1 to 31.",
      },
      { status: 400 },
    );
  }

  try {
    if (normalizedAccountId) {
      const { data: ownedAccount, error: accountError } = await supabase
        .from("money_accounts")
        .select("id")
        .eq("id", normalizedAccountId)
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .maybeSingle();

      if (accountError || !ownedAccount) {
        return Response.json(
          { error: "Linked account is missing, archived, or not owned by you." },
          { status: 400 },
        );
      }
    }

    const { data, error } = await supabase
      .from("recurring_commitments")
      .insert({
        user_id: user.id,
        account_id: normalizedAccountId || null,
        name: normalizedName,
        amount: numericAmount,
        category: normalizedCategory,
        commitment_type: commitmentType,
        due_day: numericDueDay,
        is_auto_deduct: isAutoDeduct,
        disable_reminders: disableReminders,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "42P01") {
        return Response.json(
          {
            error: "Table 'recurring_commitments' does not exist in database yet. Please ask your administrator to run migrations.",
            isFallback: true,
          },
          { status: 503 }, // Service Unavailable
        );
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: errMsg || "Failed to create commitment" },
      { status: 500 },
    );
  }
}
