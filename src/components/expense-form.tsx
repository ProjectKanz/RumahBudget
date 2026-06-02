"use client";

import {
  Notice,
  SharpButton,
  SharpInput,
  SharpSelect,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
import { FormEvent, useState } from "react";

const categories = [
  { label: "Groceries", value: "Groceries" },
  { label: "Transportation", value: "Transportation" },
  { label: "Bills", value: "Bills" },
  { label: "Education", value: "Education" },
  { label: "Health", value: "Health" },
  { label: "Other", value: "Other" },
];

const paymentMethods = [
  { label: "Cash", value: "Cash" },
  { label: "Debit Card", value: "Debit Card" },
  { label: "E-Wallet", value: "E-Wallet" },
  { label: "Bank Transfer", value: "Bank Transfer" },
];

const labelClassName = "text-sm font-medium text-slate-300";

type ExpenseFormProps = {
  accountLabel: string;
  isEmbedded?: boolean;
  moneyAccounts: MoneyAccount[];
  onAddExpense: (expense: Expense) => Promise<boolean>;
  supabaseError: string;
  netHourlyWage?: number;
};

export default function ExpenseForm({
  accountLabel,
  isEmbedded = false,
  moneyAccounts,
  onAddExpense,
  supabaseError,
  netHourlyWage = 0,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].value);
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

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    if (!selectedAccountId) {
      setError("Create a money account first before adding income or expenses.");
      return;
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      owner: accountLabel,
      userId: "",
      accountId: selectedAccountId,
      createdAt: Date.now(),
      amount: numericAmount,
      category,
      paymentMethod,
      note: note.trim(),
    };

    let didSave = false;

    try {
      setIsSaving(true);
      didSave = await onAddExpense(expense);
    } catch {
      didSave = false;
    } finally {
      setIsSaving(false);
    }

    if (!didSave) {
      return;
    }

    setAmount("");
    setNote("");
    setError("");
  }

  const content = (
    <>
      <div className="mb-5 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-pink-300">
          Add Expense
        </p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-white">
          Record an expense
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
            name="amount"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Rp 0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          {netHourlyWage > 0 && Number(amount) > 0 && (
            <span className="mt-1 block text-xs font-mono text-cyan-300">
              Equivalent Life Energy: {(Number(amount) / netHourlyWage).toFixed(1)} hours of work
            </span>
          )}
        </label>

        <label className={labelClassName}>
          From Account
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
          Category
          <SharpSelect
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={labelClassName}>
          Payment Method
          <SharpSelect
            name="paymentMethod"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            {paymentMethods.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={`${labelClassName} sm:col-span-2`}>
          Note
          <SharpInput
            name="note"
            type="text"
            placeholder="Example: weekly grocery shopping"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
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
            className="w-full border-fuchsia-300/40 bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200 sm:w-auto"
            type="submit"
            disabled={isSaving || moneyAccounts.length === 0}
          >
            {isSaving ? "Saving..." : "Save Expense"}
          </SharpButton>
        </div>
      </form>
    </>
  );

  if (isEmbedded) {
    return <div id="expense-form">{content}</div>;
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 sm:px-6"
      id="expense-form"
    >
      <TerminalPanel className="!p-5 sm:!p-6">
        {content}
      </TerminalPanel>
    </section>
  );
}
