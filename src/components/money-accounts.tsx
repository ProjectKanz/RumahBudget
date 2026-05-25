"use client";

import type {
  MoneyAccount,
  MoneyAccountType,
} from "@/src/types/money-account";
import { FormEvent, useMemo, useState } from "react";

const accountTypes: MoneyAccountType[] = [
  "Bank",
  "E-Wallet",
  "Cash",
  "Investment",
  "Other",
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const hiddenBalanceLabel = "••••••";

type MoneyAccountsProps = {
  accounts: MoneyAccount[];
  accountBalances: Record<string, number>;
  isBalanceHidden: boolean;
  error: string;
  isLoading: boolean;
  onAddAccount: (account: {
    accountType: MoneyAccountType;
    initialBalance: number;
    name: string;
  }) => Promise<boolean>;
  onArchiveAccount: (id: string) => void | Promise<void>;
};

export default function MoneyAccounts({
  accounts,
  accountBalances,
  isBalanceHidden,
  error,
  isLoading,
  onAddAccount,
  onArchiveAccount,
}: MoneyAccountsProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<MoneyAccountType>("Bank");
  const [initialBalance, setInitialBalance] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [archivingAccountId, setArchivingAccountId] = useState("");

  const totalCurrentBalance = useMemo(
    () =>
      accounts.reduce(
        (total, account) =>
          total + (accountBalances[account.id] ?? account.initialBalance),
        0,
      ),
    [accountBalances, accounts],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const numericInitialBalance = Number(initialBalance);

    if (!trimmedName) {
      setFormError("Enter an account name.");
      return;
    }

    if (!Number.isFinite(numericInitialBalance)) {
      setFormError("Enter a valid initial balance.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const didSave = await onAddAccount({
      accountType,
      initialBalance: numericInitialBalance,
      name: trimmedName,
    });

    setIsSaving(false);

    if (!didSave) {
      return;
    }

    setName("");
    setAccountType("Bank");
    setInitialBalance("");
  }

  async function archiveAccount(id: string) {
    setArchivingAccountId(id);
    await onArchiveAccount(id);
    setArchivingAccountId("");
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="money-accounts"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Money Accounts
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Track where your money starts
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Add wallets, bank accounts, cash, or investments. Transactions are
            linked to these accounts for balance tracking.
          </p>
        </div>

        <form className="grid gap-5 sm:grid-cols-3" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Account name
            <input
              className={inputClassName}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="BCA, GoPay, Cash"
            />
          </label>

          <label className={labelClassName}>
            Account type
            <select
              className={inputClassName}
              value={accountType}
              onChange={(event) =>
                setAccountType(event.target.value as MoneyAccountType)
              }
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Initial balance
            <input
              className={inputClassName}
              type="number"
              inputMode="numeric"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              placeholder="Rp0"
            />
          </label>

          {formError ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-3">
              {formError}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-3">
              {error}
            </p>
          ) : null}

          <div className="sm:col-span-3">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Account List
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Total balance{" "}
              {isBalanceHidden
                ? hiddenBalanceLabel
                : rupiahFormatter.format(totalCurrentBalance)}
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            {isLoading
              ? "Loading accounts from Supabase..."
              : `${accounts.length} active accounts`}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400 sm:col-span-2">
              Loading money accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400 sm:col-span-2">
              No money accounts yet. Add your first account above.
            </div>
          ) : (
            accounts.map((account) => (
              <article
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-5"
                key={account.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {account.name}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                      {account.accountType}
                    </p>
                    <p className="mt-4 text-2xl font-bold text-emerald-300">
                      {isBalanceHidden
                        ? hiddenBalanceLabel
                        : rupiahFormatter.format(
                            accountBalances[account.id] ??
                              account.initialBalance,
                          )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Current balance
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      Initial balance:{" "}
                      <span className="text-slate-300">
                        {isBalanceHidden
                          ? hiddenBalanceLabel
                          : rupiahFormatter.format(account.initialBalance)}
                      </span>
                    </p>
                  </div>

                  <button
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={archivingAccountId === account.id}
                    onClick={() => archiveAccount(account.id)}
                  >
                    {archivingAccountId === account.id
                      ? "Archiving..."
                      : "Archive"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
