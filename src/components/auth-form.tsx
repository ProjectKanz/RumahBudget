"use client";

import {
  SharpButton,
  SharpInput,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import { FormEvent, useState } from "react";

type AuthFormProps = {
  userEmail?: string;
};

function getAuthRequestErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return "Cannot reach Supabase. Check your internet/DNS connection and confirm the Supabase project is active.";
    }

    return error.message;
  }

  return "Authentication request failed. Please try again.";
}

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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setPassword("");
    } catch (error) {
      setMessage(getAuthRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signUp() {
    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setPassword("");
      setMessage("Account created. Check your email if confirmation is required.");
    } catch (error) {
      setMessage(getAuthRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage(error.message);
      }
    } catch (error) {
      setMessage(getAuthRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-8 sm:px-6">
      <TerminalPanel isProminent className="w-full">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
              Secure Cockpit Access
            </p>
            <h2 className="neo-title mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {userEmail ? "Active session" : "Enter RumahBudget"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Sign in to unlock your private financial terminal.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">
            <StatusChip tone="cyan">Secure</StatusChip>
            <StatusChip tone="fuchsia">Synced</StatusChip>
            <StatusChip tone="lime">
              Private
            </StatusChip>
          </div>
        </div>

        <div>
          <p className="sr-only">
            RumahBudget Account
          </p>
        </div>

        {userEmail ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">
              Signed in as:{" "}
              <span className="font-semibold text-white">{userEmail}</span>
            </p>
            <SharpButton
              variant="ghost"
              type="button"
              disabled={isSubmitting}
              onClick={logout}
            >
              Log out
            </SharpButton>
          </div>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={login}>
            <label className="text-sm font-medium text-slate-300">
              Email
              <SharpInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@email.com"
              />
            </label>

            <label className="text-sm font-medium text-slate-300">
              Password
              <SharpInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <SharpButton
                variant="primary"
                type="submit"
                disabled={isSubmitting}
              >
                Log in
              </SharpButton>
              <SharpButton
                className="border-fuchsia-300/25 text-fuchsia-100 hover:border-fuchsia-300/50 hover:bg-fuchsia-300/10"
                type="button"
                disabled={isSubmitting}
                onClick={signUp}
              >
                Sign up
              </SharpButton>
            </div>
          </form>
        )}

        {message ? (
          <p className="mt-5 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            {message}
          </p>
        ) : null}
      </TerminalPanel>
    </section>
  );
}
