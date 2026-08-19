"use client";

import {
  Notice,
  SharpButton,
  SharpInput,
  SharpSelect,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import type { MoneyAccount } from "@/src/types/money-account";
import { FormEvent, useMemo, useState } from "react";

const labelClassName = "text-sm font-medium text-slate-300";

type TransferMoneyProps = {
  accountBalances: Record<string, number>;
  accounts: MoneyAccount[];
  error: string;
  isEmbedded?: boolean;
  onAddTransfer: (transfer: {
    affectsDailyAllowance: boolean;
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
  const [affectsDailyAllowance, setAffectsDailyAllowance] = useState(true);
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
      affectsDailyAllowance,
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
    setAffectsDailyAllowance(true);
  }

  const content = (
    <>
      <div className="mb-5 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
          Transfer Money
        </p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-white">
          Move money between accounts
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Transfers move balance between your own money accounts without
          changing income or expense totals.
        </p>
        {!hasEnoughAccounts ? (
          <Notice className="mt-4" tone="amber">
            Create at least two money accounts before transferring.
          </Notice>
        ) : null}
      </div>

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className={labelClassName}>
          From Account
          <SharpSelect
            value={selectedFromAccountId}
            disabled={!hasEnoughAccounts}
            onChange={(event) => setFromAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={labelClassName}>
          To Account
          <SharpSelect
            value={selectedToAccountId}
            disabled={!hasEnoughAccounts}
            onChange={(event) => setToAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={labelClassName}>
          Amount
          <SharpInput
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
          <SharpInput
            type="text"
            value={note}
            disabled={!hasEnoughAccounts}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 border border-white/10 px-3 py-2 text-sm text-slate-200 sm:col-span-2">
          <input
            checked={affectsDailyAllowance}
            disabled={!hasEnoughAccounts}
            type="checkbox"
            onChange={(event) => setAffectsDailyAllowance(event.target.checked)}
          />
          <span>
            <span className="block font-bold">Masukkan perubahan saldo ke jatah mulai hari ini</span>
            <span className="block text-xs text-slate-400">
              Transfer antara dua akun kebutuhan hidup tetap netral.
            </span>
          </span>
        </label>

        {formError ? (
          <Notice className="sm:col-span-2" tone="rose">
            {formError}
          </Notice>
        ) : null}

        {error ? (
          <Notice className="sm:col-span-2" tone="rose">
            {error}
          </Notice>
        ) : null}

        <div className="sm:col-span-2">
          <SharpButton
            className="w-full sm:w-auto"
            variant="primary"
            type="submit"
            disabled={isSaving || !hasEnoughAccounts}
          >
            {isSaving ? "Saving..." : "Save Transfer"}
          </SharpButton>
        </div>
      </form>
    </>
  );

  if (isEmbedded) {
    return <div id="transfer-money">{content}</div>;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 sm:px-6"
      id="transfer-money"
    >
      <TerminalPanel className="!p-5 sm:!p-6">
        {content}
      </TerminalPanel>
    </section>
  );
}
