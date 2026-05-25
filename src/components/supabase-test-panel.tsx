"use client";

import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import { useState } from "react";

type ConnectionStatus = {
  tone: "idle" | "success" | "error";
  message: string;
};

export default function SupabaseTestPanel() {
  const [status, setStatus] = useState<ConnectionStatus>({
    tone: "idle",
    message: "Not tested yet.",
  });
  const [isTesting, setIsTesting] = useState(false);

  async function testConnection() {
    setIsTesting(true);
    setStatus({
      tone: "idle",
      message: "Connecting to Supabase...",
    });

    if (!supabase) {
      setStatus({
        tone: "error",
        message: missingSupabaseEnvMessage,
      });
      setIsTesting(false);
      return;
    }

    const { error } = await supabase.from("expenses").select("*").limit(1);

    if (error) {
      setStatus({
        tone: "error",
        message: error.message,
      });
      setIsTesting(false);
      return;
    }

    setStatus({
      tone: "success",
      message: "Connected to Supabase",
    });
    setIsTesting(false);
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Supabase
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Database Connection Test
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This only checks the database connection. Transactions are saved
              through Supabase after login.
            </p>
          </div>

          <button
            className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isTesting}
            onClick={testConnection}
          >
            {isTesting ? "Testing..." : "Test Supabase Connection"}
          </button>
        </div>

        <p
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : status.tone === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-slate-700 bg-slate-950 text-slate-300"
          }`}
        >
          {status.message}
        </p>
      </div>
    </section>
  );
}
