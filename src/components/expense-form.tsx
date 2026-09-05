"use client";

import {
  Notice,
  SharpButton,
  SharpInput,
  SharpSelect,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import type { BudgetLine } from "@/src/types/budget-line";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
import {
  EXPENSE_CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/src/lib/expense-options";
import { calculateLifeEnergyHours } from "@/src/lib/life-energy";
import {
  localDateInputToTimestamp,
  toLocalDateInputValue,
} from "@/src/lib/transaction-entry";
import { FormEvent, useState } from "react";

const labelClassName = "text-sm font-medium text-slate-300";

/** Empty string is the form value for "not classified"; it saves as null. */
const UNCATEGORIZED_BUDGET_LINE_VALUE = "";

type ExpenseFormProps = {
  accountLabel: string;
  /** Active spending lines only. Empty when they fail to load, which must
   *  still leave the form fully usable. */
  budgetLines?: BudgetLine[];
  isEmbedded?: boolean;
  moneyAccounts: MoneyAccount[];
  onAddExpense: (expense: Expense) => Promise<boolean>;
  supabaseError: string;
  netHourlyWage?: number;
};

export default function ExpenseForm({
  accountLabel,
  budgetLines = [],
  isEmbedded = false,
  moneyAccounts,
  onAddExpense,
  supabaseError,
  netHourlyWage = 0,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState<string>(
    EXPENSE_CATEGORY_OPTIONS[0].value,
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PAYMENT_METHOD_OPTIONS[0].value,
  );
  const [description, setDescription] = useState("");
  const [budgetLineId, setBudgetLineId] = useState(
    UNCATEGORIZED_BUDGET_LINE_VALUE,
  );
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
  const lifeEnergyHours = calculateLifeEnergyHours(amount, netHourlyWage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const transactionTimestamp = localDateInputToTimestamp(transactionDate);
    const trimmedDescription = description.trim();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    if (!transactionTimestamp) {
      setError("Choose a valid transaction date.");
      return;
    }

    if (!trimmedDescription) {
      setError("Enter a merchant or transaction description.");
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
      budgetLineId: budgetLineId || undefined,
      createdAt: transactionTimestamp,
      description: trimmedDescription,
      transactionDate,
      affectsDailyAllowance,
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
    setDescription("");
    setBudgetLineId(UNCATEGORIZED_BUDGET_LINE_VALUE);
    setNote("");
    setAffectsDailyAllowance(true);
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
          {lifeEnergyHours !== null ? (
            <span className="mt-1 block text-xs font-mono text-cyan-300">
              Equivalent Life Energy: {lifeEnergyHours.toFixed(1)} hours of work
            </span>
          ) : null}
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
          Transaction Date
          <SharpInput
            max={toLocalDateInputValue()}
            name="transactionDate"
            required
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
          />
        </label>

        <label className={labelClassName}>
          Category
          <SharpSelect
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {EXPENSE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={labelClassName}>
          Budget Line
          <SharpSelect
            name="budgetLine"
            value={budgetLineId}
            onChange={(event) => setBudgetLineId(event.target.value)}
          >
            <option value={UNCATEGORIZED_BUDGET_LINE_VALUE}>
              Uncategorized
            </option>
            {budgetLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
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
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SharpSelect>
        </label>

        <label className={`${labelClassName} sm:col-span-2`}>
          Merchant / Description
          <SharpInput
            maxLength={120}
            name="description"
            placeholder="Example: Indomaret, Gojek, Netflix"
            required
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className={`${labelClassName} sm:col-span-2`}>
          Additional Note (Optional)
          <SharpInput
            maxLength={240}
            name="note"
            type="text"
            placeholder="Example: weekly groceries and cleaning supplies"
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
            <span className="block font-bold">Hitung sebagai pemakaian harian</span>
            <span className="block text-xs text-slate-400">
              Matikan untuk pengeluaran besar yang tidak ingin mengurangi sisa hari ini.
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
