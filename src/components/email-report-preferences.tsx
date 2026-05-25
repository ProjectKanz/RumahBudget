"use client";

import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useState } from "react";

type EmailReportPreferencesProps = {
  user: User;
};

type ReportPreferenceRow = {
  weekly_enabled?: boolean | null;
  monthly_enabled?: boolean | null;
  recipient_email?: string | null;
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
}: EmailReportPreferencesProps) {
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(user.email ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

      try {
        const { data, error: loadError } = await supabase
          .from("report_preferences")
          .select("weekly_enabled, monthly_enabled, recipient_email")
          .eq("user_id", user.id)
          .abortSignal(timeout.signal)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (loadError) {
          setError(loadError.message);
          return;
        }

        const preferences = data as ReportPreferenceRow | null;

        setWeeklyEnabled(Boolean(preferences?.weekly_enabled));
        setMonthlyEnabled(Boolean(preferences?.monthly_enabled));
        setRecipientEmail(preferences?.recipient_email ?? user.email ?? "");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          getSupabaseErrorMessage(
            loadError,
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
  }, [user.email, user.id]);

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

    try {
      const { error: saveError } = await supabase
        .from("report_preferences")
        .upsert(
          {
            user_id: user.id,
            weekly_enabled: weeklyEnabled,
            monthly_enabled: monthlyEnabled,
            recipient_email: recipientEmail.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .abortSignal(timeout.signal);

      if (saveError) {
        setError(saveError.message);
        return;
      }

      setRecipientEmail(recipientEmail.trim());
      setMessage("Email report settings saved.");
    } catch (saveError) {
      setError(
        getSupabaseErrorMessage(
          saveError,
          "Failed to save email report settings.",
        ),
      );
    } finally {
      timeout.clear();
      setIsSaving(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
      id="email-settings"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Email Report Settings
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Email report preferences
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Choose weekly or monthly reports and set the recipient email for
            this account.
          </p>
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
            Email delivery is currently limited to one verified test address.
            Sending to other emails requires a verified domain.
          </p>
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <form className="mt-6 space-y-5" onSubmit={savePreferences}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <input
                className="mt-1 h-5 w-5 accent-emerald-400"
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

            <label className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <input
                className="mt-1 h-5 w-5 accent-emerald-400"
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
            <input
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              type="email"
              value={recipientEmail}
              disabled={isLoading || isSaving}
              onChange={(event) => updateRecipientEmail(event.target.value)}
              placeholder={user.email ?? "name@email.com"}
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center">
            <button
              className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isLoading || isSaving}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>

            {isLoading ? (
              <p className="text-sm text-slate-400">
                Loading email report settings...
              </p>
            ) : null}
          </div>
        </form>

        {message ? (
          <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
