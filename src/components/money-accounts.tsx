"use client";

import {
  EmptyState,
  Notice,
  NumberValue,
  SectionHeader,
  SharpButton,
  SharpInput,
  SharpSelect,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type {
  MoneyAccount,
  MoneyAccountType,
} from "@/src/types/money-account";
import { FormEvent, MouseEvent, CSSProperties, useMemo, useState } from "react";

const accountTypes: MoneyAccountType[] = [
  "Bank",
  "E-Wallet",
  "Cash",
  "Investment",
  "Other",
];

const labelClassName = "text-sm font-medium text-slate-300";

type MoneyAccountsProps = {
  accounts: MoneyAccount[];
  accountBalances: Record<string, number>;
  highlightClassName?: string;
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
  highlightClassName = "",
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
    const account = accounts.find((currentAccount) => currentAccount.id === id);
    const didConfirm = window.confirm(
      `Archive ${account?.name ?? "this money account"}? Existing transactions will stay in your history.`,
    );

    if (!didConfirm) {
      return;
    }

    setArchivingAccountId(id);
    await onArchiveAccount(id);
    setArchivingAccountId("");
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 pt-5 sm:px-6"
      id="money-accounts"
    >
      <TerminalPanel
        className={`!p-5 transition sm:!p-6 ${highlightClassName}`}
      >
        <SectionHeader
          className="mb-5"
          description={
            <>
              Add wallets, bank accounts, cash, or investments. Transactions
              are linked to these accounts for balance tracking.
            </>
          }
          eyebrow="Create Account"
          title="Add the accounts where you keep money"
          tone="cyan"
        />

        <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Account name
            <SharpInput
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="BCA, GoPay, Cash"
            />
          </label>

          <label className={labelClassName}>
            Account type
            <SharpSelect
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
            </SharpSelect>
          </label>

          <label className={labelClassName}>
            Initial balance
            <SharpInput
              type="number"
              inputMode="numeric"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              placeholder="Rp 0"
            />
          </label>

          {formError ? (
            <Notice className="sm:col-span-3" tone="rose">
              {formError}
            </Notice>
          ) : null}

          {error ? (
            <Notice className="sm:col-span-3" tone="rose">
              {error}
            </Notice>
          ) : null}

          <div className="sm:col-span-3">
            <SharpButton
              className="w-full sm:w-auto"
              variant="primary"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Account"}
            </SharpButton>
          </div>
        </form>
      </TerminalPanel>

      <TerminalPanel className="mt-5 !p-5 sm:!p-6">
        <SectionHeader
          action={
            <p className="text-sm text-slate-400">
              {isLoading
                ? "Loading accounts..."
                : `${accounts.length} active accounts`}
            </p>
          }
          description={
            <span>
              Total Account Balance{" "}
              <NumberValue className="font-bold text-cyan-100">
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : formatCurrency(totalCurrentBalance)}
              </NumberValue>
              <span className="mt-2 block">
                Current balance is calculated from initial balance, income,
                expenses, and transfers.
              </span>
            </span>
          }
          eyebrow="Account List"
          title="Balance registry"
          tone="fuchsia"
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {isLoading ? (
            <EmptyState className="sm:col-span-2">
              Loading money accounts...
            </EmptyState>
          ) : accounts.length === 0 ? (
            <EmptyState className="sm:col-span-2">
              No money accounts yet. Add your first account above.
            </EmptyState>
          ) : (
            accounts.map((account) => (
              <MoneyAccountCard
                key={account.id}
                account={account}
                balance={accountBalances[account.id] ?? account.initialBalance}
                isBalanceHidden={isBalanceHidden}
                isArchiving={archivingAccountId === account.id}
                onArchive={() => archiveAccount(account.id)}
              />
            ))
          )}
        </div>
      </TerminalPanel>
    </section>
  );
}

interface MoneyAccountCardProps {
  account: MoneyAccount;
  balance: number;
  isBalanceHidden: boolean;
  isArchiving: boolean;
  onArchive: () => void;
}

function MoneyAccountCard({
  account,
  balance,
  isBalanceHidden,
  isArchiving,
  onArchive,
}: MoneyAccountCardProps) {
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({});

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xc = x - width / 2;
    const yc = y - height / 2;
    
    const maxRotate = 10;
    const rotateX = -(yc / (height / 2)) * maxRotate;
    const rotateY = (xc / (width / 2)) * maxRotate;
    
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.03)`,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)",
    });
  };

  return (
    <article
      className="premium-glass-card card-3d-tilt transition-all duration-200 cursor-pointer p-5"
      style={tiltStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-white">
              {account.name}
            </p>
            <StatusChip className="py-1" tone="neutral">
              {account.accountType}
            </StatusChip>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
            Current balance
          </p>
          <p className="mt-1 text-2xl font-black text-cyan-100">
            <NumberValue>
              {isBalanceHidden
                ? hiddenBalanceLabel
                : formatCurrency(balance)}
            </NumberValue>
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Initial balance (starting amount):{" "}
            <NumberValue className="text-slate-300">
              {isBalanceHidden
                ? hiddenBalanceLabel
                : formatCurrency(account.initialBalance)}
            </NumberValue>
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Includes linked income, expenses, and transfers.
          </p>
        </div>

        <SharpButton
          className="min-h-10 px-3 py-2"
          type="button"
          disabled={isArchiving}
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
        >
          {isArchiving ? "Archiving..." : "Archive"}
        </SharpButton>
      </div>
    </article>
  );
}
