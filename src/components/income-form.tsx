"use client";

import {
  Notice,
  SharpButton,
  SharpInput,
  SharpSelect,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import {
  localDateInputToTimestamp,
  toLocalDateInputValue,
} from "@/src/lib/transaction-entry";
import { FormEvent, useState } from "react";

type IncomeFormProps = {
  accountLabel: string;
  isEmbedded?: boolean;
  moneyAccounts: MoneyAccount[];
  onAddIncome: (income: Income) => Promise<boolean>;
  supabaseError: string;
};

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
  const [affectsDailyAllowance, setAffectsDailyAllowance] = useState(true);
  const [transactionDate, setTransactionDate] = useState(() =>
    toLocalDateInputValue(),
  );
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
    const transactionTimestamp = localDateInputToTimestamp(transactionDate);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an income amount greater than 0.");
      return;
    }

    if (!transactionTimestamp) {
      setError("Choose a valid transaction date.");
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
      createdAt: transactionTimestamp,
      transactionDate,
      affectsDailyAllowance,
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
    setAffectsDailyAllowance(true);
    setError("");
  }

  const content = (
    <>
      <div className="mb-5 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-lime-300">
          Add Income
        </p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-white">
          Record income
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Saved to your private account.
        </p>
        {moneyAccounts.length === 0 ? (
          <Notice className="mt-4" tone="amber">
            Create a money account first before adding income or expenses.
          </Notice>
        ) : null}
      </div>

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className={labelClassName}>
          Amount
          <SharpInput
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
          <SharpSelect
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
          </SharpSelect>
        </label>

        <label className={labelClassName}>
          Transaction Date
          <SharpInput
            max={toLocalDateInputValue()}
            name="incomeTransactionDate"
            required
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
          />
        </label>

        <label className={labelClassName}>
          Source / Description
          <SharpInput
            maxLength={120}
            name="source"
            type="text"
            placeholder="Example: salary, bonus, business"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
        </label>

        <label className={`${labelClassName} sm:col-span-2`}>
          Note
          <SharpInput
            name="incomeNote"
            type="text"
            placeholder="Optional note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 border border-white/10 px-3 py-2 text-sm text-slate-200 sm:col-span-2">
          <input
            checked={affectsDailyAllowance}
            type="checkbox"
            onChange={(event) => setAffectsDailyAllowance(event.target.checked)}
          />
          <span>
            <span className="block font-bold">Masukkan ke perhitungan jatah mulai hari ini</span>
            <span className="block text-xs text-slate-400">
              Jika dimatikan, pemasukan baru memengaruhi pembagian mulai besok.
            </span>
          </span>
        </label>

        {error ? (
          <Notice className="sm:col-span-2" tone="rose">
            {error}
          </Notice>
        ) : null}

        {supabaseError ? (
          <Notice className="sm:col-span-2" tone="rose">
            {supabaseError}
          </Notice>
        ) : null}

        <div className="sm:col-span-2">
          <SharpButton
            className="w-full sm:w-auto"
            variant="primary"
            type="submit"
            disabled={isSaving || moneyAccounts.length === 0}
          >
            {isSaving ? "Saving..." : "Save Income"}
          </SharpButton>
        </div>
      </form>
    </>
  );

  if (isEmbedded) {
    return <div id="income-form">{content}</div>;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 sm:px-6"
      id="income-form"
    >
      <TerminalPanel className="!p-5 sm:!p-6">
        {content}
      </TerminalPanel>
    </section>
  );
}
