"use client";

import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { ActiveUser } from "@/src/types/user";
import { useEffect, useMemo, useState } from "react";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const activeUsers: ActiveUser[] = ["Ibu", "Bapak", "Kanzan", "Guest"];
const activeUserStorageKey = "rumahbudget.activeUser";
const expensesStorageKey = "rumahbudget.expenses";
const incomesStorageKey = "rumahbudget.incomes";

function isActiveUser(value: unknown): value is ActiveUser {
  return activeUsers.includes(value as ActiveUser);
}

function readStoredArray<T>(key: string): T[] {
  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [activeUser, setActiveUser] = useState<ActiveUser>("Ibu");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedActiveUser = window.localStorage.getItem(activeUserStorageKey);
    const nextActiveUser = isActiveUser(storedActiveUser)
      ? storedActiveUser
      : "Ibu";
    const storedExpenses = readStoredArray<Expense>(expensesStorageKey);
    const storedIncomes = readStoredArray<Income>(incomesStorageKey);

    queueMicrotask(() => {
      setActiveUser(nextActiveUser);
      setExpenses(storedExpenses);
      setIncomes(storedIncomes);
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(activeUserStorageKey, activeUser);
  }, [activeUser, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(expensesStorageKey, JSON.stringify(expenses));
  }, [expenses, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(incomesStorageKey, JSON.stringify(incomes));
  }, [incomes, isHydrated]);

  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expense.owner === activeUser),
    [activeUser, expenses],
  );

  const activeIncomes = useMemo(
    () => incomes.filter((income) => income.owner === activeUser),
    [activeUser, incomes],
  );

  const totalExpense = useMemo(
    () => activeExpenses.reduce((total, expense) => total + expense.amount, 0),
    [activeExpenses],
  );

  const totalIncome = useMemo(
    () => activeIncomes.reduce((total, income) => total + income.amount, 0),
    [activeIncomes],
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
            Catat pemasukan dan pengeluaran pribadi dengan mudah. Berbagi data
            keluarga bisa ditambahkan nanti setelah login dan privasi siap.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <label className="text-sm font-medium text-slate-300">
              Active User
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                value={activeUser}
                onChange={(event) =>
                  setActiveUser(event.target.value as ActiveUser)
                }
              >
                {activeUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Prototype mode: data is separated by selected user locally. Real
              privacy will be added with login/auth later.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Prototype storage: data is saved in this browser only. Login and
              cloud sync will be added later.
            </p>
          </div>

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
        activeUser={activeUser}
        incomes={activeIncomes}
        onAddIncome={addIncome}
        onDeleteIncome={deleteIncome}
      />

      <ExpenseForm
        activeUser={activeUser}
        expenses={activeExpenses}
        onAddExpense={addExpense}
        onDeleteExpense={deleteExpense}
      />
    </main>
  );
}
