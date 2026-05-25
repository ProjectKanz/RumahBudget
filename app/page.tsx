"use client";

import AuthForm from "@/src/components/auth-form";
import DashboardCharts from "@/src/components/dashboard-charts";
import EmailReportHistory from "@/src/components/email-report-history";
import EmailReportPreferences from "@/src/components/email-report-preferences";
import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import MoneyAccounts from "@/src/components/money-accounts";
import OnboardingTutorial, {
  onboardingStepCount,
} from "@/src/components/onboarding-tutorial";
import ReportPreview from "@/src/components/report-preview";
import TransactionHistory from "@/src/components/transaction-history";
import TransferMoney from "@/src/components/transfer-money";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import type { EmailReport } from "@/src/types/email-report";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type {
  MoneyAccount,
  MoneyAccountType,
} from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const balancePrivacyStorageKey = "rumahbudget.hideBalances";

function getOnboardingStorageKey(userId: string) {
  return `rumahbudget.onboardingCompleted.${userId}`;
}

type MonthlyStatus = {
  label: "Safe" | "Warning" | "Critical";
  explanation: string;
  className: string;
};

type SupabaseExpenseRow = {
  id?: string | number;
  owner?: string | null;
  user_id?: string | null;
  account_id?: string | null;
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
  account_id?: string | null;
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

type SupabaseMoneyAccountRow = {
  id?: string | number;
  user_id?: string | null;
  name?: string | null;
  account_type?: string | null;
  initial_balance?: number | string | null;
  is_archived?: boolean | null;
  created_at?: string | null;
};

type SupabaseTransferRow = {
  id?: string | number;
  user_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  amount?: number | string | null;
  note?: string | null;
  created_at?: string | null;
};

function isMoneyAccountType(value: unknown): value is MoneyAccountType {
  return (
    value === "Bank" ||
    value === "E-Wallet" ||
    value === "Cash" ||
    value === "Investment" ||
    value === "Other"
  );
}

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

function isCurrentMonthTimestamp(createdAt: number) {
  if (!createdAt) {
    return false;
  }

  const transactionDate = new Date(createdAt);
  const today = new Date();

  return (
    transactionDate.getFullYear() === today.getFullYear() &&
    transactionDate.getMonth() === today.getMonth()
  );
}

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [emailReports, setEmailReports] = useState<EmailReport[]>([]);
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [expenseError, setExpenseError] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [emailReportError, setEmailReportError] = useState("");
  const [moneyAccountError, setMoneyAccountError] = useState("");
  const [transferError, setTransferError] = useState("");
  const [, setIsExpenseLoading] = useState(false);
  const [, setIsIncomeLoading] = useState(false);
  const [isEmailReportLoading, setIsEmailReportLoading] = useState(false);
  const [isMoneyAccountLoading, setIsMoneyAccountLoading] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

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
        accountId: expense.account_id ?? "",
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
        accountId: income.account_id ?? "",
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

  const loadMoneyAccountsFromSupabase = useCallback(async () => {
    setIsMoneyAccountLoading(true);

    if (!authUser) {
      setMoneyAccounts([]);
      setIsMoneyAccountLoading(false);
      return;
    }

    if (!supabase) {
      setMoneyAccountError(missingSupabaseEnvMessage);
      setIsMoneyAccountLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("money_accounts")
        .select("*")
        .eq("user_id", authUser.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .abortSignal(timeout.signal);

      if (error) {
        setMoneyAccountError(error.message);
        return;
      }

      const nextMoneyAccounts = (data as SupabaseMoneyAccountRow[]).map(
        (account): MoneyAccount => ({
          id: String(account.id ?? crypto.randomUUID()),
          userId: account.user_id ?? authUser.id,
          name: account.name ?? "Untitled account",
          accountType: isMoneyAccountType(account.account_type)
            ? account.account_type
            : "Other",
          initialBalance: Number(account.initial_balance ?? 0),
          isArchived: Boolean(account.is_archived),
          createdAt: account.created_at
            ? new Date(account.created_at).getTime()
            : 0,
        }),
      );

      setMoneyAccounts(nextMoneyAccounts);
      setMoneyAccountError("");
    } catch (error) {
      setMoneyAccountError(
        getSupabaseErrorMessage(
          error,
          "Failed to load money accounts from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsMoneyAccountLoading(false);
    }
  }, [authUser]);

  const loadTransfersFromSupabase = useCallback(async () => {
    if (!authUser) {
      setTransfers([]);
      return;
    }

    if (!supabase) {
      setTransferError(missingSupabaseEnvMessage);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("transfers")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .abortSignal(timeout.signal);

      if (error) {
        setTransferError(error.message);
        return;
      }

      const nextTransfers = (data as SupabaseTransferRow[]).map(
        (transfer): Transfer => ({
          id: String(transfer.id ?? crypto.randomUUID()),
          userId: transfer.user_id ?? authUser.id,
          fromAccountId: transfer.from_account_id ?? "",
          toAccountId: transfer.to_account_id ?? "",
          amount: Number(transfer.amount ?? 0),
          note: transfer.note ?? "",
          createdAt: transfer.created_at
            ? new Date(transfer.created_at).getTime()
            : 0,
        }),
      );

      setTransfers(nextTransfers);
      setTransferError("");
    } catch (error) {
      setTransferError(
        getSupabaseErrorMessage(
          error,
          "Failed to load transfers from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
  }, [authUser]);

  useEffect(() => {
    const storedBalancePrivacy = window.localStorage.getItem(
      balancePrivacyStorageKey,
    );

    queueMicrotask(() => {
      setIsBalanceHidden(storedBalancePrivacy === "true");
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
        setMoneyAccounts([]);
        setTransfers([]);
        setIsOnboardingOpen(false);
        setOnboardingStep(0);
      });
      return;
    }

    queueMicrotask(() => {
      void loadExpensesFromSupabase();
      void loadIncomesFromSupabase();
      void loadEmailReportsFromSupabase();
      void loadMoneyAccountsFromSupabase();
      void loadTransfersFromSupabase();
    });
  }, [
    authUser,
    loadEmailReportsFromSupabase,
    loadExpensesFromSupabase,
    loadIncomesFromSupabase,
    loadMoneyAccountsFromSupabase,
    loadTransfersFromSupabase,
  ]);

  useEffect(() => {
    if (!authUser || !isHydrated) {
      return;
    }

    const hasCompletedOnboarding =
      window.localStorage.getItem(getOnboardingStorageKey(authUser.id)) ===
      "true";

    if (hasCompletedOnboarding) {
      return;
    }

    queueMicrotask(() => {
      setOnboardingStep(0);
      setIsOnboardingOpen(true);
    });
  }, [authUser, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      balancePrivacyStorageKey,
      String(isBalanceHidden),
    );
  }, [isBalanceHidden, isHydrated]);

  const activeExpenses = expenses;

  const activeIncomes = incomes;
  const signedInEmail = authUser?.email ?? "Signed-in account";

  const monthlyExpenses = useMemo(
    () =>
      activeExpenses.filter((expense) =>
        isCurrentMonthTimestamp(expense.createdAt),
      ),
    [activeExpenses],
  );

  const monthlyIncomes = useMemo(
    () =>
      activeIncomes.filter((income) =>
        isCurrentMonthTimestamp(income.createdAt),
      ),
    [activeIncomes],
  );

  const totalExpense = useMemo(
    () => monthlyExpenses.reduce((total, expense) => total + expense.amount, 0),
    [monthlyExpenses],
  );

  const totalIncome = useMemo(
    () => monthlyIncomes.reduce((total, income) => total + income.amount, 0),
    [monthlyIncomes],
  );

  const moneyAccountBalances = useMemo(() => {
    const balances = moneyAccounts.reduce<Record<string, number>>(
      (nextBalances, account) => ({
        ...nextBalances,
        [account.id]: account.initialBalance,
      }),
      {},
    );

    activeIncomes.forEach((income) => {
      if (!income.accountId || !(income.accountId in balances)) {
        return;
      }

      balances[income.accountId] += income.amount;
    });

    activeExpenses.forEach((expense) => {
      if (!expense.accountId || !(expense.accountId in balances)) {
        return;
      }

      balances[expense.accountId] -= expense.amount;
    });

    transfers.forEach((transfer) => {
      if (transfer.toAccountId && transfer.toAccountId in balances) {
        balances[transfer.toAccountId] += transfer.amount;
      }

      if (transfer.fromAccountId && transfer.fromAccountId in balances) {
        balances[transfer.fromAccountId] -= transfer.amount;
      }
    });

    return balances;
  }, [activeExpenses, activeIncomes, moneyAccounts, transfers]);
  const totalBalance = useMemo(
    () =>
      moneyAccounts.reduce(
        (total, account) =>
          total + (moneyAccountBalances[account.id] ?? account.initialBalance),
        0,
      ),
    [moneyAccountBalances, moneyAccounts],
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
          account_id: expense.accountId,
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
          account_id: income.accountId,
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

  async function addMoneyAccount(account: {
    accountType: MoneyAccountType;
    initialBalance: number;
    name: string;
  }) {
    if (!supabase) {
      setMoneyAccountError(missingSupabaseEnvMessage);
      return false;
    }

    if (!authUser) {
      setMoneyAccountError("Please log in before saving a money account.");
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("money_accounts")
        .insert({
          user_id: authUser.id,
          name: account.name,
          account_type: account.accountType,
          initial_balance: account.initialBalance,
          is_archived: false,
        })
        .abortSignal(timeout.signal);

      if (error) {
        setMoneyAccountError(error.message);
        return false;
      }

      await loadMoneyAccountsFromSupabase();
      return true;
    } catch (error) {
      setMoneyAccountError(
        getSupabaseErrorMessage(
          error,
          "Failed to save money account to Supabase.",
        ),
      );
      return false;
    } finally {
      timeout.clear();
    }
  }

  async function archiveMoneyAccount(id: string) {
    if (!supabase) {
      setMoneyAccountError(missingSupabaseEnvMessage);
      return;
    }

    if (!authUser) {
      setMoneyAccountError("Please log in before archiving a money account.");
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("money_accounts")
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal);

      if (error) {
        setMoneyAccountError(error.message);
        return;
      }

      await loadMoneyAccountsFromSupabase();
    } catch (error) {
      setMoneyAccountError(
        getSupabaseErrorMessage(
          error,
          "Failed to archive money account in Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
  }

  async function addTransfer(transfer: {
    amount: number;
    fromAccountId: string;
    note: string;
    toAccountId: string;
  }) {
    if (!supabase) {
      setTransferError(missingSupabaseEnvMessage);
      return false;
    }

    if (!authUser) {
      setTransferError("Please log in before saving a transfer.");
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("transfers")
        .insert({
          user_id: authUser.id,
          from_account_id: transfer.fromAccountId,
          to_account_id: transfer.toAccountId,
          amount: transfer.amount,
          note: transfer.note,
        })
        .abortSignal(timeout.signal);

      if (error) {
        setTransferError(error.message);
        return false;
      }

      await loadTransfersFromSupabase();
      return true;
    } catch (error) {
      setTransferError(
        getSupabaseErrorMessage(
          error,
          "Failed to save transfer to Supabase.",
        ),
      );
      return false;
    } finally {
      timeout.clear();
    }
  }

  async function deleteTransfer(id: string) {
    if (!supabase) {
      setTransferError(missingSupabaseEnvMessage);
      return;
    }

    if (!authUser) {
      setTransferError("Please log in before deleting a transfer.");
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("transfers")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal);

      if (error) {
        setTransferError(error.message);
        return;
      }

      await loadTransfersFromSupabase();
    } catch (error) {
      setTransferError(
        getSupabaseErrorMessage(
          error,
          "Failed to delete transfer from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
    }
  }

  function completeOnboarding() {
    if (authUser) {
      window.localStorage.setItem(getOnboardingStorageKey(authUser.id), "true");
    }

    setIsOnboardingOpen(false);
    setOnboardingStep(0);
  }

  function restartOnboarding() {
    setOnboardingStep(0);
    setIsOnboardingOpen(true);
  }

  async function logout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
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
      <OnboardingTutorial
        currentStep={onboardingStep}
        isOpen={isOnboardingOpen}
        onBack={() =>
          setOnboardingStep((currentStep) => Math.max(0, currentStep - 1))
        }
        onFinish={completeOnboarding}
        onNext={() =>
          setOnboardingStep((currentStep) =>
            Math.min(onboardingStepCount - 1, currentStep + 1),
          )
        }
        onSkip={completeOnboarding}
      />

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

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Signed in as:{" "}
              <span className="font-semibold text-white">{signedInEmail}</span>
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                type="button"
                onClick={restartOnboarding}
              >
                Restart Tutorial
              </button>
              <button
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                type="button"
                onClick={logout}
              >
                Log out
              </button>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Dashboard Summary
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Monthly cards use transactions from this calendar month.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 sm:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-emerald-100">
                      Total Account Balance
                    </p>
                    <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                      {isBalanceHidden
                        ? hiddenBalanceLabel
                        : formatCurrency(totalBalance)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-emerald-50/80">
                      Money currently stored across all money accounts.
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-emerald-300/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/10"
                    type="button"
                    onClick={() =>
                      setIsBalanceHidden((currentValue) => !currentValue)
                    }
                  >
                    {isBalanceHidden ? "Show Balance" : "Hide Balance"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2">
                <p className="text-sm text-slate-400">Monthly Net Cashflow</p>
                <p
                  className={`mt-2 text-3xl font-bold sm:text-4xl ${
                    remainingBalance < 0 ? "text-red-300" : ""
                  }`}
                >
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(remainingBalance)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Monthly income minus monthly expenses.
                </p>
              </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Monthly Income</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400 sm:text-3xl">
                {formatCurrency(totalIncome)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Monthly Expenses</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {formatCurrency(totalExpense)}
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
                  .getElementById("income-form")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + Add Income
            </button>

            <button
              className="rounded-full border border-slate-700 px-6 py-4 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 sm:px-7"
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
                  .getElementById("money-accounts")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + Add Money Account
            </button>

            <button
              className="rounded-full border border-slate-700 px-6 py-4 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 sm:px-7"
              type="button"
              onClick={() =>
                document
                  .getElementById("transfer-money")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + Transfer Money
            </button>
          </div>
        </div>
      </section>

      <MoneyAccounts
        accounts={moneyAccounts}
        accountBalances={moneyAccountBalances}
        isBalanceHidden={isBalanceHidden}
        error={moneyAccountError}
        isLoading={isMoneyAccountLoading}
        onAddAccount={addMoneyAccount}
        onArchiveAccount={archiveMoneyAccount}
      />

      <IncomeForm
        accountLabel={signedInEmail}
        moneyAccounts={moneyAccounts}
        onAddIncome={addIncome}
        supabaseError={incomeError}
      />

      <ExpenseForm
        accountLabel={signedInEmail}
        moneyAccounts={moneyAccounts}
        onAddExpense={addExpense}
        supabaseError={expenseError}
      />

      <TransferMoney
        accountBalances={moneyAccountBalances}
        accounts={moneyAccounts}
        error={transferError}
        onAddTransfer={addTransfer}
      />

      <DashboardCharts
        accountBalances={moneyAccountBalances}
        expenses={activeExpenses}
        isBalanceHidden={isBalanceHidden}
        moneyAccounts={moneyAccounts}
      />

      <TransactionHistory
        accountLabel={signedInEmail}
        moneyAccounts={moneyAccounts}
        expenses={activeExpenses}
        incomes={activeIncomes}
        transfers={transfers}
        onDeleteExpense={deleteExpense}
        onDeleteIncome={deleteIncome}
        onDeleteTransfer={deleteTransfer}
      />

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
        </>
      ) : null}
    </main>
  );
}
