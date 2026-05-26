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
      <TerminalPanel className="!p-5 sm:!p-6">
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
            <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4">
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

            <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4">
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

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
            <SharpButton
              variant="primary"
              type="submit"
              disabled={isLoading || isSaving}
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
  );
}
