"use client";

import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import { FormEvent, useState } from "react";

type AuthFormProps = {
  userEmail?: string;
};

export default function AuthForm({ userEmail }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
  }

  async function signUp() {
    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setMessage("Account created. Check your email if Supabase requires confirmation.");
  }

  async function logout() {
    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await supabase.auth.signOut();

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            RumahBudget Account
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
            {userEmail ? "Active session" : "Log in or sign up"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in so your financial data stays private.
          </p>
        </div>

        {userEmail ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">
              Logged in as <span className="font-semibold">{userEmail}</span>
            </p>
            <button
              className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={isSubmitting}
              onClick={logout}
            >
              Log out
            </button>
          </div>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={login}>
            <label className="text-sm font-medium text-slate-300">
              Email
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
              />
            </label>

            <label className="text-sm font-medium text-slate-300">
              Password
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <button
                className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                Log in
              </button>
              <button
                className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isSubmitting}
                onClick={signUp}
              >
                Sign up
              </button>
              <button
                className="rounded-full border border-slate-800 px-6 py-3 font-semibold text-slate-500"
                type="button"
                disabled
              >
                Log out
              </button>
            </div>
          </form>
        )}

        {message ? (
          <p className="mt-5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
