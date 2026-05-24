"use client";

import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { ActiveUser } from "@/src/types/user";
import { useMemo, useState } from "react";

type TransactionFilter = "Semua" | "Pemasukan" | "Pengeluaran";

type CombinedTransaction =
  | {
      id: string;
      owner: ActiveUser;
      createdAt: number;
      type: "Pemasukan";
      amount: number;
      title: string;
      note: string;
    }
  | {
      id: string;
      owner: ActiveUser;
      createdAt: number;
      type: "Pengeluaran";
      amount: number;
      title: string;
      paymentMethod: string;
      note: string;
    };

const filters: TransactionFilter[] = ["Semua", "Pemasukan", "Pengeluaran"];

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type TransactionHistoryProps = {
  activeUser: ActiveUser;
  expenses: Expense[];
  incomes: Income[];
  onDeleteExpense: (id: string) => void;
  onDeleteIncome: (id: string) => void;
};

export default function TransactionHistory({
  activeUser,
  expenses,
  incomes,
  onDeleteExpense,
  onDeleteIncome,
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>("Semua");

  const transactions = useMemo(() => {
    const incomeTransactions: CombinedTransaction[] = incomes.map((income) => ({
      id: income.id,
      owner: income.owner,
      createdAt: income.createdAt ?? 0,
      type: "Pemasukan",
      amount: income.amount,
      title: income.source,
      note: income.note,
    }));

    const expenseTransactions: CombinedTransaction[] = expenses.map(
      (expense) => ({
        id: expense.id,
        owner: expense.owner,
        createdAt: expense.createdAt ?? 0,
        type: "Pengeluaran",
        amount: expense.amount,
        title: expense.category,
        paymentMethod: expense.paymentMethod,
        note: expense.note,
      }),
    );

    return [...incomeTransactions, ...expenseTransactions].sort(
      (firstTransaction, secondTransaction) =>
        secondTransaction.createdAt - firstTransaction.createdAt,
    );
  }, [expenses, incomes]);

  const filteredTransactions = useMemo(
    () =>
      filter === "Semua"
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
              Riwayat Transaksi
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Semua catatan {activeUser}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Gabungan pemasukan dan pengeluaran terbaru.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-full border border-slate-800 bg-slate-950 p-1">
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
              Belum ada transaksi untuk filter ini.
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const isIncome = transaction.type === "Pemasukan";

              return (
                <article
                  className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={`${transaction.type}-${transaction.id}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isIncome
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
                        isIncome ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {rupiahFormatter.format(transaction.amount)}
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {transaction.title}
                      {!isIncome ? ` / ${transaction.paymentMethod}` : ""}
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
                        : onDeleteExpense(transaction.id)
                    }
                  >
                    Hapus
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
