"use client";

import {
  Notice,
  SectionHeader,
  SharpButton,
  SharpInput,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useState } from "react";

type EmailReportPreferencesProps = {
  user: User;
  onWageChange?: (wage: number) => void;
};

type ReportPreferenceRow = {
  weekly_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  recipient_email?: string | null;
  net_hourly_wage?: number | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
};

function createSupabaseTimeout() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function getSupabaseErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Supabase connection timed out. Please try again or check your internet connection.";
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

export default function EmailReportPreferences({
  user,
  onWageChange,
}: EmailReportPreferencesProps) {
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(user.email ?? "");
  const [netHourlyWage, setNetHourlyWage] = useState<number>(0);
  const [calcSalary, setCalcSalary] = useState("");
  const [calcHours, setCalcHours] = useState("");
  const [dbSupportsWage, setDbSupportsWage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Telegram Integration Console States
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramWebhookStatus, setTelegramWebhookStatus] = useState("");
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [dbSupportsTelegram, setDbSupportsTelegram] = useState(true);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramError, setTelegramError] = useState("");

  const [isLocalhost, setIsLocalhost] = useState(false);
  const [webhookOverrideUrl, setWebhookOverrideUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLocalhost(window.location.origin.startsWith("http://localhost"));
      const localOverrideUrl = window.localStorage.getItem(`rumahbudget.webhook_override_url.${user.id}`) ?? "";
      setWebhookOverrideUrl(localOverrideUrl);
    }
  }, [user.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      setIsLoading(true);
      setMessage("");
      setError("");

      if (!supabase) {
        setError(missingSupabaseEnvMessage);
        setIsLoading(false);
        return;
      }

      const timeout = createSupabaseTimeout();
      let data: ReportPreferenceRow | null = null;
      let loadError: { message: string; code?: string } | null = null;
      let isWageSupported = true;
      let isTelegramSupported = true;

      try {
        const res = await supabase
          .from("report_preferences")
          .select("weekly_enabled, monthly_enabled, recipient_email, net_hourly_wage, telegram_bot_token, telegram_chat_id")
          .eq("user_id", user.id)
          .abortSignal(timeout.signal)
          .maybeSingle();

        if (res.error) {
          if (res.error.code === "42703" || (res.error.message && (res.error.message.includes("net_hourly_wage") || res.error.message.includes("telegram")))) {
            isWageSupported = false;
            isTelegramSupported = false;
            const fallbackRes = await supabase
              .from("report_preferences")
              .select("weekly_enabled, monthly_enabled, recipient_email")
              .eq("user_id", user.id)
              .abortSignal(timeout.signal)
              .maybeSingle();

            if (fallbackRes.error) {
              loadError = fallbackRes.error;
            } else {
              data = fallbackRes.data as ReportPreferenceRow | null;
            }
          } else {
            loadError = res.error;
          }
        } else {
          data = res.data as ReportPreferenceRow | null;
        }

        if (!isMounted) {
          return;
        }

        setDbSupportsWage(isWageSupported);
        setDbSupportsTelegram(isTelegramSupported);

        if (loadError) {
          setError(loadError.message);
          return;
        }

        setWeeklyEnabled(Boolean(data?.weekly_enabled));
        setMonthlyEnabled(Boolean(data?.monthly_enabled));
        setRecipientEmail(data?.recipient_email ?? user.email ?? "");

        let loadedWage = 0;
        if (isWageSupported && data && typeof data.net_hourly_wage === "number") {
          loadedWage = data.net_hourly_wage;
        } else {
          const localWage = window.localStorage.getItem(`rumahbudget.net_hourly_wage.${user.id}`);
          loadedWage = localWage ? Number(localWage) : 0;
        }
        setNetHourlyWage(loadedWage);
        onWageChange?.(loadedWage);

        let loadedBotToken = "";
        if (isTelegramSupported && data && typeof data.telegram_bot_token === "string") {
          loadedBotToken = data.telegram_bot_token;
        } else {
          loadedBotToken = window.localStorage.getItem(`rumahbudget.telegram_bot_token.${user.id}`) ?? "";
        }
        setTelegramBotToken(loadedBotToken);

        let loadedChatId = "";
        if (isTelegramSupported && data && typeof data.telegram_chat_id === "string") {
          loadedChatId = data.telegram_chat_id;
        } else {
          loadedChatId = window.localStorage.getItem(`rumahbudget.telegram_chat_id.${user.id}`) ?? "";
        }
        setTelegramChatId(loadedChatId);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(
          getSupabaseErrorMessage(
            err,
            "Failed to load email report settings.",
          ),
        );
      } finally {
        timeout.clear();

        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [user.email, user.id, onWageChange]);

  function updateRecipientEmail(nextEmail: string) {
    setRecipientEmail(nextEmail);
    setMessage("");
  }

  function updateWeeklyEnabled(nextValue: boolean) {
    setWeeklyEnabled(nextValue);
    setMessage("");
  }

  function updateMonthlyEnabled(nextValue: boolean) {
    setMonthlyEnabled(nextValue);
    setMessage("");
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setError(missingSupabaseEnvMessage);
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    const timeout = createSupabaseTimeout();
    let saveError: { message: string; code?: string } | null = null;
    let localSaveOnly = !dbSupportsWage;

    if (!localSaveOnly) {
      try {
        const payload: any = {
          user_id: user.id,
          weekly_enabled: weeklyEnabled,
          monthly_enabled: monthlyEnabled,
          recipient_email: recipientEmail.trim(),
          net_hourly_wage: netHourlyWage,
          updated_at: new Date().toISOString(),
        };

        if (dbSupportsTelegram) {
          payload.telegram_bot_token = telegramBotToken.trim();
        }

        const { error: upsertError } = await supabase
          .from("report_preferences")
          .upsert(payload, { onConflict: "user_id" })
          .abortSignal(timeout.signal);

        if (upsertError) {
          if (upsertError.code === "42703" || (upsertError.message && upsertError.message.includes("net_hourly_wage"))) {
            setDbSupportsWage(false);
            localSaveOnly = true;
          } else {
            saveError = upsertError;
          }
        }
      } catch (err) {
        saveError = err instanceof Error ? err : { message: String(err) };
      }
    }

    if (localSaveOnly) {
      try {
        const payload: any = {
          user_id: user.id,
          weekly_enabled: weeklyEnabled,
          monthly_enabled: monthlyEnabled,
          recipient_email: recipientEmail.trim(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from("report_preferences")
          .upsert(payload, { onConflict: "user_id" })
          .abortSignal(timeout.signal);

        if (upsertError) {
          saveError = upsertError;
        } else {
          window.localStorage.setItem(`rumahbudget.net_hourly_wage.${user.id}`, String(netHourlyWage));
        }
      } catch (err) {
        saveError = err instanceof Error ? err : { message: String(err) };
      }
    } else {
      window.localStorage.setItem(`rumahbudget.net_hourly_wage.${user.id}`, String(netHourlyWage));
    }

    setIsSaving(false);
    timeout.clear();

    if (saveError) {
      setError(
        getSupabaseErrorMessage(
          saveError,
          "Failed to save email report settings.",
        ),
      );
      return;
    }

    setRecipientEmail(recipientEmail.trim());
    onWageChange?.(netHourlyWage);
    setMessage("Email report settings saved.");
  }

  async function saveTelegramSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setTelegramError(missingSupabaseEnvMessage);
      return;
    }

    setIsSavingTelegram(true);
    setTelegramMessage("");
    setTelegramError("");

    const timeout = createSupabaseTimeout();
    let saveError: any = null;

    try {
      if (dbSupportsTelegram) {
        const payload: any = {
          user_id: user.id,
          telegram_bot_token: telegramBotToken.trim(),
          updated_at: new Date().toISOString(),
        };

        if (dbSupportsWage) {
          payload.net_hourly_wage = netHourlyWage;
        }
        payload.weekly_enabled = weeklyEnabled;
        payload.monthly_enabled = monthlyEnabled;
        payload.recipient_email = recipientEmail.trim();

        const { error: upsertError } = await supabase
          .from("report_preferences")
          .upsert(payload, { onConflict: "user_id" })
          .abortSignal(timeout.signal);

        if (upsertError) {
          if (
            upsertError.code === "42703" ||
            (upsertError.message && upsertError.message.includes("telegram_bot_token"))
          ) {
            setDbSupportsTelegram(false);
            window.localStorage.setItem(`rumahbudget.telegram_bot_token.${user.id}`, telegramBotToken.trim());
          } else {
            saveError = upsertError;
          }
        }
      } else {
        window.localStorage.setItem(`rumahbudget.telegram_bot_token.${user.id}`, telegramBotToken.trim());
      }
    } catch (err) {
      saveError = err;
    } finally {
      setIsSavingTelegram(false);
      timeout.clear();
    }

    if (saveError) {
      setTelegramError(getSupabaseErrorMessage(saveError, "Failed to save Telegram settings."));
      return;
    }

    window.localStorage.setItem(`rumahbudget.telegram_bot_token.${user.id}`, telegramBotToken.trim());
    window.localStorage.setItem(`rumahbudget.webhook_override_url.${user.id}`, webhookOverrideUrl.trim());
    setTelegramMessage("Telegram preferences saved.");
  }

  async function handleRegisterWebhook() {
    if (!telegramBotToken.trim()) {
      setTelegramWebhookStatus("Error: Bot Token cannot be empty.");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin.startsWith("http://localhost") && !webhookOverrideUrl.trim()) {
      setTelegramWebhookStatus(
        "Error: You must provide your ngrok/tunnel URL or test on the live Vercel link when running on localhost."
      );
      return;
    }

    const baseUrl = webhookOverrideUrl.trim() || origin;
    if (!baseUrl.startsWith("https://")) {
      setTelegramWebhookStatus("Error: Webhook URL must start with https://");
      return;
    }

    setIsRegisteringWebhook(true);
    setTelegramWebhookStatus("");

    try {
      const webhookUrl = `${baseUrl}/api/telegram`;
      const registerUrl = `https://api.telegram.org/bot${telegramBotToken.trim()}/setWebhook?url=${encodeURIComponent(
        webhookUrl
      )}`;

      const res = await fetch(registerUrl);
      const data = await res.json();

      if (data.ok) {
        setTelegramWebhookStatus(`Success: Webhook registered. ${data.description || ""}`);
      } else {
        setTelegramWebhookStatus(`Error: ${data.description || "Failed to register webhook."}`);
      }
    } catch (err) {
      setTelegramWebhookStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRegisteringWebhook(false);
    }
  }

  const base64UserId = typeof window !== "undefined" ? btoa(user.id) : "";
  const startCommand = `/start ${base64UserId}`;

  return (
    <>
      <section
        className="mx-auto w-full max-w-5xl px-5 pb-6 sm:px-6"
        id="email-settings"
      >
        <TerminalPanel className="!p-5 sm:!p-6 border-lime-500/25 bg-black/40">
          <SectionHeader
            description="Choose weekly or monthly reports and set the recipient email for this account."
            eyebrow="Email Report Settings"
            title="Email report preferences"
            tone="lime"
          />
          <Notice className="mt-4" tone="amber">
            Email delivery is currently limited to one verified test address.
            Sending to other emails requires a verified domain.
          </Notice>

          {error ? (
            <Notice className="mt-6" tone="rose">
              {error}
            </Notice>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={savePreferences}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:border-lime-500/30 transition">
                <input
                  className="mt-1 h-5 w-5 accent-cyan-300"
                  type="checkbox"
                  checked={weeklyEnabled}
                  disabled={isLoading || isSaving}
                  onChange={(event) => updateWeeklyEnabled(event.target.checked)}
                />
                <span>
                  <span className="block font-semibold text-white">
                    Weekly report
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">
                    Send me a weekly summary.
                  </span>
                </span>
              </label>

              <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:border-lime-500/30 transition">
                <input
                  className="mt-1 h-5 w-5 accent-cyan-300"
                  type="checkbox"
                  checked={monthlyEnabled}
                  disabled={isLoading || isSaving}
                  onChange={(event) => updateMonthlyEnabled(event.target.checked)}
                />
                <span>
                  <span className="block font-semibold text-white">
                    Monthly report
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">
                    Send me a monthly summary.
                  </span>
                </span>
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-300">
              Recipient email
              <SharpInput
                type="email"
                value={recipientEmail}
                disabled={isLoading || isSaving}
                onChange={(event) => updateRecipientEmail(event.target.value)}
                placeholder={user.email ?? "name@email.com"}
              />
            </label>

            <div className="border-t border-white/10 pt-5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
                Value-Based Budgeting (Life Energy)
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Set your net hourly wage to calculate the &quot;Life Energy&quot; (hours of work) spent on each purchase.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-300">
                  Net Hourly Wage (Rp)
                  <SharpInput
                    type="number"
                    min="0"
                    value={netHourlyWage === 0 ? "" : netHourlyWage}
                    disabled={isLoading || isSaving}
                    onChange={(event) => {
                      const val = event.target.value === "" ? 0 : Number(event.target.value);
                      setNetHourlyWage(val);
                      setMessage("");
                    }}
                    placeholder="Rp 0"
                  />
                </label>

                <div className="border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Wage Calculator Helper
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[0.75rem] font-medium text-slate-400">
                        Monthly Salary
                        <input
                          className="mt-1 w-full border border-white/10 bg-black px-2 py-1 text-xs text-white focus:border-cyan-300 focus:outline-none font-mono"
                          type="number"
                          min="0"
                          value={calcSalary}
                          placeholder="e.g. 8000000"
                          onChange={(e) => setCalcSalary(e.target.value)}
                        />
                      </label>
                      <label className="block text-[0.75rem] font-medium text-slate-400">
                        Hours per Month
                        <input
                          className="mt-1 w-full border border-white/10 bg-black px-2 py-1 text-xs text-white focus:border-cyan-300 focus:outline-none font-mono"
                          type="number"
                          min="1"
                          value={calcHours}
                          placeholder="e.g. 160"
                          onChange={(e) => setCalcHours(e.target.value)}
                        />
                      </label>
                    </div>
                    <SharpButton
                      type="button"
                      className="w-full !py-1 text-xs"
                      onClick={() => {
                        const sal = Number(calcSalary);
                        const hrs = Number(calcHours);
                        if (sal > 0 && hrs > 0) {
                          setNetHourlyWage(Math.round(sal / hrs));
                          setMessage("");
                        }
                      }}
                    >
                      Calculate &amp; Apply
                    </SharpButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
              <SharpButton
                variant="primary"
                type="submit"
                disabled={isLoading || isSaving}
                className="border-lime-500/40 text-lime-200"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </SharpButton>

              {isLoading ? (
                <p className="text-sm text-slate-400">
                  Loading email report settings...
                </p>
              ) : null}
            </div>
          </form>

          {message ? (
            <Notice className="mt-5" tone="lime">
              {message}
            </Notice>
          ) : null}
        </TerminalPanel>
      </section>

      {/* Telegram Integration Console */}
      <section
        className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
        id="telegram-settings"
      >
        <TerminalPanel className="!p-5 sm:!p-6 border-cyan-500/25 bg-black/40">
          <SectionHeader
            description="Configure your Telegram Bot and register webhooks to log expenses and check runway directly from chat."
            eyebrow="Telegram Integration"
            title="Telegram Integration Console"
            tone="cyan"
          />

          {isLocalhost && (
            <Notice className="mt-6" tone="amber">
              Local Testing Notice: Telegram requires a secure HTTPS webhook URL. Since you are running on localhost, Telegram cannot access your local server directly. Please provide a Webhook Tunnel URL (such as an ngrok HTTPS URL) below.
            </Notice>
          )}

          {telegramError ? (
            <Notice className="mt-6" tone="rose">
              {telegramError}
            </Notice>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={saveTelegramSettings}>
            <label className="block text-sm font-medium text-slate-300">
              Telegram Bot Token
              <SharpInput
                type="text"
                value={telegramBotToken}
                disabled={isLoading || isSavingTelegram}
                onChange={(event) => {
                  setTelegramBotToken(event.target.value);
                  setTelegramMessage("");
                }}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Webhook Tunnel URL (NGROK)
              <SharpInput
                type="text"
                value={webhookOverrideUrl}
                disabled={isLoading || isSavingTelegram}
                onChange={(event) => {
                  const val = event.target.value;
                  setWebhookOverrideUrl(val);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(`rumahbudget.webhook_override_url.${user.id}`, val);
                  }
                  setTelegramMessage("");
                }}
                placeholder="https://your-ngrok-subdomain.ngrok-free.app"
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
              <SharpButton
                variant="primary"
                type="submit"
                disabled={isLoading || isSavingTelegram}
                className="border-cyan-500/40 text-cyan-200"
              >
                {isSavingTelegram ? "Saving Token..." : "Save Token"}
              </SharpButton>

              <SharpButton
                type="button"
                variant="ghost"
                disabled={isRegisteringWebhook || !telegramBotToken.trim()}
                onClick={handleRegisterWebhook}
                className="border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10"
              >
                {isRegisteringWebhook ? "Registering..." : "Register Webhook"}
              </SharpButton>
            </div>
          </form>

          {telegramMessage ? (
            <Notice className="mt-5" tone="lime">
              {telegramMessage}
            </Notice>
          ) : null}

          {telegramWebhookStatus ? (
            <Notice
              className="mt-5"
              tone={telegramWebhookStatus.startsWith("Success") ? "lime" : "rose"}
            >
              {telegramWebhookStatus}
            </Notice>
          ) : null}

          <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
              Bot Invitation Helper
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To link your Telegram account, copy the command below and send it to your bot.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/15 bg-white/[0.02] p-4 font-mono text-sm">
              <span className="text-slate-200 break-all select-all">{startCommand}</span>
              <SharpButton
                type="button"
                className="!py-1 !px-3 text-xs border-cyan-500/40 text-cyan-200 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(startCommand);
                  setTelegramMessage("Link command copied to clipboard!");
                }}
              >
                Copy Command
              </SharpButton>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Status:</span>
              {telegramChatId ? (
                <span className="text-lime-300 font-bold uppercase">
                  Connected (Chat ID: {telegramChatId})
                </span>
              ) : (
                <span className="text-rose-400 font-bold uppercase">
                  Disconnected (Waiting for /start command)
                </span>
              )}
            </div>
          </div>
        </TerminalPanel>
      </section>
    </>
  );
}
