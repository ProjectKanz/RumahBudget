import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TelegramMessage {
  text?: string;
  chat?: {
    id: number;
  };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

function getUserIdFromToken(token: string): string | null {
  if (uuidRegex.test(token)) {
    return token;
  }
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (uuidRegex.test(decoded)) {
      return decoded;
    }
  } catch {
    // Ignore error
  }
  return null;
}

function mapCategory(input: string): string {
  const normalized = input.trim().toLowerCase();

  if (["groceries", "grocer", "grocery", "belanja", "dapur", "makan", "makanan"].includes(normalized)) {
    return "Groceries";
  }
  if (["transportation", "transport", "transportasi", "ojek", "bensin", "perjalanan", "travel"].includes(normalized)) {
    return "Transportation";
  }
  if (["bills", "bill", "tagihan", "listrik", "air", "wifi", "internet", "pulsa"].includes(normalized)) {
    return "Bills";
  }
  if (["education", "edu", "pendidikan", "sekolah", "kuliah", "buku", "kursus"].includes(normalized)) {
    return "Education";
  }
  if (["health", "healthy", "kesehatan", "obat", "dokter", "sakit", "klinik", "rs"].includes(normalized)) {
    return "Health";
  }

  const match = ["Groceries", "Transportation", "Bills", "Education", "Health", "Other"].find(
    (cat) => cat.toLowerCase() === normalized,
  );
  if (match) return match;

  return "Other";
}

async function sendTelegramMessage(chatId: string | number, text: string, botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("No Telegram bot token found in environment or preferences");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.error("Failed to send telegram message:", await res.text());
    }
  } catch (error) {
    console.error("Error sending telegram message:", error);
  }
}

