"use client";

import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";
import type { ActiveUser } from "@/src/types/user";
import { useMemo, useState } from "react";

type TransactionFilter = "All" | "Income" | "Expenses" | "Transfers";

type CombinedTransaction =
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Income";
      amount: number;
      accountName: string;
      title: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Expenses";
      amount: number;
      accountName: string;
      title: string;
      paymentMethod: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Transfers";
      amount: number;
      fromAccountName: string;
      toAccountName: string;
      title: string;
      note: string;
    };

const filters: TransactionFilter[] = ["All", "Income", "Expenses", "Transfers"];
const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);
const paymentMethodLabels = new Map([
  ["Tunai", "Cash"],
  ["Kartu Debit", "Debit Card"],
  ["E-Wallet", "E-Wallet"],
  ["Transfer Bank", "Bank Transfer"],
]);

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type TransactionHistoryProps = {
  activeUser: ActiveUser;
  moneyAccounts: MoneyAccount[];
  expenses: Expense[];
  incomes: Income[];
  transfers: Transfer[];
  onDeleteExpense: (id: string) => void | Promise<void>;
  onDeleteIncome: (id: string) => void | Promise<void>;
  onDeleteTransfer: (id: string) => void | Promise<void>;
};

export default function TransactionHistory({
  activeUser,
  moneyAccounts,
  expenses,
  incomes,
  transfers,
  onDeleteExpense,
  onDeleteIncome,
  onDeleteTransfer,
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>("All");

  const transactions = useMemo(() => {
    const accountNames = new Map(
      moneyAccounts.map((account) => [account.id, account.name]),
    );
    const incomeTransactions: CombinedTransaction[] = incomes.map((income) => ({
      id: income.id,
      owner: income.owner,
      createdAt: income.createdAt ?? 0,
      type: "Income",
      amount: income.amount,
      accountName: accountNames.get(income.accountId) ?? "Unassigned",
      title: income.source,
      note: income.note,
    }));

    const expenseTransactions: CombinedTransaction[] = expenses.map(
      (expense) => ({
        id: expense.id,
        owner: expense.owner,
        createdAt: expense.createdAt ?? 0,
        type: "Expenses",
        amount: expense.amount,
        accountName: accountNames.get(expense.accountId) ?? "Unassigned",
        title: categoryLabels.get(expense.category) ?? expense.category,
        paymentMethod: expense.paymentMethod,
        note: expense.note,
      }),
    );
    const transferTransactions: CombinedTransaction[] = transfers.map(
      (transfer) => {
        const fromAccountName =
          accountNames.get(transfer.fromAccountId) ?? "Unassigned";
        const toAccountName =
          accountNames.get(transfer.toAccountId) ?? "Unassigned";

        return {
          id: transfer.id,
          owner: transfer.userId,
          createdAt: transfer.createdAt ?? 0,
          type: "Transfers",
          amount: transfer.amount,
          fromAccountName,
          toAccountName,
          title: `${fromAccountName} to ${toAccountName}`,
          note: transfer.note,
        };
      },
    );

    return [
      ...incomeTransactions,
      ...expenseTransactions,
      ...transferTransactions,
    ].sort(
      (firstTransaction, secondTransaction) =>
        secondTransaction.createdAt - firstTransaction.createdAt,
    );
  }, [expenses, incomes, moneyAccounts, transfers]);

  const filteredTransactions = useMemo(
    () =>
      filter === "All"
        ? transactions
        : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions],
  );

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="transaction-history"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="flex flex-col gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Transaction History
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              All records for {activeUser}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Recent income and expense records in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1 sm:grid-cols-4 sm:rounded-full">
            {filters.map((option) => (
              <button
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  filter === option
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
                key={option}
                type="button"
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              No transactions for this filter yet.
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const isIncome = transaction.type === "Income";
              const isTransfer = transaction.type === "Transfers";

              return (
                <article
                  className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    isTransfer
                      ? "border-sky-400/30 bg-sky-400/10"
                      : "border-slate-800 bg-slate-950/70"
                  }`}
                  key={`${transaction.type}-${transaction.id}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isTransfer
                            ? "bg-sky-400/15 text-sky-300"
                            : isIncome
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-red-400/15 text-red-300"
                        }`}
                      >
                        {transaction.type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {transaction.owner}
                      </span>
                    </div>

                    <p
                      className={`mt-3 text-xl font-bold ${
                        isTransfer
                          ? "text-sky-300"
                          : isIncome
                            ? "text-emerald-300"
                            : "text-red-300"
                      }`}
                    >
                      {isTransfer ? "" : isIncome ? "+" : "-"}
                      {rupiahFormatter.format(transaction.amount)}
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {transaction.title}
                      {!isIncome && !isTransfer
                        ? ` / ${
                            paymentMethodLabels.get(transaction.paymentMethod) ??
                            transaction.paymentMethod
                          }`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isTransfer
                        ? `Transfer: ${transaction.fromAccountName} to ${transaction.toAccountName}`
                        : `Account: ${transaction.accountName}`}
                    </p>

                    {transaction.note ? (
                      <p className="mt-2 text-sm text-slate-500">
                        {transaction.note}
                      </p>
                    ) : null}
                  </div>

                  <button
                    className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/10"
                    type="button"
                    onClick={() =>
                      isIncome
                        ? onDeleteIncome(transaction.id)
                        : isTransfer
                          ? onDeleteTransfer(transaction.id)
                        : onDeleteExpense(transaction.id)
                    }
                  >
                    Delete
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
