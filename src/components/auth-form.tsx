"use client";

import {
  SharpButton,
  SharpInput,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import Image from "next/image";
import { FormEvent, useState } from "react";

type AuthFormProps = {
  userEmail?: string;
};

function getAuthRequestErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return "RumahBudget tidak dapat menjangkau layanan akun. Periksa koneksi internet dan status proyek Supabase.";
    }

    return error.message;
  }

  return "Permintaan akun gagal. Silakan coba lagi.";
}

function validateCredentials(email: string, password: string) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return "Masukkan alamat email terlebih dahulu.";
  }

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return "Masukkan alamat email yang valid.";
  }

  if (!password) {
    return "Masukkan kata sandi terlebih dahulu.";
  }

  if (password.length < 6) {
    return "Kata sandi minimal 6 karakter.";
  }

  return "";
}

export default function AuthForm({ userEmail }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateCredentials(email, password);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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
    const validationMessage = validateCredentials(email, password);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (!supabase) {
      setMessage(missingSupabaseEnvMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setPassword("");
      setMessage("Akun dibuat. Periksa email jika konfirmasi diperlukan.");
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
    <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-8 sm:px-6">
      <TerminalPanel isProminent className="w-full">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div className="flex items-start gap-4">
            <Image
              alt=""
              aria-hidden="true"
              className="rb-auth-mark"
              height={64}
              src="/assets/rumahbudget/pixel-house.png"
              width={64}
            />
            <div>
            <p className="ledger-eyebrow">
              Ledger privat rumah tangga
            </p>
            <h2 className="neo-title mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              {userEmail ? "Sesi aktif" : "Masuk ke RumahBudget"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Kelola saldo, transaksi, arus kas, dan laporan dalam satu ruang.
            </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">
            <StatusChip tone="cyan">Saldo</StatusChip>
            <StatusChip tone="fuchsia">Arus kas</StatusChip>
            <StatusChip tone="lime">Laporan</StatusChip>
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
              Masuk sebagai:{" "}
              <span className="font-semibold text-white">{userEmail}</span>
            </p>
            <SharpButton
              variant="ghost"
              type="button"
              disabled={isSubmitting}
              onClick={logout}
            >
              Keluar
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
              Kata sandi
              <SharpInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 6 karakter"
              />
            </label>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <SharpButton
                variant="primary"
                type="submit"
                disabled={isSubmitting}
              >
                Masuk
              </SharpButton>
              <SharpButton
                className="border-fuchsia-300/25 text-fuchsia-100 hover:border-fuchsia-300/50 hover:bg-fuchsia-300/10"
                type="button"
                disabled={isSubmitting}
                onClick={signUp}
              >
                Buat akun
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