async function getMostRecentStoredBotToken(supabaseAdmin: SupabaseClient) {
  try {
    const { data } = await supabaseAdmin
      .from("report_preferences")
      .select("telegram_bot_token")
      .not("telegram_bot_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestPreference = data as { telegram_bot_token?: string | null } | null;
    return latestPreference?.telegram_bot_token || "";
  } catch (err) {
    console.error("Error fetching latest stored Telegram bot token:", err);
    return "";
  }
}

async function sendHelpMessage(chatId: number, botToken?: string) {
  const helpText =
    `<b>RumahBudget Bot Help</b>\n\n` +
    `Here are the available commands:\n\n` +
    `• <b>Link your account:</b>\n` +
    `<code>/start &lt;token&gt;</code>\n` +
    `<i>Copy the token from your settings or encode your user_id to base64.</i>\n\n` +
    `• <b>Log an Expense:</b>\n` +
    `<code>/expense &lt;amount&gt; &lt;category&gt; [note]</code>\n` +
    `<i>Categories: Groceries, Transportation, Bills, Education, Health, Other</i>\n` +
    `Example: <code>/expense 50000 Groceries Dinner last night</code>\n\n` +
    `• <b>Log an Income:</b>\n` +
    `<code>/income &lt;amount&gt; &lt;source&gt; [note]</code>\n` +
    `Example: <code>/income 5000000 Salary Monthly wage</code>\n\n` +
    `• <b>Check Balances & Runway:</b>\n` +
    `<code>/balance</code>\n\n` +
    `• <b>Help:</b>\n` +
    `<code>/help</code>`;

  await sendTelegramMessage(chatId, helpText, botToken);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Supabase service role configuration is missing on server." },
      { status: 500 },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let body: TelegramUpdate;
  try {
    body = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message || body.edited_message;
  if (!message || !message.text || !message.chat || !message.chat.id) {
    // Return 200 so Telegram webhook stops retrying
    return Response.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const fallbackUserId = process.env.TELEGRAM_FALLBACK_USER_ID || "";

  // 2. Handle /start
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const token = parts[1];
    let startBotToken: string | undefined = undefined;

    if (!token) {
      await sendTelegramMessage(
        chatId,
        "❌ <b>Missing token.</b>\nUse: <code>/start &lt;token&gt;</code>\nYou can find your token in your RumahBudget settings.",
        startBotToken,
      );
      return Response.json({ ok: true });
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      await sendTelegramMessage(
        chatId,
        "❌ <b>Invalid token format.</b>\nPlease copy the correct base64 token or UUID from your settings page.",
        startBotToken,
      );
      return Response.json({ ok: true });
    }

    try {
      const { data: prefData } = await supabaseAdmin
        .from("report_preferences")
        .select("telegram_bot_token")
        .eq("user_id", userId)
        .maybeSingle();
      if (prefData?.telegram_bot_token) {
        startBotToken = prefData.telegram_bot_token;
      }
    } catch (err) {
      console.error("Error fetching bot token in /start:", err);
    }

    if (!startBotToken) {
      startBotToken = await getMostRecentStoredBotToken(supabaseAdmin);
    }

    let linkedUserEmail = "";
    try {
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUserError || !authUser.user) {
        await sendTelegramMessage(
          chatId,
          "❌ <b>Unknown account token.</b>\nPlease copy the latest <code>/start</code> command from RumahBudget while logged in.",
          startBotToken,
        );
        return Response.json({ ok: true });
      }
      linkedUserEmail = authUser.user.email || "";
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Error validating /start user:", errMsg);
      await sendTelegramMessage(
        chatId,
        `❌ Failed to validate account token: ${errMsg}`,
        startBotToken,
      );
      return Response.json({ ok: true });
    }

    try {
      const linkPayload: Record<string, string | boolean> = {
        user_id: userId,
        weekly_enabled: false,
        monthly_enabled: false,
        recipient_email: linkedUserEmail,
        telegram_chat_id: String(chatId),
        updated_at: new Date().toISOString(),
      };

      if (startBotToken) {
        linkPayload.telegram_bot_token = startBotToken;
      }

      const { error: upsertError } = await supabaseAdmin
        .from("report_preferences")
        .upsert(linkPayload, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Error upserting telegram chat id:", upsertError);

        if (
          upsertError.code === "42703" ||
          upsertError.message?.includes("telegram_chat_id") ||
          upsertError.code === "42P01"
        ) {
          // Columns or table don't exist yet
          if (fallbackUserId && userId === fallbackUserId) {
            await sendTelegramMessage(
              chatId,
              "⚠️ Database columns are missing, but you are using the configured local fallback user ID.\n\n" +
                "You can now log transactions using <code>/expense</code> and <code>/income</code>.",
              startBotToken,
            );
          } else {
            await sendTelegramMessage(
              chatId,
              "⚠️ Database columns or tables for Telegram integration are missing. Please run the SQL migration script first.\n\n" +
                "You can also set <code>TELEGRAM_FALLBACK_USER_ID</code> in environment variables for testing.",
              startBotToken,
            );
          }
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ Failed to link account: ${upsertError.message}`,
            startBotToken,
          );
        }
        return Response.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        "✅ <b>Successfully linked!</b>\nYour Telegram chat has been linked to your RumahBudget account. You can now log transactions directly from here.",
        startBotToken,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Linking error:", errMsg);
      await sendTelegramMessage(
        chatId,
        `❌ Unexpected error during link: ${errMsg}`,
        startBotToken,
      );
    }

    return Response.json({ ok: true });
  }

  // --- Authenticate user by telegram_chat_id ---
  let userId = "";
  let userBotToken = "";

  try {
    const { data: prefData, error: prefErr } = await supabaseAdmin
      .from("report_preferences")
      .select("user_id, telegram_bot_token")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (prefErr) {
      console.error("Error loading preference for chat_id:", prefErr);
      if (
        prefErr.code === "42703" ||
        prefErr.message?.includes("telegram_chat_id") ||
        prefErr.code === "42P01"
      ) {
        if (fallbackUserId) {
          userId = fallbackUserId;
        } else {
          await sendTelegramMessage(
            chatId,
            "⚠️ Database columns or tables for Telegram integration are missing. Please run the SQL migration script first.\n\n" +
              "You can also set <code>TELEGRAM_FALLBACK_USER_ID</code> in environment variables for testing.",
          );
          return Response.json({ ok: true });
        }
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ Database error: ${prefErr.message}`,
        );
        return Response.json({ ok: true });
      }
    } else if (!prefData || !prefData.user_id) {
      if (fallbackUserId) {
        userId = fallbackUserId;
      } else {
        await sendTelegramMessage(
          chatId,
          "⚠️ <b>Chat not linked.</b>\nYour Telegram chat is not linked to any RumahBudget account.\nUse <code>/start &lt;token&gt;</code> to link your account first.",
        );
        return Response.json({ ok: true });
      }
    } else {
      userId = prefData.user_id;
      userBotToken = prefData.telegram_bot_token || "";
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Auth resolve error:", errMsg);
    await sendTelegramMessage(chatId, `❌ Authentication error: ${errMsg}`);
    return Response.json({ ok: true });
  }

  // Handle /help (moved after chat_id lookup is complete and userBotToken is set)
  if (text.startsWith("/help")) {
    await sendHelpMessage(chatId, userBotToken);
    return Response.json({ ok: true });
  }

  // Fetch auth user's email
  let userEmail = "";
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    userEmail = authUser?.user?.email || "";
  } catch {
    // Continue without user email
  }

  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();

  // 3. Handle /expense
  if (command === "/expense") {
    if (parts.length < 3) {
      await sendHelpMessage(chatId, userBotToken);
      return Response.json({ ok: true });
    }

    const amountStr = parts[1].replace(/[^0-9.-]/g, "");
    const amountVal = parseFloat(amountStr);

    if (isNaN(amountVal) || amountVal <= 0) {
      await sendTelegramMessage(
        chatId,
        "❌ <b>Invalid amount.</b>\nThe amount must be a positive number.\nExample: <code>/expense 50000 Groceries</code>",
        userBotToken,
      );
      return Response.json({ ok: true });
    }

    const rawCategory = parts[2];
    const category = mapCategory(rawCategory);
    const note = parts.slice(3).join(" ") || "Logged via Telegram";

    try {
      // Get first active account
      const { data: accounts, error: accErr } = await supabaseAdmin
        .from("money_accounts")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (accErr) {
        await sendTelegramMessage(
          chatId,
          `❌ Failed to fetch accounts: ${accErr.message}`,
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      if (!accounts || accounts.length === 0) {
        await sendTelegramMessage(
          chatId,
          "❌ <b>No money accounts found.</b>\nPlease create a money account in the RumahBudget web application first.",
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      const account = accounts[0];

      // Save expense
      const { error: insErr } = await supabaseAdmin.from("expenses").insert({
        user_id: userId,
        owner: userEmail || "telegram-user",
        account_id: account.id,
        amount: amountVal,
        category,
        payment_method: "Cash",
        note,
      });

      if (insErr) {
        await sendTelegramMessage(
          chatId,
          `❌ Failed to save expense: ${insErr.message}`,
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      const formatIdr = (val: number) => {
        return new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(val);
      };

      await sendTelegramMessage(
        chatId,
        `💸 <b>Expense recorded!</b>\n\n` +
          `• <b>Amount:</b> ${formatIdr(amountVal)}\n` +
          `• <b>Category:</b> ${category}\n` +
          `• <b>Account:</b> ${account.name}\n` +
          `• <b>Note:</b> ${note}`,
        userBotToken,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await sendTelegramMessage(
        chatId,
        `❌ Unexpected error: ${errMsg}`,
        userBotToken,
      );
    }

    return Response.json({ ok: true });
  }

  // 4. Handle /income
  if (command === "/income") {
    if (parts.length < 3) {
      await sendHelpMessage(chatId, userBotToken);
      return Response.json({ ok: true });
    }

    const amountStr = parts[1].replace(/[^0-9.-]/g, "");
    const amountVal = parseFloat(amountStr);

    if (isNaN(amountVal) || amountVal <= 0) {
      await sendTelegramMessage(
        chatId,
        "❌ <b>Invalid amount.</b>\nThe amount must be a positive number.\nExample: <code>/income 5000000 Salary</code>",
        userBotToken,
      );
      return Response.json({ ok: true });
    }

    const source = parts[2];
    const note = parts.slice(3).join(" ") || "Logged via Telegram";

    try {
      // Get first active account
      const { data: accounts, error: accErr } = await supabaseAdmin
        .from("money_accounts")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (accErr) {
        await sendTelegramMessage(
          chatId,
          `❌ Failed to fetch accounts: ${accErr.message}`,
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      if (!accounts || accounts.length === 0) {
        await sendTelegramMessage(
          chatId,
          "❌ <b>No money accounts found.</b>\nPlease create a money account in the RumahBudget web application first.",
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      const account = accounts[0];

      // Save income
      const { error: insErr } = await supabaseAdmin.from("incomes").insert({
        user_id: userId,
        owner: userEmail || "telegram-user",
        account_id: account.id,
        amount: amountVal,
        source,
        note,
      });

      if (insErr) {
        await sendTelegramMessage(
          chatId,
          `❌ Failed to save income: ${insErr.message}`,
          userBotToken,
        );
        return Response.json({ ok: true });
      }

      const formatIdr = (val: number) => {
        return new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(val);
      };

      await sendTelegramMessage(
        chatId,
        `💰 <b>Income recorded!</b>\n\n` +
          `• <b>Amount:</b> ${formatIdr(amountVal)}\n` +
          `• <b>Source:</b> ${source}\n` +
          `• <b>Account:</b> ${account.name}\n` +
          `• <b>Note:</b> ${note}`,
        userBotToken,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await sendTelegramMessage(
        chatId,
        `❌ Unexpected error: ${errMsg}`,
        userBotToken,
      );
    }

    return Response.json({ ok: true });
  }

  // 5. Handle /balance
  if (command === "/balance") {
    try {
      const [accountsRes, incomesRes, expensesRes, transfersRes] = await Promise.all([
        supabaseAdmin.from("money_accounts").select("*").eq("user_id", userId).eq("is_archived", false),
        supabaseAdmin.from("incomes").select("*").eq("user_id", userId),
        supabaseAdmin.from("expenses").select("*").eq("user_id", userId),
        supabaseAdmin.from("transfers").select("*").eq("user_id", userId),
      ]);

      if (accountsRes.error) throw new Error(accountsRes.error.message);
      if (incomesRes.error) throw new Error(incomesRes.error.message);
      if (expensesRes.error) throw new Error(expensesRes.error.message);
      if (transfersRes.error) throw new Error(transfersRes.error.message);

      const accounts = accountsRes.data || [];
      const balances: Record<string, number> = {};

      // Compute balances
      accounts.forEach((acc) => {
        balances[acc.id] = Number(acc.initial_balance || 0);
      });
      (incomesRes.data || []).forEach((inc) => {
        if (inc.account_id && inc.account_id in balances) {
          balances[inc.account_id] += Number(inc.amount || 0);
        }
      });
      (expensesRes.data || []).forEach((exp) => {
        if (exp.account_id && exp.account_id in balances) {
          balances[exp.account_id] -= Number(exp.amount || 0);
        }
      });
      (transfersRes.data || []).forEach((tf) => {
        if (tf.to_account_id && tf.to_account_id in balances) {
          balances[tf.to_account_id] += Number(tf.amount || 0);
        }
        if (tf.from_account_id && tf.from_account_id in balances) {
          balances[tf.from_account_id] -= Number(tf.amount || 0);
        }
      });

      // Runway calculation
      const monthlyBurnMap = new Map<string, number>();
      (expensesRes.data || []).forEach((exp) => {
        const date = exp.created_at ? new Date(exp.created_at) : new Date();
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyBurnMap.set(key, (monthlyBurnMap.get(key) || 0) + Number(exp.amount || 0));
      });

      const totalAllExpenses = Array.from(monthlyBurnMap.values()).reduce((sum, v) => sum + v, 0);
      const averageMonthlyBurn = monthlyBurnMap.size > 0 ? totalAllExpenses / monthlyBurnMap.size : 0;

      let totalBalance = 0;
      const formatIdr = (val: number) => {
        return new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(val);
      };

      let reply = `<b>RumahBudget Account Balance Summary</b>\n\n`;
      accounts.forEach((acc) => {
        const bal = balances[acc.id] || 0;
        totalBalance += bal;
        reply += `• <b>${acc.name}:</b> ${formatIdr(bal)}\n`;
      });

      const runwayMonths = averageMonthlyBurn > 0 ? totalBalance / averageMonthlyBurn : Infinity;

      reply += `\n<b>Total Balance:</b> ${formatIdr(totalBalance)}\n`;
      reply += `<b>Average Monthly Burn:</b> ${formatIdr(averageMonthlyBurn)}\n`;
      if (runwayMonths === Infinity) {
        reply += `<b>Survival Runway:</b> ∞ months (no expenses logged)`;
      } else {
        reply += `<b>Survival Runway:</b> ${runwayMonths.toFixed(1)} months`;
      }

      await sendTelegramMessage(chatId, reply, userBotToken);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await sendTelegramMessage(
        chatId,
        `❌ Failed to calculate balance: ${errMsg}`,
        userBotToken,
      );
    }

    return Response.json({ ok: true });
  }

  // 6. Unrecognized Command
  await sendHelpMessage(chatId, userBotToken);
  return Response.json({ ok: true });
}
