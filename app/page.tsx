"use client";

import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import { useMemo, useState } from "react";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  const totalExpense = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses],
  );

  const totalIncome = useMemo(
    () => incomes.reduce((total, income) => total + income.amount, 0),
    [incomes],
  );

  const remainingBalance = totalIncome - totalExpense;

  function addExpense(expense: Expense) {
    setExpenses((currentExpenses) => [expense, ...currentExpenses]);
  }

  function deleteExpense(id: string) {
    setExpenses((currentExpenses) =>
      currentExpenses.filter((expense) => expense.id !== id),
    );
  }

  function addIncome(income: Income) {
    setIncomes((currentIncomes) => [income, ...currentIncomes]);
  }

  function deleteIncome(id: string) {
    setIncomes((currentIncomes) =>
      currentIncomes.filter((income) => income.id !== id),
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Family Expense Tracker
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            RumahBudget
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Catat pengeluaran keluarga dengan mudah, lihat kondisi keuangan
            bulanan, dan siapkan laporan mingguan atau bulanan untuk keluarga.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Sisa Bulan Ini</p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  remainingBalance < 0 ? "text-red-300" : ""
                }`}
              >
                {rupiahFormatter.format(remainingBalance)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pemasukan</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {rupiahFormatter.format(totalIncome)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pengeluaran</p>
              <p className="mt-2 text-2xl font-bold">
                {rupiahFormatter.format(totalExpense)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Status</p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  remainingBalance < 0 ? "text-red-300" : "text-emerald-400"
                }`}
              >
                {remainingBalance < 0 ? "Minus" : "Aman"}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950">
              + Catat Pengeluaran
            </button>

            <button className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200">
              Lihat Riwayat
            </button>
          </div>
        </div>
      </section>

      <IncomeForm
        incomes={incomes}
        onAddIncome={addIncome}
        onDeleteIncome={deleteIncome}
      />

      <ExpenseForm
        expenses={expenses}
        onAddExpense={addExpense}
        onDeleteExpense={deleteExpense}
      />
    </main>
  );
}
