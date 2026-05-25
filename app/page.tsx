"use client";

import AuthForm from "@/src/components/auth-form";
import EmailReportHistory from "@/src/components/email-report-history";
import EmailReportPreferences from "@/src/components/email-report-preferences";
import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import ReportPreview from "@/src/components/report-preview";
import SupabaseTestPanel from "@/src/components/supabase-test-panel";
import TransactionHistory from "@/src/components/transaction-history";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import type { EmailReport } from "@/src/types/email-report";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { ActiveUser } from "@/src/types/user";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const activeUsers: ActiveUser[] = ["Ibu", "Bapak", "Kanzan", "Guest"];
const activeUserStorageKey = "rumahbudget.activeUser";

type MonthlyStatus = {
  label: "Safe" | "Warning" | "Critical";
  explanation: string;
  className: string;
};

type SupabaseExpenseRow = {
  id?: string | number;
  owner?: string | null;
  user_id?: string | null;
  amount?: number | string;
  category?: string;
  payment_method?: string;
  note?: string | null;
  created_at?: string | null;
};

type SupabaseIncomeRow = {
  id?: string | number;
  owner?: string | null;
  user_id?: string | null;
  amount?: number | string;
  source?: string;
  note?: string | null;
  created_at?: string | null;
};

type SupabaseEmailReportRow = {
  id?: string | number;
  user_id?: string | null;
  recipient_email?: string | null;
  report_type?: string | null;
  period_label?: string | null;
  status?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
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
    return "Supabase connection timed out. Please try again or check your internet connection.";
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

function isActiveUser(value: unknown): value is ActiveUser {
  return activeUsers.includes(value as ActiveUser);
}

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<ActiveUser>("Ibu");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [emailReports, setEmailReports] = useState<EmailReport[]>([]);
  const [expenseError, setExpenseError] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [emailReportError, setEmailReportError] = useState("");
  const [isExpenseLoading, setIsExpenseLoading] = useState(false);
  const [isIncomeLoading, setIsIncomeLoading] = useState(false);
  const [isEmailReportLoading, setIsEmailReportLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const loadExpensesFromSupabase = useCallback(async () => {
    setIsExpenseLoading(true);

    if (!authUser) {
      setExpenses([]);
      setIsExpenseLoading(false);
      return;
    }

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
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal);

      if (error) {
        setExpenseError(error.message);
        return;
      }

      const nextExpenses = (data as SupabaseExpenseRow[]).map((expense) => ({
        id: String(expense.id ?? crypto.randomUUID()),
        owner: expense.owner ?? authUser.email ?? "Unknown",
        userId: expense.user_id ?? authUser.id,
        createdAt: expense.created_at
          ? new Date(expense.created_at).getTime()
          : 0,
        amount: Number(expense.amount ?? 0),
        category: expense.category ?? "Other",
        paymentMethod: expense.payment_method ?? "Unknown",
        note: expense.note ?? "",
      }));

      setExpenses(nextExpenses);
      setExpenseError("");
    } catch (error) {
      setExpenseError(
        getSupabaseErrorMessage(
          error,
          "Failed to load expenses from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsExpenseLoading(false);
    }
  }, [authUser]);

  const loadIncomesFromSupabase = useCallback(async () => {
    setIsIncomeLoading(true);

    if (!authUser) {
      setIncomes([]);
      setIsIncomeLoading(false);
      return;
    }

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
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal);

      if (error) {
        setIncomeError(error.message);
        return;
      }

      const nextIncomes = (data as SupabaseIncomeRow[]).map((income) => ({
        id: String(income.id ?? crypto.randomUUID()),
        owner: income.owner ?? authUser.email ?? "Unknown",
        userId: income.user_id ?? authUser.id,
        createdAt: income.created_at ? new Date(income.created_at).getTime() : 0,
        amount: Number(income.amount ?? 0),
        source: income.source ?? "Unknown",
        note: income.note ?? "",
      }));

      setIncomes(nextIncomes);
      setIncomeError("");
    } catch (error) {
      setIncomeError(
        getSupabaseErrorMessage(
          error,
          "Failed to load income from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsIncomeLoading(false);
    }
  }, [authUser]);

  const loadEmailReportsFromSupabase = useCallback(async () => {
    setIsEmailReportLoading(true);

    if (!authUser) {
      setEmailReports([]);
      setIsEmailReportLoading(false);
      return;
    }

    if (!supabase) {
      setEmailReportError(missingSupabaseEnvMessage);
      setIsEmailReportLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("email_reports")
        .select("*")
        .eq("user_id", authUser.id)
        .order("sent_at", { ascending: false })
        .limit(10)
        .abortSignal(timeout.signal);

      if (error) {
        setEmailReportError(error.message);
        return;
      }

      const nextEmailReports = (data as SupabaseEmailReportRow[]).map(
        (report): EmailReport => ({
          id: String(report.id ?? crypto.randomUUID()),
          userId: report.user_id ?? authUser.id,
          recipientEmail: report.recipient_email ?? "Unknown",
          reportType: report.report_type ?? "Report",
          periodLabel: report.period_label ?? "Unknown period",
          status: report.status === "success" ? "success" : "failed",
          errorMessage: report.error_message ?? "",
          sentAt: report.sent_at ? new Date(report.sent_at).getTime() : 0,
        }),
      );

      setEmailReports(nextEmailReports);
      setEmailReportError("");
    } catch (error) {
      setEmailReportError(
        getSupabaseErrorMessage(
          error,
          "Failed to load email report history from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsEmailReportLoading(false);
    }
  }, [authUser]);

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
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      if (!supabase) {
        setIsAuthLoading(false);
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) {
          return;
        }

        setAuthUser(session?.user ?? null);
        setIsAuthLoading(false);
      });

      unsubscribe = () => subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!isMounted) {
            return;
          }

          setAuthUser(data.session?.user ?? null);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setAuthUser(null);
        })
        .finally(() => {
          if (!isMounted) {
            return;
          }

          setIsAuthLoading(false);
        });
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      queueMicrotask(() => {
        setExpenses([]);
        setIncomes([]);
        setEmailReports([]);
      });
      return;
    }

    queueMicrotask(() => {
      void loadExpensesFromSupabase();
      void loadIncomesFromSupabase();
      void loadEmailReportsFromSupabase();
    });
  }, [
    authUser,
    loadEmailReportsFromSupabase,
    loadExpensesFromSupabase,
    loadIncomesFromSupabase,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(activeUserStorageKey, activeUser);
  }, [activeUser, isHydrated]);

  const activeExpenses = expenses;

  const activeIncomes = incomes;

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
          label: "Critical",
          explanation: "Expenses are higher than income.",
          className: "text-red-300",
        }
      : expenseRatio >= 0.7
        ? {
            label: "Warning",
            explanation: "Expenses are getting close to income.",
            className: "text-amber-300",
          }
        : {
            label: "Safe",
            explanation: "Expenses are still under control.",
            className: "text-emerald-400",
          };

  async function addExpense(expense: Expense) {
    if (!supabase) {
      setExpenseError(missingSupabaseEnvMessage);
      return false;
    }

    if (!authUser) {
      setExpenseError("Please log in before saving an expense.");
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("expenses")
        .insert({
          user_id: authUser.id,
          owner: authUser.email,
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
          "Failed to save expense to Supabase.",
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

    if (!authUser) {
      setExpenseError("Please log in before deleting an expense.");
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id)
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
          "Failed to delete expense from Supabase.",
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

    if (!authUser) {
      setIncomeError("Please log in before saving income.");
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("incomes")
        .insert({
          user_id: authUser.id,
          owner: authUser.email,
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
          "Failed to save income to Supabase.",
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

    if (!authUser) {
      setIncomeError("Please log in before deleting income.");
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id)
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
          "Failed to delete income from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {isAuthLoading ? (
        <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-8 sm:px-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-300">
            Checking your session...
          </div>
        </section>
      ) : null}

      {!isAuthLoading && !authUser ? <AuthForm /> : null}

      {!isAuthLoading && authUser ? (
        <>
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-8 sm:px-6 sm:py-12">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Personal Finance Tracker
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            RumahBudget
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Track personal income and expenses with a private account. Family
            sharing can be added later when permissions are ready.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Logged in as</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {authUser.email}
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 opacity-80">
            <label className="text-sm font-medium text-slate-300">
              Temporary Active User
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
              Temporary mode: this selection is kept for prototype
              compatibility, but data now belongs to the signed-in Supabase
              account.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Only data from the signed-in account is shown.
            </p>
          </div>

          <div className="mt-10">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                This Month
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2">
                <p className="text-sm text-slate-400">Remaining This Month</p>
                <p
                  className={`mt-2 text-3xl font-bold sm:text-4xl ${
                    remainingBalance < 0 ? "text-red-300" : ""
                  }`}
                >
                  {rupiahFormatter.format(remainingBalance)}
                </p>
              </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Income</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400 sm:text-3xl">
                {rupiahFormatter.format(totalIncome)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Expenses</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {rupiahFormatter.format(totalExpense)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-slate-400">Monthly Status</p>
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
              + Add Expense
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
              + Add Income
            </button>
          </div>
        </div>
      </section>

      <AuthForm userEmail={authUser.email} />

      <SupabaseTestPanel />

      <ReportPreview
        expenses={activeExpenses}
        incomes={activeIncomes}
        onReportSent={loadEmailReportsFromSupabase}
      />

      <EmailReportPreferences user={authUser} />

      <EmailReportHistory
        emailReports={emailReports}
        error={emailReportError}
        isLoading={isEmailReportLoading}
      />

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
        </>
      ) : null}
    </main>
  );
}
