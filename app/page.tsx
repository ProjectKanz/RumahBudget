"use client";

import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import TransactionHistory from "@/src/components/transaction-history";
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

type MonthlyStatus = {
  label: "Aman" | "Waspada" | "Bahaya";
  explanation: string;
  className: string;
};

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
  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;
  const monthlyStatus: MonthlyStatus =
    totalExpense > totalIncome
      ? {
          label: "Bahaya",
          explanation: "Pengeluaran sudah melebihi pemasukan.",
          className: "text-red-300",
        }
      : expenseRatio >= 0.7
        ? {
            label: "Waspada",
            explanation: "Pengeluaran sudah mendekati pemasukan.",
            className: "text-amber-300",
          }
        : {
            label: "Aman",
            explanation: "Pengeluaran masih terkendali.",
            className: "text-emerald-400",
          };

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
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-8 sm:px-6 sm:py-12">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Catatan Keuangan Pribadi
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            RumahBudget
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Catat pemasukan dan pengeluaran pribadi dengan mudah. Berbagi data
            keluarga bisa ditambahkan nanti setelah login dan privasi siap.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <label className="text-sm font-medium text-slate-300">
              Pengguna Aktif
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-base font-semibold text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
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
              Mode prototipe: data dipisahkan sesuai pengguna yang dipilih di
              perangkat ini. Privasi asli akan ditambahkan dengan login nanti.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Penyimpanan prototipe: data tersimpan hanya di browser ini. Login
              dan sinkronisasi cloud akan ditambahkan nanti.
            </p>
          </div>

          <div className="mt-10">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Ringkasan Bulan Ini
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2">
                <p className="text-sm text-slate-400">Sisa Bulan Ini</p>
                <p
                  className={`mt-2 text-3xl font-bold sm:text-4xl ${
                    remainingBalance < 0 ? "text-red-300" : ""
                  }`}
                >
                  {rupiahFormatter.format(remainingBalance)}
                </p>
              </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pemasukan</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400 sm:text-3xl">
                {rupiahFormatter.format(totalIncome)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pengeluaran</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {rupiahFormatter.format(totalExpense)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-slate-400">Status Bulanan</p>
              <p
                className={`mt-2 text-3xl font-bold ${monthlyStatus.className}`}
              >
                {monthlyStatus.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {monthlyStatus.explanation}
              </p>
            </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-full bg-emerald-400 px-6 py-4 text-base font-semibold text-slate-950 transition hover:bg-emerald-300 sm:px-7"
              type="button"
              onClick={() =>
                document
                  .getElementById("expense-form")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + Catat Pengeluaran
            </button>

            <button
              className="rounded-full border border-slate-700 px-6 py-4 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 sm:px-7"
              type="button"
              onClick={() =>
                document
                  .getElementById("income-form")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + Catat Pemasukan
            </button>
          </div>
        </div>
      </section>

      <TransactionHistory
        activeUser={activeUser}
        expenses={activeExpenses}
        incomes={activeIncomes}
        onDeleteExpense={deleteExpense}
        onDeleteIncome={deleteIncome}
      />

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
