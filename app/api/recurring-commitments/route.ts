import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface CommitmentBody {
  accountId?: string;
  name?: string;
  amount?: number | string;
  category?: string;
  commitmentType?: string;
  dueDay?: number | string;
  isAutoDeduct?: boolean;
  disableReminders?: boolean;
}

// Local fallback database structure/config in case table does not exist yet.
const fallbackCommitments = [
  {
    id: "fallback-sub-1",
    name: "Spotify Premium (Local Fallback)",
    amount: 54990,
    category: "Bills",
    commitment_type: "subscription",
    due_day: 15,
    is_auto_deduct: true,
    disable_reminders: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-rent-2",
    name: "Rent (Local Fallback)",
    amount: 2500000,
    category: "Other",
    commitment_type: "rent",
    due_day: 1,
    is_auto_deduct: false,
    disable_reminders: false,
    created_at: new Date().toISOString(),
  },
];

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
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        // Table does not exist yet. Return local state/config fallback.
        return Response.json({
          data: fallbackCommitments,
          isFallback: true,
          warning: "Table 'recurring_commitments' does not exist in database yet. Returning local state fallback.",
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

  if (!name || !amount || !category || !commitmentType || !dueDay) {
    return Response.json(
      { error: "Missing required fields: name, amount, category, commitmentType, dueDay" },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("recurring_commitments")
      .insert({
        user_id: user.id,
        account_id: accountId || null,
        name,
        amount: Number(amount),
        category,
        commitment_type: commitmentType,
        due_day: Number(dueDay),
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
