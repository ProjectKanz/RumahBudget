"use client";

import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import SupabaseTestPanel from "@/src/components/supabase-test-panel";
import TransactionHistory from "@/src/components/transaction-history";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
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

type MonthlyStatus = {
  label: "Aman" | "Waspada" | "Bahaya";
  explanation: string;
  className: string;
};

type SupabaseExpenseRow = {
  id?: string | number;
  owner?: ActiveUser;
  amount?: number | string;
  category?: string;
  payment_method?: string;
  note?: string | null;
  created_at?: string | null;
};

type SupabaseIncomeRow = {
  id?: string | number;
  owner?: ActiveUser;
  amount?: number | string;
  source?: string;
  note?: string | null;
  created_at?: string | null;
};

function createSupabaseTimeout() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function getSupabaseErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Koneksi Supabase terlalu lama. Coba lagi atau periksa koneksi internet.";
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

function isActiveUser(value: unknown): value is ActiveUser {
  return activeUsers.includes(value as ActiveUser);
}

export default function Home() {
  const [activeUser, setActiveUser] = useState<ActiveUser>("Ibu");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenseError, setExpenseError] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [isExpenseLoading, setIsExpenseLoading] = useState(false);
  const [isIncomeLoading, setIsIncomeLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  async function loadExpensesFromSupabase() {
    setIsExpenseLoading(true);

    if (!supabase) {
      setExpenseError(missingSupabaseEnvMessage);
      setIsExpenseLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .abortSignal(timeout.signal);

      if (error) {
        setExpenseError(error.message);
        return;
      }

      const nextExpenses = (data as SupabaseExpenseRow[]).map((expense) => ({
        id: String(expense.id ?? crypto.randomUUID()),
        owner: isActiveUser(expense.owner) ? expense.owner : "Guest",
        createdAt: expense.created_at
          ? new Date(expense.created_at).getTime()
          : 0,
        amount: Number(expense.amount ?? 0),
        category: expense.category ?? "Lainnya",
        paymentMethod: expense.payment_method ?? "Tidak diketahui",
        note: expense.note ?? "",
      }));

      setExpenses(nextExpenses);
      setExpenseError("");
    } catch (error) {
      setExpenseError(
        getSupabaseErrorMessage(
          error,
          "Gagal memuat pengeluaran dari Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsExpenseLoading(false);
    }
  }

  async function loadIncomesFromSupabase() {
    setIsIncomeLoading(true);

    if (!supabase) {
      setIncomeError(missingSupabaseEnvMessage);
      setIsIncomeLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .abortSignal(timeout.signal);

      if (error) {
        setIncomeError(error.message);
        return;
      }

      const nextIncomes = (data as SupabaseIncomeRow[]).map((income) => ({
        id: String(income.id ?? crypto.randomUUID()),
        owner: isActiveUser(income.owner) ? income.owner : "Guest",
        createdAt: income.created_at ? new Date(income.created_at).getTime() : 0,
        amount: Number(income.amount ?? 0),
        source: income.source ?? "Tidak diketahui",
        note: income.note ?? "",
      }));

      setIncomes(nextIncomes);
      setIncomeError("");
    } catch (error) {
      setIncomeError(
        getSupabaseErrorMessage(
          error,
          "Gagal memuat pemasukan dari Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsIncomeLoading(false);
    }
  }

  useEffect(() => {
    const storedActiveUser = window.localStorage.getItem(activeUserStorageKey);
    const nextActiveUser = isActiveUser(storedActiveUser)
      ? storedActiveUser
      : "Ibu";

    queueMicrotask(() => {
      setActiveUser(nextActiveUser);
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadExpensesFromSupabase();
      void loadIncomesFromSupabase();
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(activeUserStorageKey, activeUser);
  }, [activeUser, isHydrated]);

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

  async function addExpense(expense: Expense) {
    if (!supabase) {
      setExpenseError(missingSupabaseEnvMessage);
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("expenses")
        .insert({
          owner: expense.owner,
          amount: expense.amount,
          category: expense.category,
          payment_method: expense.paymentMethod,
          note: expense.note,
        })
        .abortSignal(timeout.signal);

      if (error) {
        setExpenseError(error.message);
        return false;
      }

      await loadExpensesFromSupabase();
      return true;
    } catch (error) {
      setExpenseError(
        getSupabaseErrorMessage(
          error,
          "Gagal menyimpan pengeluaran ke Supabase.",
        ),
      );
      return false;
    } finally {
      timeout.clear();
    }
  }

  async function deleteExpense(id: string) {
    if (!supabase) {
      setExpenseError(missingSupabaseEnvMessage);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .abortSignal(timeout.signal);

      if (error) {
        setExpenseError(error.message);
        return;
      }

      await loadExpensesFromSupabase();
    } catch (error) {
      setExpenseError(
        getSupabaseErrorMessage(
          error,
          "Gagal menghapus pengeluaran dari Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
  }

  async function addIncome(income: Income) {
    if (!supabase) {
      setIncomeError(missingSupabaseEnvMessage);
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("incomes")
        .insert({
          owner: income.owner,
          amount: income.amount,
          source: income.source,
          note: income.note,
        })
        .abortSignal(timeout.signal);

      if (error) {
        setIncomeError(error.message);
        return false;
      }

      await loadIncomesFromSupabase();
      return true;
    } catch (error) {
      setIncomeError(
        getSupabaseErrorMessage(
          error,
          "Gagal menyimpan pemasukan ke Supabase.",
        ),
      );
      return false;
    } finally {
      timeout.clear();
    }
  }

  async function deleteIncome(id: string) {
    if (!supabase) {
      setIncomeError(missingSupabaseEnvMessage);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id)
        .abortSignal(timeout.signal);

      if (error) {
        setIncomeError(error.message);
        return;
      }

      await loadIncomesFromSupabase();
    } catch (error) {
      setIncomeError(
        getSupabaseErrorMessage(
          error,
          "Gagal menghapus pemasukan dari Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
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

      <SupabaseTestPanel />

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
        supabaseError={incomeError}
        isLoadingIncomes={isIncomeLoading}
      />

      <ExpenseForm
        activeUser={activeUser}
        expenses={activeExpenses}
        onAddExpense={addExpense}
        onDeleteExpense={deleteExpense}
        supabaseError={expenseError}
        isLoadingExpenses={isExpenseLoading}
      />
    </main>
  );
}
