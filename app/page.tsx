"use client";

import AuthForm from "@/src/components/auth-form";
import {
  MetricCell,
  NumberValue,
  SectionHeader,
  SharpButton,
  SharpInput,
  SegmentedControl,
  StatusChip,
  SystemReading,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
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
  label: "Safe" | "Warning" | "Critical" | "No income recorded";
  explanation: string;
  className: string;
};

type SignalCheckState = "clear" | "critical" | "watch";

type QuickAddTab = "income" | "expense" | "transfer";
type AppView =
  | "overview"
  | "accounts"
  | "add"
  | "transactions"
  | "reports"
  | "settings";

type OnboardingStepTarget = {
  view: AppView;
  sectionId: string;
  quickAddTab?: QuickAddTab;
};

const appViews: { label: string; value: AppView }[] = [
  { label: "Overview", value: "overview" },
  { label: "Accounts", value: "accounts" },
  { label: "Add", value: "add" },
  { label: "Transactions", value: "transactions" },
  { label: "Reports", value: "reports" },
  { label: "Settings", value: "settings" },
];

const quickAddTabs: { label: string; value: QuickAddTab }[] = [
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
  { label: "Transfer", value: "transfer" },
];

const onboardingStepTargets: OnboardingStepTarget[] = [
  { sectionId: "overview", view: "overview" },
  { sectionId: "money-accounts", view: "accounts" },
  { quickAddTab: "income", sectionId: "quick-add", view: "add" },
  { quickAddTab: "expense", sectionId: "quick-add", view: "add" },
  { quickAddTab: "transfer", sectionId: "quick-add", view: "add" },
  { sectionId: "dashboard-charts", view: "overview" },
  { sectionId: "report-preview", view: "reports" },
];

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

type RecentActivityItem = {
  id: string;
  accountLabel: string;
  amount: number;
  createdAt: number;
  title: string;
  tone: "income" | "expense" | "transfer";
};

const activityDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [quickAddTab, setQuickAddTab] = useState<QuickAddTab>("income");
  const [highlightedSectionId, setHighlightedSectionId] = useState("");
  const [plannedSpend, setPlannedSpend] = useState("250000");

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

  useEffect(() => {
    if (!highlightedSectionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedSectionId("");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedSectionId]);

  useEffect(() => {
    if (!isOnboardingOpen) {
      return;
    }

    const target = onboardingStepTargets[onboardingStep];

    if (!target) {
      return;
    }

    queueMicrotask(() => {
      setActiveView(target.view);

      if (target.quickAddTab) {
        setQuickAddTab(target.quickAddTab);
      }

      window.setTimeout(() => {
        document
          .getElementById(target.sectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedSectionId(target.sectionId);
      }, 80);
    });
  }, [isOnboardingOpen, onboardingStep]);

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

  const accountNamesById = useMemo(
    () =>
      moneyAccounts.reduce<Record<string, string>>(
        (nextNames, account) => ({
          ...nextNames,
          [account.id]: account.name,
        }),
        {},
      ),
    [moneyAccounts],
  );

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
    totalIncome === 0 && totalExpense > 0
      ? totalBalance <= 0
        ? {
            label: "Critical",
            explanation:
              "You have expenses this month, no income recorded yet, and your Total Account Balance is not positive.",
            className: "text-rose-300",
          }
        : {
            label: "No income recorded",
            explanation:
              "You have expenses this month, but no income has been recorded yet. These expenses are being paid from your existing account balance.",
            className: "text-cyan-200",
          }
      : totalIncome > 0 && totalExpense > totalIncome
        ? {
            label: "Critical",
            explanation:
              totalBalance > 0
                ? "Expenses exceed recorded income this month, but your Total Account Balance is still positive."
                : "Expenses exceed recorded income this month and your Total Account Balance is not positive.",
            className: "text-rose-300",
          }
        : expenseRatio >= 0.7
          ? {
              label: "Warning",
              explanation: "Expenses are 70% or more of recorded income.",
              className: "text-amber-300",
            }
          : {
              label: "Safe",
              explanation: "Expenses are less than 70% of recorded income.",
              className: "text-lime-300",
            };

  const monthlyStatusBadgeClass =
    monthlyStatus.label === "Safe"
      ? "border-lime-300/50 bg-lime-300/10 text-lime-200 shadow-[0_0_26px_rgba(190,242,100,0.18)]"
      : monthlyStatus.label === "Warning"
        ? "border-amber-300/50 bg-amber-300/10 text-amber-200 shadow-[0_0_26px_rgba(252,211,77,0.14)]"
        : monthlyStatus.label === "Critical"
          ? "border-pink-400/50 bg-pink-500/10 text-pink-200 shadow-[0_0_26px_rgba(244,114,182,0.16)]"
          : "border-cyan-300/50 bg-cyan-300/10 text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.16)]";

  const plannedSpendAmount = Number(plannedSpend);
  const safePlannedSpendAmount =
    Number.isFinite(plannedSpendAmount) && plannedSpendAmount > 0
      ? plannedSpendAmount
      : 0;
  const balanceAfterPlannedSpend = totalBalance - safePlannedSpendAmount;
  const dailyBurnEstimate = totalExpense > 0 ? totalExpense / 30 : 0;
  const runwayDays =
    dailyBurnEstimate > 0
      ? Math.max(0, Math.floor(totalBalance / dailyBurnEstimate))
      : null;
  const projectedMonthlyExpenses = totalExpense + safePlannedSpendAmount;
  const projectedNetCashflow = totalIncome - projectedMonthlyExpenses;
  const projectedDailyBurn =
    projectedMonthlyExpenses > 0 ? projectedMonthlyExpenses / 30 : 0;
  const projectedRunwayDays =
    projectedDailyBurn > 0
      ? Math.max(
          0,
          Math.floor(Math.max(0, balanceAfterPlannedSpend) / projectedDailyBurn),
        )
      : null;
  const spendGaugePercent =
    totalBalance > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((balanceAfterPlannedSpend / totalBalance) * 100),
          ),
        )
      : 0;
  const spendGaugeColor =
    spendGaugePercent <= 15
      ? "#fb7185"
      : spendGaugePercent <= 45
        ? "#fbbf24"
        : "#22d3ee";
  const spendSignal =
    safePlannedSpendAmount <= 0
      ? {
          label: "Enter a spend",
          tone: "text-slate-300",
          description:
            "Preview a purchase before it touches your real account balance.",
        }
      : balanceAfterPlannedSpend <= 0
        ? {
            label: "Hard stop",
            tone: "text-pink-200",
            description:
              "This planned spend would leave your Total Account Balance at zero or below.",
          }
        : totalIncome === 0 && totalExpense > 0
          ? {
              label: "Balance-funded",
              tone: "text-cyan-200",
              description:
                "Possible, but this month has no recorded income, so it comes from existing balance.",
            }
          : safePlannedSpendAmount > Math.max(totalBalance * 0.25, 0)
            ? {
                label: "Big move",
                tone: "text-amber-200",
                description:
                  "This is more than 25% of your current account balance. Worth a second look.",
              }
            : {
                label: "Looks manageable",
                tone: "text-lime-200",
                description:
                  "This planned spend fits inside your current account balance.",
              };
  const projectedExpenseRatio =
    totalIncome > 0 ? projectedMonthlyExpenses / totalIncome : null;
  const runwayDelta =
    runwayDays !== null && projectedRunwayDays !== null
      ? runwayDays - projectedRunwayDays
      : null;
  const signalMode =
    balanceAfterPlannedSpend <= 0
      ? "stop"
      : spendGaugePercent <= 15 ||
          (projectedExpenseRatio !== null && projectedExpenseRatio > 1)
        ? "danger"
        : spendGaugePercent <= 45 ||
            (projectedExpenseRatio !== null && projectedExpenseRatio >= 0.7)
          ? "watch"
          : "clear";
  const signalModeClass =
    signalMode === "stop" || signalMode === "danger"
      ? "border-rose-300/35 bg-rose-300/10 text-rose-100"
      : signalMode === "watch"
        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
        : "border-lime-300/30 bg-lime-300/10 text-lime-100";
  const actionProtocol =
    signalMode === "stop"
      ? "Do not spend. This would deplete your Total Account Balance."
      : signalMode === "danger"
        ? "Delay or reduce the purchase. Your projected cashflow is under pressure."
        : signalMode === "watch"
          ? "Proceed carefully. Log the expense after purchase and watch the next transaction."
          : "Proceed if it matches your priorities. Your reserve stays healthy.";
  const decisionChecks: Array<{
    detail: string;
    label: string;
    state: SignalCheckState;
    value: string;
  }> = [
    {
      label: "Reserve",
      value: `${spendGaugePercent}%`,
      detail: "balance left",
      state:
        spendGaugePercent <= 15
          ? "critical"
          : spendGaugePercent <= 45
            ? "watch"
            : "clear",
    },
    {
      label: "Cashflow",
      value:
        totalIncome === 0
          ? "No income"
          : `${Math.round((projectedExpenseRatio ?? 0) * 100)}%`,
      detail: totalIncome === 0 ? "recorded this month" : "expense load",
      state:
        totalIncome === 0 && projectedMonthlyExpenses > 0
          ? "watch"
          : projectedExpenseRatio !== null && projectedExpenseRatio > 1
            ? "critical"
            : projectedExpenseRatio !== null && projectedExpenseRatio >= 0.7
              ? "watch"
              : "clear",
    },
    {
      label: "Runway",
      value:
        projectedRunwayDays === null ? "No burn" : `${projectedRunwayDays}d`,
      detail:
        runwayDelta === null
          ? "after spend"
          : `${runwayDelta}d impact after spend`,
      state:
        projectedRunwayDays === null
          ? "clear"
          : projectedRunwayDays <= 7
            ? "critical"
            : projectedRunwayDays <= 21
              ? "watch"
              : "clear",
    },
  ];
  const checkToneClass: Record<SignalCheckState, string> = {
    clear: "border-lime-300/25 bg-lime-300/10 text-lime-100",
    critical: "border-rose-300/35 bg-rose-300/10 text-rose-100",
    watch: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  };

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    const incomeActivity = activeIncomes.map((income) => ({
      accountLabel: accountNamesById[income.accountId] ?? "No account",
      amount: income.amount,
      createdAt: income.createdAt,
      id: `income-${income.id}`,
      title: income.source || "Income",
      tone: "income" as const,
    }));

    const expenseActivity = activeExpenses.map((expense) => ({
      accountLabel: accountNamesById[expense.accountId] ?? "No account",
      amount: expense.amount,
      createdAt: expense.createdAt,
      id: `expense-${expense.id}`,
      title: expense.category || "Expense",
      tone: "expense" as const,
    }));

    const transferActivity = transfers.map((transfer) => ({
      accountLabel: `${accountNamesById[transfer.fromAccountId] ?? "Account"} -> ${
        accountNamesById[transfer.toAccountId] ?? "Account"
      }`,
      amount: transfer.amount,
      createdAt: transfer.createdAt,
      id: `transfer-${transfer.id}`,
      title: "Transfer",
      tone: "transfer" as const,
    }));

    return [...incomeActivity, ...expenseActivity, ...transferActivity]
      .sort(
        (firstActivity, secondActivity) =>
          secondActivity.createdAt - firstActivity.createdAt,
      )
      .slice(0, 5);
  }, [accountNamesById, activeExpenses, activeIncomes, transfers]);

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

  function getSectionHighlightClass(sectionId: string) {
    return highlightedSectionId === sectionId
      ? "ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.22)]"
      : "";
  }

  function openView(view: AppView) {
    setActiveView(view);
    setHighlightedSectionId("");
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function logout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  return (
    <main className="rb-app min-h-screen overflow-x-hidden bg-black text-white">
      {isAuthLoading ? (
        <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-8 sm:px-6">
          <TerminalPanel className="!p-6 text-sm text-slate-300">
            Checking your session...
          </TerminalPanel>
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

          <section className="relative mx-auto max-w-6xl px-5 py-4 sm:px-6">
            <TerminalPanel isProminent className="!p-4 sm:!p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
                    Private Finance Cockpit
                  </p>
                  <h1 className="neo-title mt-2 text-4xl font-black tracking-tight text-white sm:text-6xl">
                    RumahBudget
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Private money tracking with accounts, cashflow, transfers,
                    and financial reports in one clean cockpit.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[0.68rem] font-black uppercase tracking-[0.22em]">
                    <StatusChip tone="cyan">Live ledger</StatusChip>
                    <StatusChip tone="lime">Spend signal</StatusChip>
                    <StatusChip tone="fuchsia">Report ready</StatusChip>
                  </div>
                </div>

                <div className="border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300 sm:min-w-72">
                  <p className="leading-5">
                    Signed in as:{" "}
                    <span className="font-semibold text-white">
                      {signedInEmail}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <SharpButton
                      className="min-h-10 flex-1 px-3 py-2"
                      type="button"
                      onClick={() => openView("settings")}
                    >
                      Settings
                    </SharpButton>
                    <SharpButton
                      className="min-h-10 flex-1 px-3 py-2"
                      variant="danger"
                      type="button"
                      onClick={logout}
                    >
                      Log out
                    </SharpButton>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          </section>

          <div className="sticky top-0 z-30 hidden border-y border-cyan-300/10 bg-black/80 px-5 py-2 backdrop-blur-xl sm:block">
            <nav
              aria-label="Primary app views"
              className="cockpit-nav mx-auto flex max-w-6xl gap-2 overflow-x-auto border border-white/10 bg-black/40 p-1.5"
            >
              {appViews.map((item) => (
                <button
                  className={`shrink-0 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-cyan-300/50 ${
                    activeView === item.value
                      ? "cockpit-nav-active text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.28)]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                  key={item.value}
                  type="button"
                  onClick={() => openView(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <nav
            aria-label="Mobile app views"
            className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-1 border border-cyan-300/20 bg-black/90 p-2 shadow-[0_0_36px_rgba(34,211,238,0.18)] backdrop-blur-xl sm:hidden"
          >
            {appViews.map((item) => (
              <button
                className={`px-1 py-2 text-[0.68rem] font-bold transition ${
                  activeView === item.value
                    ? "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.38)]"
                    : "text-slate-400"
                }`}
                key={item.value}
                type="button"
                onClick={() => openView(item.value)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="pb-36 sm:pb-10">
            {activeView === "overview" ? (
              <>
                <section
                  className="mx-auto max-w-6xl px-5 pb-6 pt-5 sm:px-6"
                  id="overview"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-lime-300">
                        Overview
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                        Your money command center
                      </h2>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-slate-400">
                      Monthly cards use this calendar month. Total Account
                      Balance is the sum of current balances across accounts.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCell
                      action={
                        <SharpButton
                          className="min-h-10 px-3 py-2"
                          type="button"
                          onClick={() =>
                            setIsBalanceHidden(
                              (currentValue) => !currentValue,
                            )
                          }
                        >
                          {isBalanceHidden ? "Show" : "Hide"}
                        </SharpButton>
                      }
                      className={`sm:col-span-2 ${getSectionHighlightClass("overview")}`}
                      description="Money currently stored across all money accounts."
                      label="Total Account Balance"
                      tone="cyan"
                      value={
                        isBalanceHidden
                          ? hiddenBalanceLabel
                          : formatCurrency(totalBalance)
                      }
                    />

                    <MetricCell
                      className="sm:col-span-2"
                      description="Monthly income minus monthly expenses."
                      label="Monthly Net Cashflow"
                      tone="fuchsia"
                      value={
                        <span
                          className={
                            remainingBalance < 0
                              ? "text-pink-200"
                              : "text-white"
                          }
                        >
                          {isBalanceHidden
                            ? hiddenBalanceLabel
                            : formatCurrency(remainingBalance)}
                        </span>
                      }
                    />

                    <MetricCell
                      label="Monthly Income"
                      tone="lime"
                      value={
                        <span className="text-lime-300">
                          {formatCurrency(totalIncome)}
                        </span>
                      }
                    />

                    <MetricCell
                      label="Monthly Expenses"
                      tone="rose"
                      value={
                        <span className="text-pink-200">
                          {formatCurrency(totalExpense)}
                        </span>
                      }
                    />

                    <MetricCell
                      className={`sm:col-span-2 ${monthlyStatusBadgeClass}`}
                      description={monthlyStatus.explanation}
                      label="Monthly Cashflow Status"
                      tone={
                        monthlyStatus.label === "Safe"
                          ? "lime"
                          : monthlyStatus.label === "Warning"
                            ? "amber"
                            : monthlyStatus.label === "Critical"
                              ? "rose"
                              : "cyan"
                      }
                      value={
                        <span className={monthlyStatus.className}>
                          {monthlyStatus.label}
                        </span>
                      }
                    />
                  </div>
                </section>

                <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-6">
                  <TerminalPanel className="signature-console neo-panel overflow-hidden !p-0">
                    <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip tone="fuchsia">Spend Signal</StatusChip>
                          <StatusChip tone="cyan">What-if simulator</StatusChip>
                        </div>
                        <h2 className="neo-title mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                          Can I spend this?
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                          Test a purchase against account balance, monthly
                          cashflow, and burn runway before recording anything.
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end lg:grid-cols-1">
                          <label className="text-sm font-medium text-slate-300">
                            Planned spend
                            <SharpInput
                              inputMode="numeric"
                              min="0"
                              type="number"
                              value={plannedSpend}
                              placeholder="Rp 250000"
                              onChange={(event) =>
                                setPlannedSpend(event.target.value)
                              }
                            />
                          </label>

                          <div className="grid grid-cols-3 gap-2">
                            {[100000, 250000, 500000].map((amount) => (
                              <SharpButton
                                className="px-3 py-3 text-xs"
                                key={amount}
                                type="button"
                                onClick={() => setPlannedSpend(String(amount))}
                              >
                                <NumberValue>
                                  {formatCurrency(amount)}
                                </NumberValue>
                              </SharpButton>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="signal-mini-card border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Planned spend
                            </p>
                            <p className="mt-2 text-lg font-black text-white">
                              <NumberValue>
                                {formatCurrency(safePlannedSpendAmount)}
                              </NumberValue>
                            </p>
                          </div>
                          <div className="signal-mini-card border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Net after spend
                            </p>
                            <p
                              className={`mt-2 text-lg font-black ${
                                projectedNetCashflow < 0
                                  ? "text-rose-200"
                                  : "text-cyan-100"
                              }`}
                            >
                              <NumberValue>
                                {formatCurrency(projectedNetCashflow)}
                              </NumberValue>
                            </p>
                          </div>
                        </div>

                        <div
                          className={`mt-5 border px-4 py-3 text-sm leading-6 ${signalModeClass}`}
                        >
                          <p className="font-black uppercase tracking-[0.16em]">
                            Action protocol
                          </p>
                          <p className="mt-2 text-slate-200/90">
                            {actionProtocol}
                          </p>
                        </div>
                      </div>

                      <div className="p-5 sm:p-6">
                        <div className="grid gap-5 xl:grid-cols-[auto_1fr] xl:items-center">
                          <div
                            className="signal-gauge signal-reticle mx-auto h-44 w-44 border border-white/10 text-center sm:h-52 sm:w-52"
                            style={{
                              background: `conic-gradient(${spendGaugeColor} ${spendGaugePercent * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                              boxShadow: `0 0 48px ${spendGaugeColor}33`,
                            }}
                          >
                            <span className="numeric-value text-4xl font-black text-white">
                              {spendGaugePercent}%
                            </span>
                            <span className="absolute mt-16 text-[0.6rem] font-black uppercase tracking-[0.18em] text-slate-500 sm:mt-20">
                              reserve left
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                              Decision engine
                            </p>
                            <p
                              className={`signal-status-pill mt-3 inline-flex px-4 py-3 text-2xl font-black ${spendSignal.tone}`}
                            >
                              {spendSignal.label}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              {spendSignal.description}
                            </p>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              {decisionChecks.map((check) => (
                                <div
                                  className={`signal-check border p-4 ${checkToneClass[check.state]}`}
                                  key={check.label}
                                >
                                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] opacity-75">
                                    {check.label}
                                  </p>
                                  <p className="mt-2 text-xl font-black text-white">
                                    <NumberValue>{check.value}</NumberValue>
                                  </p>
                                  <p className="mt-1 text-xs leading-5 opacity-80">
                                    {check.detail}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="signal-mini-card border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Balance after
                            </p>
                            <p className="mt-2 text-lg font-black text-white">
                              <NumberValue>
                                {isBalanceHidden
                                  ? hiddenBalanceLabel
                                  : formatCurrency(balanceAfterPlannedSpend)}
                              </NumberValue>
                            </p>
                          </div>

                          <SystemReading className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200/80">
                                  Burn runway
                                </p>
                                <p className="mt-2 text-lg font-black text-white">
                                  <NumberValue>
                                    {projectedRunwayDays === null
                                      ? "No burn"
                                      : `${projectedRunwayDays} days`}
                                  </NumberValue>
                                </p>
                              </div>
                              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.8)]" />
                            </div>
                            <div className="runway-track mt-4 h-2 overflow-hidden bg-white/10">
                              <div
                                className="runway-bar h-full"
                                style={{
                                  width:
                                    projectedRunwayDays === null
                                      ? "100%"
                                      : `${Math.max(8, Math.min(100, projectedRunwayDays))}%`,
                                }}
                              />
                            </div>
                          </SystemReading>

                          <div className="signal-mini-card border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Expenses after
                            </p>
                            <p className="mt-2 text-lg font-black text-rose-100">
                              <NumberValue>
                                {formatCurrency(projectedMonthlyExpenses)}
                              </NumberValue>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TerminalPanel>
                </section>

                <DashboardCharts
                  accountBalances={moneyAccountBalances}
                  expenses={activeExpenses}
                  highlightClassName={getSectionHighlightClass(
                    "dashboard-charts",
                  )}
                  isBalanceHidden={isBalanceHidden}
                  moneyAccounts={moneyAccounts}
                />

                <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-6">
                  <TerminalPanel className="!p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                          Recent
                        </p>
                        <h2 className="mt-2 text-xl font-black text-white">
                          Latest transactions
                        </h2>
                      </div>
                      <SharpButton
                        className="min-h-10 px-3 py-2"
                        type="button"
                        onClick={() => openView("transactions")}
                      >
                        View all
                      </SharpButton>
                    </div>

                    <div className="mt-5 space-y-3">
                      {recentActivity.length === 0 ? (
                        <div className="border border-dashed border-cyan-300/20 bg-cyan-300/5 px-4 py-8 text-center text-sm text-slate-400">
                          No transactions yet. Add income, expenses, or
                          transfers to light up your dashboard.
                        </div>
                      ) : (
                        recentActivity.map((activity) => (
                          <article
                            className="cockpit-card flex flex-col gap-3 border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/30 sm:flex-row sm:items-center sm:justify-between"
                            key={activity.id}
                          >
                            <div>
                              <p className="font-bold text-white">
                                {activity.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                {activity.accountLabel} -{" "}
                                {activityDateFormatter.format(
                                  new Date(activity.createdAt),
                                )}
                              </p>
                            </div>
                            <p
                              className={`text-lg font-black ${
                                activity.tone === "income"
                                  ? "text-lime-300"
                                  : activity.tone === "expense"
                                    ? "text-pink-200"
                                    : "text-cyan-200"
                              }`}
                            >
                              <NumberValue>
                                {activity.tone === "expense" ? "-" : ""}
                                {formatCurrency(activity.amount)}
                              </NumberValue>
                            </p>
                          </article>
                        ))
                      )}
                    </div>
                  </TerminalPanel>
                </section>
              </>
            ) : null}

            {activeView === "accounts" ? (
              <MoneyAccounts
                accounts={moneyAccounts}
                accountBalances={moneyAccountBalances}
                highlightClassName={getSectionHighlightClass("money-accounts")}
                isBalanceHidden={isBalanceHidden}
                error={moneyAccountError}
                isLoading={isMoneyAccountLoading}
                onAddAccount={addMoneyAccount}
                onArchiveAccount={archiveMoneyAccount}
              />
            ) : null}

            {activeView === "add" ? (
              <section
                className="mx-auto w-full max-w-5xl px-5 pb-8 pt-5 sm:px-6"
                id="quick-add"
              >
                <TerminalPanel
                  className={`!p-5 transition sm:!p-6 ${getSectionHighlightClass("quick-add")}`}
                >
                  <SectionHeader
                    action={
                      <SegmentedControl
                        className="grid-cols-3"
                        options={quickAddTabs}
                        value={quickAddTab}
                        onChange={setQuickAddTab}
                      />
                    }
                    description={
                      <>
                        Add income, record an expense, or transfer money between
                        your accounts from one compact workspace.
                      </>
                    }
                    eyebrow="Quick Add Command Center"
                    title="Record money movement"
                    tone="cyan"
                  />

                  <div className="mt-5">
                    {quickAddTab === "income" ? (
                      <IncomeForm
                        accountLabel={signedInEmail}
                        isEmbedded
                        moneyAccounts={moneyAccounts}
                        onAddIncome={addIncome}
                        supabaseError={incomeError}
                      />
                    ) : null}

                    {quickAddTab === "expense" ? (
                      <ExpenseForm
                        accountLabel={signedInEmail}
                        isEmbedded
                        moneyAccounts={moneyAccounts}
                        onAddExpense={addExpense}
                        supabaseError={expenseError}
                      />
                    ) : null}

                    {quickAddTab === "transfer" ? (
                      <TransferMoney
                        accountBalances={moneyAccountBalances}
                        accounts={moneyAccounts}
                        error={transferError}
                        isEmbedded
                        onAddTransfer={addTransfer}
                      />
                    ) : null}
                  </div>
                </TerminalPanel>
              </section>
            ) : null}

            {activeView === "transactions" ? (
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
            ) : null}

            {activeView === "reports" ? (
              <>
                <ReportPreview
                  expenses={activeExpenses}
                  highlightClassName={getSectionHighlightClass(
                    "report-preview",
                  )}
                  incomes={activeIncomes}
                  onReportSent={loadEmailReportsFromSupabase}
                />

                <EmailReportHistory
                  emailReports={emailReports}
                  error={emailReportError}
                  isLoading={isEmailReportLoading}
                />
              </>
            ) : null}

            {activeView === "settings" ? (
              <>
                <section className="mx-auto w-full max-w-5xl px-5 pb-6 pt-5 sm:px-6">
                  <TerminalPanel className="!p-5 sm:!p-6">
                    <SectionHeader
                      description="Manage your tutorial, account session, and email report preferences."
                      eyebrow="Settings"
                      title="Account controls"
                      tone="fuchsia"
                    />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <SharpButton
                        type="button"
                        onClick={restartOnboarding}
                      >
                        Restart Tutorial
                      </SharpButton>
                      <SharpButton
                        variant="danger"
                        type="button"
                        onClick={logout}
                      >
                        Log out
                      </SharpButton>
                    </div>
                  </TerminalPanel>
                </section>

                <EmailReportPreferences user={authUser} />
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
