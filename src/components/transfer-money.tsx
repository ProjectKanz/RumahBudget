"use client";

import type { MoneyAccount } from "@/src/types/money-account";
import { FormEvent, useMemo, useState } from "react";

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60";

const labelClassName = "text-sm font-medium text-slate-300";

type TransferMoneyProps = {
  accountBalances: Record<string, number>;
  accounts: MoneyAccount[];
  error: string;
  isEmbedded?: boolean;
  onAddTransfer: (transfer: {
    amount: number;
    fromAccountId: string;
    note: string;
    toAccountId: string;
  }) => Promise<boolean>;
};

export default function TransferMoney({
  accountBalances,
  accounts,
  error,
  isEmbedded = false,
  onAddTransfer,
}: TransferMoneyProps) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasEnoughAccounts = accounts.length >= 2;

  const selectedFromAccountId = useMemo(
    () =>
      accounts.some((account) => account.id === fromAccountId)
        ? fromAccountId
        : (accounts[0]?.id ?? ""),
    [accounts, fromAccountId],
  );
  const selectedToAccountId = useMemo(() => {
    if (accounts.some((account) => account.id === toAccountId)) {
      return toAccountId;
    }

    return (
      accounts.find((account) => account.id !== selectedFromAccountId)?.id ?? ""
    );
  }, [accounts, selectedFromAccountId, toAccountId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!hasEnoughAccounts) {
      setFormError("Create at least two money accounts before transferring.");
      return;
    }

    if (selectedFromAccountId === selectedToAccountId) {
      setFormError("Choose two different accounts.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter a transfer amount greater than 0.");
      return;
    }

    const fromAccount = accounts.find(
      (account) => account.id === selectedFromAccountId,
    );
    const fromAccountBalance = fromAccount
      ? (accountBalances[fromAccount.id] ?? fromAccount.initialBalance)
      : 0;

    if (numericAmount > fromAccountBalance) {
      setFormError("Transfer amount cannot exceed the From Account balance.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const didSave = await onAddTransfer({
      amount: numericAmount,
      fromAccountId: selectedFromAccountId,
      note: note.trim(),
      toAccountId: selectedToAccountId,
    });

    setIsSaving(false);

    if (!didSave) {
      return;
    }

    setAmount("");
    setNote("");
  }

  const content = (
    <>
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Transfer Money
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Move money between accounts
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Transfers move balance between your own money accounts without
            changing income or expense totals.
          </p>
          {!hasEnoughAccounts ? (
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              Create at least two money accounts before transferring.
            </p>
          ) : null}
        </div>

        <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            From Account
            <select
              className={inputClassName}
              value={selectedFromAccountId}
              disabled={!hasEnoughAccounts}
              onChange={(event) => setFromAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            To Account
            <select
              className={inputClassName}
              value={selectedToAccountId}
              disabled={!hasEnoughAccounts}
              onChange={(event) => setToAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Amount
            <input
              className={inputClassName}
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              disabled={!hasEnoughAccounts}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Rp 0"
            />
          </label>

          <label className={labelClassName}>
            Note
            <input
              className={inputClassName}
              type="text"
              value={note}
              disabled={!hasEnoughAccounts}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
            />
          </label>

          {formError ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              {formError}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              {error}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={isSaving || !hasEnoughAccounts}
            >
              {isSaving ? "Saving..." : "Save Transfer"}
            </button>
          </div>
        </form>
    </>
  );

  if (isEmbedded) {
    return <div id="transfer-money">{content}</div>;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
      id="transfer-money"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        {content}
      </div>
    </section>
  );
}
