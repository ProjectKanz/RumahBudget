"use client";

import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import { FormEvent, useState } from "react";

type IncomeFormProps = {
  accountLabel: string;
  isEmbedded?: boolean;
  moneyAccounts: MoneyAccount[];
  onAddIncome: (income: Income) => Promise<boolean>;
  supabaseError: string;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

export default function IncomeForm({
  accountLabel,
  isEmbedded = false,
  moneyAccounts,
  onAddIncome,
  supabaseError,
}: IncomeFormProps) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedAccountId = moneyAccounts.some(
    (account) => account.id === accountId,
  )
    ? accountId
    : (moneyAccounts[0]?.id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const trimmedSource = source.trim();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an income amount greater than 0.");
      return;
    }

    if (!trimmedSource) {
      setError("Enter an income source.");
      return;
    }

    if (!selectedAccountId) {
      setError("Create a money account first before adding income or expenses.");
      return;
    }

    const income: Income = {
      id: crypto.randomUUID(),
      owner: accountLabel,
      userId: "",
      accountId: selectedAccountId,
      createdAt: Date.now(),
      amount: numericAmount,
      source: trimmedSource,
      note: note.trim(),
    };

    let didSave = false;

    try {
      setIsSaving(true);
      didSave = await onAddIncome(income);
    } catch {
      didSave = false;
    } finally {
      setIsSaving(false);
    }

    if (!didSave) {
      return;
    }

    setAmount("");
    setSource("");
    setNote("");
    setError("");
  }

  const content = (
    <>
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Add Income
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Record income
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Saved to your private account.
          </p>
          {moneyAccounts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              Create a money account first before adding income or expenses.
            </p>
          ) : null}
        </div>

        <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Amount
            <input
              className={inputClassName}
              name="incomeAmount"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Rp 0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className={labelClassName}>
            To Account
            <select
              className={inputClassName}
              value={selectedAccountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={moneyAccounts.length === 0}
            >
              {moneyAccounts.length === 0 ? (
                <option value="">Create an account first</option>
              ) : (
                moneyAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={labelClassName}>
            Source
            <input
              className={inputClassName}
              name="source"
              type="text"
              placeholder="Example: salary, bonus, business"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </label>

          <label className={`${labelClassName} sm:col-span-2`}>
            Note
            <input
              className={inputClassName}
              name="incomeNote"
              type="text"
              placeholder="Optional note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              {error}
            </p>
          ) : null}

          {supabaseError ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              {supabaseError}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={isSaving || moneyAccounts.length === 0}
            >
              {isSaving ? "Saving..." : "Save Income"}
            </button>
          </div>
        </form>
    </>
  );

  if (isEmbedded) {
    return <div id="income-form">{content}</div>;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
      id="income-form"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        {content}
      </div>
    </section>
  );
}
