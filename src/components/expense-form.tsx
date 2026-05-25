"use client";

import { formatCurrency } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
import { FormEvent, useMemo, useState } from "react";

const categories = [
  { label: "Groceries", value: "Belanja Dapur" },
  { label: "Transportation", value: "Transportasi" },
  { label: "Bills", value: "Tagihan" },
  { label: "Education", value: "Pendidikan" },
  { label: "Health", value: "Kesehatan" },
  { label: "Other", value: "Lainnya" },
];

const paymentMethods = [
  { label: "Cash", value: "Tunai" },
  { label: "Debit Card", value: "Kartu Debit" },
  { label: "E-Wallet", value: "E-Wallet" },
  { label: "Bank Transfer", value: "Transfer Bank" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

const categoryLabels = new Map(
  categories.map((category) => [category.value, category.label]),
);
const paymentMethodLabels = new Map(
  paymentMethods.map((paymentMethod) => [
    paymentMethod.value,
    paymentMethod.label,
  ]),
);

type ExpenseFormProps = {
  accountLabel: string;
  moneyAccounts: MoneyAccount[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => Promise<boolean>;
  onDeleteExpense: (id: string) => void;
  supabaseError: string;
  isLoadingExpenses: boolean;
};

export default function ExpenseForm({
  accountLabel,
  moneyAccounts,
  expenses,
  onAddExpense,
  onDeleteExpense,
  supabaseError,
  isLoadingExpenses,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].value);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const totalExpense = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses],
  );
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

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="expense-form"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Add Expense
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Add a personal transaction
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Saved for {accountLabel} and included in your private account totals.
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
              name="amount"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Rp 0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className={labelClassName}>
            From Account
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
            Category
            <select
              className={inputClassName}
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Payment Method
            <select
              className={inputClassName}
              name="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {paymentMethods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClassName} sm:col-span-2`}>
            Note
            <input
              className={inputClassName}
              name="note"
              type="text"
              placeholder="Example: weekly grocery shopping"
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
              {isSaving ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Expense History
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Total {formatCurrency(totalExpense)}
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            {isLoadingExpenses
              ? "Loading data from Supabase..."
              : `${expenses.length} saved transactions`}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {isLoadingExpenses ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              Loading expenses from Supabase...
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              No expenses yet. Add your first transaction from the form above.
            </div>
          ) : (
            expenses.map((expense) => (
              <article
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={expense.id}
              >
                <div>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(expense.amount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {categoryLabels.get(expense.category) ?? expense.category} /{" "}
                    {paymentMethodLabels.get(expense.paymentMethod) ??
                      expense.paymentMethod}
                  </p>
                  {expense.note ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {expense.note}
                    </p>
                  ) : null}
                </div>

                <button
                  className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/10"
                  type="button"
                  onClick={() => onDeleteExpense(expense.id)}
                >
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
