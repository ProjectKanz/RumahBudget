"use client";

import Image from "next/image";
import AuthForm from "@/src/components/auth-form";
import {
  SectionHeader,
  SharpButton,
  SegmentedControl,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import EmailReportHistory from "@/src/components/email-report-history";
import EmailReportPreferences from "@/src/components/email-report-preferences";
import ExpenseForm from "@/src/components/expense-form";
import IncomeForm from "@/src/components/income-form";
import MoneyAccounts from "@/src/components/money-accounts";
import OnboardingTutorial, {
  onboardingStepCount,
} from "@/src/components/onboarding-tutorial";
import OverviewDashboard from "@/src/components/overview-dashboard";
import ReportPreview from "@/src/components/report-preview";
import TransactionHistory from "@/src/components/transaction-history";
import TransferMoney from "@/src/components/transfer-money";
import TradingDashboard from "@/src/components/trading-dashboard";
import SurvivalMatrix from "@/src/components/survival-matrix";
import SystemDiagnostics from "@/src/components/system-diagnostics";
import SandboxControls from "@/src/components/sandbox-controls";
import CommandK from "@/src/components/command-k";
import MoneyAllocationWatch from "@/src/components/money-allocation-watch";
import { calculateDailyAllowance } from "@/src/lib/daily-allowance";
import {
  calculateFinanceSnapshot,
  getHouseholdIncomes,
} from "@/src/lib/finance-calculations";
import {
  calculateTradingSummary,
  validateTradingResultDraft,
} from "@/src/lib/trading-calculations";
import {
  getCalendarMonthKey,
  getCalendarMonthPeriod,
  getRecentCalendarMonths,
} from "@/src/lib/calendar-period";
import { formatCurrency } from "@/src/lib/format";
import {
  getLivingAccountStorageKey,
  parseLivingAccountIds,
  updateLivingAccountPreference,
} from "@/src/lib/living-account-preferences";
import {
  buildOfflineQueueInsert,
  createOfflineQueueItem,
  getUserOfflineQueueStorageKey,
  parseOfflineQueue,
  removeSyncedOfflineQueueItems,
  syncUserOfflineQueue,
} from "@/src/lib/offline-queue";
import {
  getEffectiveRecurringDueDay,
  getRecurringOccurrenceKey,
  shouldProcessRecurringCommitment,
} from "@/src/lib/recurring-schedule";
import {
  DAYS_PER_MONTH,
  calculateBurnProfile,
  calculateFlowProfile,
  calculateRunwayDays,
  calculateRunwayMonths,
  splitBalancesByPurpose,
} from "@/src/lib/runway";
import {
  getCommitmentCycleStatus,
  getDaysUntilDue,
} from "@/src/lib/recurring-occurrence";
import {
  getMillisecondsUntilNextJakartaDay,
  getPayCycle,
} from "@/src/lib/pay-cycle";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import {
  AUTH_SESSION_RESTORE_TIMEOUT_MS,
  clearSupabaseAuthStorage,
  isRecoverableSupabaseAuthError,
  withTimeout,
} from "@/src/lib/supabase-auth-recovery";
import type { EmailReport } from "@/src/types/email-report";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type {
  MoneyAccount,
  MoneyAccountType,
} from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";
import type { TradingResult } from "@/src/types/trading-result";
import type { SandboxTransaction } from "@/src/types/sandbox";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecurringCommitments from "@/src/components/recurring-commitments";
import type { RecurringCommitment } from "@/src/types/recurring-commitment";
import {
  localDateInputToTimestamp,
  timestampToLocalDateInputValue,
  type LedgerTransactionUpdate,
} from "@/src/lib/transaction-entry";

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

const SANDBOX_IMPORT_PARAM = "import";
const MAX_SANDBOX_SHARE_ITEMS = 50;
const MAX_SANDBOX_SHARE_LENGTH = 12000;

function encodeSandboxSharePayload(transactions: SandboxTransaction[]) {
  const payload = JSON.stringify({
    version: 1,
    transactions,
  });
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeSandboxSharePayload(payload: string) {
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return decodeURIComponent(escape(atob(padded)));
}

function validateSandboxTransaction(value: unknown, index: number): SandboxTransaction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SandboxTransaction>;
  const type = candidate.type;
  const timing = candidate.timing;
  const amount = Number(candidate.amount);
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const monthOffset = Number(candidate.monthOffset);

  if (type !== "income" && type !== "expense" && type !== "transfer") {
    return null;
  }
  if (timing !== "recurring" && timing !== "one-time") {
    return null;
  }
  if (!label || label.length > 80) {
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    return null;
  }
  if (timing === "one-time" && (!Number.isInteger(monthOffset) || monthOffset < 1 || monthOffset > 12)) {
    return null;
  }

  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : `shared-${Date.now()}-${index}`,
    type,
    label,
    amount,
    timing,
    monthOffset: timing === "one-time" ? monthOffset : undefined,
  };
}

function parseSandboxImportPayload(payload: string) {
  if (!payload || payload.length > MAX_SANDBOX_SHARE_LENGTH) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeSandboxSharePayload(payload)) as {
      transactions?: unknown;
    };
    if (!Array.isArray(parsed.transactions) || parsed.transactions.length > MAX_SANDBOX_SHARE_ITEMS) {
      return null;
    }

    const transactions = parsed.transactions
      .map((transaction, index) => validateSandboxTransaction(transaction, index))
      .filter((transaction): transaction is SandboxTransaction => Boolean(transaction));

    return transactions.length === parsed.transactions.length ? transactions : null;
  } catch {
    return null;
  }
}
type AppView =
  | "overview"
  | "accounts"
  | "add"
  | "transactions"
  | "reports"
  | "allocation"
  | "trading"
  | "sandbox"
  | "settings";

type OnboardingStepTarget = {
  view: AppView;
  sectionId: string;
  quickAddTab?: QuickAddTab;
};

const appViews: { label: string; value: AppView }[] = [
  { label: "Ringkasan", value: "overview" },
  { label: "Akun", value: "accounts" },
  { label: "Catat", value: "add" },
  { label: "Transaksi", value: "transactions" },
  { label: "Laporan", value: "reports" },
  { label: "Alokasi", value: "allocation" },
  { label: "Trading", value: "trading" },
  { label: "Simulasi", value: "sandbox" },
  { label: "Pengaturan", value: "settings" },
];

const appViewGroups: Array<{
  label: string;
  views: AppView[];
}> = [
  { label: "Utama", views: ["overview"] },
  { label: "Aktivitas", views: ["add", "transactions"] },
  { label: "Akun", views: ["accounts", "reports"] },
  { label: "Perencanaan", views: ["allocation", "trading", "sandbox"] },
  { label: "Pengaturan", views: ["settings"] },
];

const mobilePrimaryViews: AppView[] = [
  "overview",
  "transactions",
  "add",
  "accounts",
];

const mobileMoreViews: AppView[] = [
  "reports",
  "allocation",
  "trading",
  "sandbox",
  "settings",
];

const headerDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
});

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
  description?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  recurring_commitment_id?: string | null;
  recurring_period?: string | null;
  affects_daily_allowance?: boolean | null;
};

type SupabaseIncomeRow = {
  id?: string | number;
  owner?: string | null;
  user_id?: string | null;
  account_id?: string | null;
  amount?: number | string;
  source?: string;
  note?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  affects_daily_allowance?: boolean | null;
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
  account_purpose?: string | null;
  initial_balance?: number | string | null;
  is_archived?: boolean | null;
  created_at?: string | null;
};

type SupabaseTradingResultRow = {
  id?: string | number;
  user_id?: string | null;
  account_id?: string | null;
  transaction_date?: string | null;
  net_amount?: number | string | null;
  note?: string | null;
  source_income_id?: string | null;
  created_at?: string | null;
};

type SupabaseTransferRow = {
  id?: string | number;
  user_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  amount?: number | string | null;
  note?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  affects_daily_allowance?: boolean | null;
};

type SupabaseRecurringCommitmentRow = {
  id?: string | number;
  user_id?: string | null;
  account_id?: string | null;
  name?: string | null;
  amount?: number | string | null;
  category?: string | null;
  commitment_type?: string | null;
  due_day?: number | string | null;
  is_auto_deduct?: boolean | null;
  disable_reminders?: boolean | null;
  last_processed?: string | null;
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

function isMoneyAccountType(value: unknown): value is MoneyAccountType {
  return (
    value === "Bank" ||
    value === "E-Wallet" ||
    value === "Cash" ||
    value === "Investment" ||
    value === "Other"
  );
}

function isRecurringCommitmentType(
  value: unknown,
): value is RecurringCommitment["commitmentType"] {
  return (
    value === "subscription" ||
    value === "installment" ||
    value === "paylater" ||
    value === "rent" ||
    value === "other"
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

function getTransactionTimestamp(
  transactionDate: string | null | undefined,
  createdAt: string | null | undefined,
) {
  const explicitDate = transactionDate
    ? localDateInputToTimestamp(transactionDate)
    : null;

  if (explicitDate) {
    return explicitDate;
  }

  return createdAt ? new Date(createdAt).getTime() : 0;
}

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [emailReports, setEmailReports] = useState<EmailReport[]>([]);
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tradingResults, setTradingResults] = useState<TradingResult[]>([]);
  const [netHourlyWage, setNetHourlyWage] = useState<number>(0);
  const [livingAccountIds, setLivingAccountIds] = useState<string[]>([]);
  const [isLivingPreferenceLoading, setIsLivingPreferenceLoading] =
    useState(false);
  const [isLivingPreferenceUnsynced, setIsLivingPreferenceUnsynced] =
    useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [emailReportError, setEmailReportError] = useState("");
  const [moneyAccountError, setMoneyAccountError] = useState("");
  const [transferError, setTransferError] = useState("");
  const [tradingError, setTradingError] = useState("");
  const [isExpenseLoading, setIsExpenseLoading] = useState(false);
  const [isIncomeLoading, setIsIncomeLoading] = useState(false);
  const [isTransferLoading, setIsTransferLoading] = useState(false);
  const [isTradingLoading, setIsTradingLoading] = useState(false);
  const [isEmailReportLoading, setIsEmailReportLoading] = useState(false);
  const [isMoneyAccountLoading, setIsMoneyAccountLoading] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [autoStartScanTrigger, setAutoStartScanTrigger] = useState(0);
  const [quickAddTab, setQuickAddTab] = useState<QuickAddTab>("income");
  const [highlightedSectionId, setHighlightedSectionId] = useState("");
  const [plannedSpend, setPlannedSpend] = useState("250000");
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [sandboxTransactions, setSandboxTransactions] = useState<SandboxTransaction[]>([]);
  const [sandboxImportNotice, setSandboxImportNotice] = useState("");

  // Recurring Commitments and Offline Caching States
  const [commitments, setCommitments] = useState<RecurringCommitment[]>([]);
  const [isCommitmentsLoading, setIsCommitmentsLoading] = useState(false);
  const [commitmentsError, setCommitmentsError] = useState("");
  const [dbSupportsCommitments, setDbSupportsCommitments] = useState(true);

  const [isOfflineActive, setIsOfflineActive] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [onlineSuccessMessage, setOnlineSuccessMessage] = useState("");
  const [isAutoDeducting, setIsAutoDeducting] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    getCalendarMonthKey(new Date()),
  );
  const [recurringScanTimestamp, setRecurringScanTimestamp] = useState(() =>
    Date.now(),
  );
  const [financialNow, setFinancialNow] = useState(() => Date.now());
  const attemptedRecurringOccurrences = useRef(new Set<string>());
  const offlineSyncUsers = useRef(new Set<string>());
  const mobileMoreTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMoreCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMorePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobileMoreOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMoreCloseButtonRef.current?.focus();

    function handleMobileMoreKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMoreOpen(false);
        window.requestAnimationFrame(() => mobileMoreTriggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !mobileMorePanelRef.current) {
        return;
      }

      const focusableElements = Array.from(
        mobileMorePanelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleMobileMoreKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleMobileMoreKeyDown);
    };
  }, [isMobileMoreOpen]);

  useEffect(() => {
    const storedSandboxMode = window.localStorage.getItem("rumahbudget.isSandboxMode");
    const storedTransactions = window.localStorage.getItem("rumahbudget.sandboxTransactions");
    queueMicrotask(() => {
      if (storedSandboxMode) {
        setIsSandboxMode(storedSandboxMode === "true");
      }
      if (storedTransactions) {
        try {
          setSandboxTransactions(JSON.parse(storedTransactions));
        } catch (e) {
          console.error("Failed to parse sandbox transactions", e);
        }
      }
    });
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const importPayload = url.searchParams.get(SANDBOX_IMPORT_PARAM);

    if (!importPayload) {
      return;
    }

    const importedTransactions = parseSandboxImportPayload(importPayload);
    url.searchParams.delete(SANDBOX_IMPORT_PARAM);
    const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", cleanedUrl || window.location.pathname);

    queueMicrotask(() => {
      if (!importedTransactions) {
        setSandboxImportNotice("Shared sandbox link could not be loaded. The scenario payload is invalid or too large.");
        return;
      }

      setSandboxTransactions(importedTransactions);
      setIsSandboxMode(true);
      setActiveView("sandbox");
      window.localStorage.setItem("rumahbudget.sandboxTransactions", JSON.stringify(importedTransactions));
      window.localStorage.setItem("rumahbudget.isSandboxMode", "true");
      setSandboxImportNotice(`Loaded shared sandbox scenario with ${importedTransactions.length} branch${importedTransactions.length === 1 ? "" : "es"}.`);
    });
  }, []);

  const handleSetSandboxMode = (value: boolean) => {
    setIsSandboxMode(value);
    window.localStorage.setItem("rumahbudget.isSandboxMode", String(value));
  };

  const handleAddSandboxTransaction = (newTx: SandboxTransaction) => {
    const updated = [...sandboxTransactions, newTx];
    setSandboxTransactions(updated);
    window.localStorage.setItem("rumahbudget.sandboxTransactions", JSON.stringify(updated));
  };

  const handleDeleteSandboxTransaction = (id: string) => {
    const updated = sandboxTransactions.filter((tx) => tx.id !== id);
    setSandboxTransactions(updated);
    window.localStorage.setItem("rumahbudget.sandboxTransactions", JSON.stringify(updated));
  };

  const handleShareSandboxTransactions = () => {
    if (sandboxTransactions.length === 0) {
      return "";
    }

    const payload = encodeSandboxSharePayload(sandboxTransactions);
    return `${window.location.origin}/?${SANDBOX_IMPORT_PARAM}=${payload}`;
  };

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
        affectsDailyAllowance: expense.affects_daily_allowance !== false,
        createdAt: getTransactionTimestamp(
          expense.transaction_date,
          expense.created_at,
        ),
        description: expense.description ?? "",
        transactionDate:
          expense.transaction_date ??
          (expense.created_at
            ? timestampToLocalDateInputValue(
                new Date(expense.created_at).getTime(),
              )
            : ""),
        amount: Number(expense.amount ?? 0),
        category: expense.category ?? "Other",
        paymentMethod: expense.payment_method ?? "Unknown",
        note: expense.note ?? "",
        recurringCommitmentId: expense.recurring_commitment_id ?? undefined,
        recurringPeriod: expense.recurring_period ?? undefined,
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
        affectsDailyAllowance: income.affects_daily_allowance !== false,
        createdAt: getTransactionTimestamp(
          income.transaction_date,
          income.created_at,
        ),
        transactionDate:
          income.transaction_date ??
          (income.created_at
            ? timestampToLocalDateInputValue(new Date(income.created_at).getTime())
            : ""),
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
          purpose:
            account.account_purpose === "trading" ? "trading" : "general",
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
    setIsTransferLoading(true);

    if (!authUser) {
      setTransfers([]);
      setIsTransferLoading(false);
      return;
    }

    if (!supabase) {
      setTransferError(missingSupabaseEnvMessage);
      setIsTransferLoading(false);
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
          affectsDailyAllowance: transfer.affects_daily_allowance !== false,
          amount: Number(transfer.amount ?? 0),
          note: transfer.note ?? "",
          createdAt: getTransactionTimestamp(
            transfer.transaction_date,
            transfer.created_at,
          ),
          transactionDate:
            transfer.transaction_date ??
            (transfer.created_at
              ? timestampToLocalDateInputValue(
                  new Date(transfer.created_at).getTime(),
                )
              : ""),
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
      setIsTransferLoading(false);
    }
  }, [authUser]);

  const loadTradingResultsFromSupabase = useCallback(async () => {
    setIsTradingLoading(true);

    if (!authUser) {
      setTradingResults([]);
      setIsTradingLoading(false);
      return;
    }

    if (!supabase) {
      setTradingError(missingSupabaseEnvMessage);
      setIsTradingLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("trading_results")
        .select("*")
        .eq("user_id", authUser.id)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .abortSignal(timeout.signal);

      if (error) {
        setTradingError(error.message);
        setTradingResults([]);
        return;
      }

      const nextTradingResults = (data as SupabaseTradingResultRow[]).map(
        (result): TradingResult => ({
          id: String(result.id ?? crypto.randomUUID()),
          userId: result.user_id ?? authUser.id,
          accountId: result.account_id ?? "",
          transactionDate:
            result.transaction_date ??
            (result.created_at
              ? timestampToLocalDateInputValue(
                  new Date(result.created_at).getTime(),
                )
              : ""),
          netAmount: Number(result.net_amount ?? 0),
          note: result.note ?? "",
          sourceIncomeId: result.source_income_id ?? undefined,
          createdAt: getTransactionTimestamp(
            result.transaction_date,
            result.created_at,
          ),
        }),
      );

      setTradingResults(nextTradingResults);
      setTradingError("");
    } catch (error) {
      setTradingError(
        getSupabaseErrorMessage(
          error,
          "Failed to load Trading data from Supabase.",
        ),
      );
      setTradingResults([]);
    } finally {
      timeout.clear();
      setIsTradingLoading(false);
    }
  }, [authUser]);

  const loadPreferencesFromSupabase = useCallback(async () => {
    if (!authUser) {
      setNetHourlyWage(0);
      return;
    }

    if (!supabase) {
      const localWage = window.localStorage.getItem(`rumahbudget.net_hourly_wage.${authUser.id}`);
      setNetHourlyWage(localWage ? Number(localWage) : 0);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("report_preferences")
        .select("net_hourly_wage")
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal)
        .maybeSingle();

      if (error) {
        if (error.code === "42703" || (error.message && error.message.includes("net_hourly_wage"))) {
          const localWage = window.localStorage.getItem(`rumahbudget.net_hourly_wage.${authUser.id}`);
          setNetHourlyWage(localWage ? Number(localWage) : 0);
        } else {
          console.error("Error loading wage preference:", error.message);
        }
        return;
      }

      if (data && typeof data.net_hourly_wage === "number") {
        setNetHourlyWage(data.net_hourly_wage);
      } else {
        const localWage = window.localStorage.getItem(`rumahbudget.net_hourly_wage.${authUser.id}`);
        setNetHourlyWage(localWage ? Number(localWage) : 0);
      }
    } catch {
      const localWage = window.localStorage.getItem(`rumahbudget.net_hourly_wage.${authUser.id}`);
      setNetHourlyWage(localWage ? Number(localWage) : 0);
    } finally {
      timeout.clear();
    }
  }, [authUser]);

  const loadLivingAccountPreferences = useCallback(async () => {
    if (!authUser) {
      setLivingAccountIds([]);
      setIsLivingPreferenceLoading(false);
      setIsLivingPreferenceUnsynced(false);
      return;
    }

    setIsLivingPreferenceLoading(true);
    const storageKey = getLivingAccountStorageKey(authUser.id);
    const loadLocalPreference = () =>
      parseLivingAccountIds(window.localStorage.getItem(storageKey));

    if (!supabase) {
      setLivingAccountIds(loadLocalPreference());
      setIsLivingPreferenceUnsynced(true);
      setIsLivingPreferenceLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();
    try {
      const { data, error } = await supabase
        .from("report_preferences")
        .select("living_account_ids")
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal)
        .maybeSingle();

      if (error) {
        setLivingAccountIds(loadLocalPreference());
        setIsLivingPreferenceUnsynced(true);
        if (
          error.code !== "42703" &&
          !error.message?.includes("living_account_ids")
        ) {
          console.error("Error loading living-account preferences:", error.message);
        }
        return;
      }

      if (!data) {
        setLivingAccountIds(loadLocalPreference());
        setIsLivingPreferenceUnsynced(true);
        return;
      }

      const remoteIds = parseLivingAccountIds(data.living_account_ids);
      setLivingAccountIds(remoteIds);
      window.localStorage.setItem(storageKey, JSON.stringify(remoteIds));
      setIsLivingPreferenceUnsynced(false);
    } catch (error) {
      setLivingAccountIds(loadLocalPreference());
      setIsLivingPreferenceUnsynced(true);
      console.error(
        "Error loading living-account preferences:",
        getSupabaseErrorMessage(error, "Preference request failed."),
      );
    } finally {
      timeout.clear();
      setIsLivingPreferenceLoading(false);
    }
  }, [authUser]);

  const loadCommitmentsFromSupabase = useCallback(async () => {
    setIsCommitmentsLoading(true);
    setCommitmentsError("");

    if (!authUser) {
      setCommitments([]);
      setIsCommitmentsLoading(false);
      return;
    }

    const localCommitmentsKey = `rumahbudget.localCommitments.${authUser.id}`;

    if (!supabase) {
      const localData = window.localStorage.getItem(localCommitmentsKey);
      if (localData) {
        try {
          setCommitments(JSON.parse(localData));
        } catch {
          setCommitments([]);
        }
      } else {
        setCommitments([]);
      }
      setIsCommitmentsLoading(false);
      return;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { data, error } = await supabase
        .from("recurring_commitments")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .abortSignal(timeout.signal);

      if (error) {
        if (error.code === "42P01") {
          setDbSupportsCommitments(false);
          const localData = window.localStorage.getItem(localCommitmentsKey);
          if (localData) {
            setCommitments(JSON.parse(localData));
          } else {
            setCommitments([]);
          }
          return;
        }
        setCommitmentsError(error.message);
        return;
      }

      const nextCommitments = ((data as SupabaseRecurringCommitmentRow[]) || []).map((c): RecurringCommitment => ({
        id: String(c.id ?? crypto.randomUUID()),
        userId: c.user_id ?? authUser.id,
        accountId: c.account_id ?? null,
        name: c.name ?? "Untitled commitment",
        amount: Number(c.amount ?? 0),
        category: c.category ?? "Other",
        commitmentType: isRecurringCommitmentType(c.commitment_type)
          ? c.commitment_type
          : "other",
        dueDay: Number(c.due_day ?? 1),
        isAutoDeduct: Boolean(c.is_auto_deduct),
        disableReminders: Boolean(c.disable_reminders),
        lastProcessed: c.last_processed ?? null,
        createdAt: c.created_at ? new Date(c.created_at).getTime() : 0,
      }));

      setCommitments(nextCommitments);
    } catch (err) {
      setCommitmentsError(getSupabaseErrorMessage(err, "Failed to load commitments."));
    } finally {
      timeout.clear();
      setIsCommitmentsLoading(false);
    }
  }, [authUser]);

  async function addCommitment(c: Omit<RecurringCommitment, "id" | "userId" | "createdAt" | "lastProcessed">) {
    if (!authUser) return false;

    const localCommitmentsKey = `rumahbudget.localCommitments.${authUser.id}`;

    if (!supabase || !dbSupportsCommitments) {
      const localData = window.localStorage.getItem(localCommitmentsKey);
      const localComs: RecurringCommitment[] = localData ? JSON.parse(localData) : [];
      const newCommitment: RecurringCommitment = {
        ...c,
        id: crypto.randomUUID(),
        userId: authUser.id,
        createdAt: Date.now(),
        lastProcessed: null,
      };
      const updated = [newCommitment, ...localComs];
      window.localStorage.setItem(localCommitmentsKey, JSON.stringify(updated));
      setCommitments(updated);
      return true;
    }

    const timeout = createSupabaseTimeout();
    try {
      const { error } = await supabase
        .from("recurring_commitments")
        .insert({
          user_id: authUser.id,
          account_id: c.accountId,
          name: c.name,
          amount: c.amount,
          category: c.category,
          commitment_type: c.commitmentType,
          due_day: c.dueDay,
          is_auto_deduct: c.isAutoDeduct,
          disable_reminders: c.disableReminders,
        })
        .abortSignal(timeout.signal);

      if (error) {
        setCommitmentsError(error.message);
        return false;
      }

      await loadCommitmentsFromSupabase();
      return true;
    } catch (err) {
      setCommitmentsError(getSupabaseErrorMessage(err, "Failed to save commitment."));
      return false;
    } finally {
      timeout.clear();
    }
  }

  async function deleteCommitment(id: string) {
    if (!authUser) return;

    const localCommitmentsKey = `rumahbudget.localCommitments.${authUser.id}`;

    if (!supabase || !dbSupportsCommitments) {
      const localData = window.localStorage.getItem(localCommitmentsKey);
      if (localData) {
        const localComs: RecurringCommitment[] = JSON.parse(localData);
        const updated = localComs.filter((c) => c.id !== id);
        window.localStorage.setItem(localCommitmentsKey, JSON.stringify(updated));
        setCommitments(updated);
      }
      return;
    }

    const timeout = createSupabaseTimeout();
    try {
      const { error } = await supabase
        .from("recurring_commitments")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id)
        .abortSignal(timeout.signal);

      if (error) {
        setCommitmentsError(error.message);
        return;
      }

      await loadCommitmentsFromSupabase();
    } catch (err) {
      setCommitmentsError(getSupabaseErrorMessage(err, "Failed to delete commitment."));
    } finally {
      timeout.clear();
    }
  }

  const syncOfflineQueue = useCallback(async () => {
    if (!supabase || !authUser) return;
    const supabaseClient = supabase;
    const userId = authUser.id;

    if (offlineSyncUsers.current.has(userId)) {
      return;
    }
    offlineSyncUsers.current.add(userId);

    const storageKey = getUserOfflineQueueStorageKey(userId);
    const queue = parseOfflineQueue(localStorage.getItem(storageKey));
    if (queue.length === 0) {
      offlineSyncUsers.current.delete(userId);
      return;
    }

    try {
      const result = await syncUserOfflineQueue({
        items: queue,
        userId,
        syncItem: async (item) => {
          const insert = buildOfflineQueueInsert(
            item,
            userId,
            authUser.email ?? null,
          );
          const { error } = await supabaseClient
            .from(insert.table)
            .upsert(insert.values, {
              ignoreDuplicates: true,
              onConflict: "user_id,client_entry_id",
            });
          return !error;
        },
      });

      const latestQueue = parseOfflineQueue(localStorage.getItem(storageKey));
      const committedQueue = removeSyncedOfflineQueueItems(
        latestQueue,
        result.syncedItemIds,
      );
      if (committedQueue.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(committedQueue));
      } else {
        localStorage.removeItem(storageKey);
      }
      setOfflineQueueCount(committedQueue.length);

      if (result.syncedCount > 0) {
        setOnlineSuccessMessage(
          `Connection restored. ${result.syncedCount} transaction(s) synced${
            result.failedCount > 0
              ? `; ${result.failedCount} retained for retry.`
              : "."
          }`,
        );
        void loadExpensesFromSupabase();
        void loadIncomesFromSupabase();
        void loadTransfersFromSupabase();
        void loadMoneyAccountsFromSupabase();

        setTimeout(() => {
          setOnlineSuccessMessage("");
        }, 5000);
      }
    } finally {
      offlineSyncUsers.current.delete(userId);
    }
  }, [
    authUser,
    loadExpensesFromSupabase,
    loadIncomesFromSupabase,
    loadMoneyAccountsFromSupabase,
    loadTransfersFromSupabase,
  ]);

  // Offline status & Queue handler
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      setIsOfflineActive(!isOnline);

      if (isOnline) {
        void syncOfflineQueue();
      }
    };

    queueMicrotask(() => {
      if (authUser) {
        const storageKey = getUserOfflineQueueStorageKey(authUser.id);
        setOfflineQueueCount(
          parseOfflineQueue(localStorage.getItem(storageKey)).length,
        );
        if (navigator.onLine) {
          void syncOfflineQueue();
        }
      }

      setIsOfflineActive(!navigator.onLine);
    });

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [authUser, syncOfflineQueue]);

  const processCommitmentOnce = useCallback(
    async (
      commitment: RecurringCommitment,
      mode: "auto" | "manual" = "auto",
    ) => {
      if (!supabase || !authUser || !dbSupportsCommitments) {
        setCommitmentsError(
          "Recurring payment requires the approved database migration.",
        );
        return false;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        setCommitmentsError("Please sign in again before recording payment.");
        return false;
      }

      let response: Response;
      try {
        response = await fetch("/api/recurring-commitments/process", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ commitmentId: commitment.id, mode }),
        });
      } catch (error) {
        setCommitmentsError(
          getSupabaseErrorMessage(
            error,
            "Network error while recording recurring payment.",
          ),
        );
        return false;
      }
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setCommitmentsError(
          result?.error ?? "Failed to record recurring payment.",
        );
        return false;
      }

      setCommitmentsError("");
      return true;
    },
    [authUser, dbSupportsCommitments],
  );

  const syncAutoDeducts = useCallback(
    async (commitmentsToProcess: RecurringCommitment[]) => {
      setIsAutoDeducting(true);
      const failedCommitments: RecurringCommitment[] = [];
      try {
        for (const commitment of commitmentsToProcess) {
          if (!(await processCommitmentOnce(commitment, "auto"))) {
            failedCommitments.push(commitment);
          }
        }
        await loadExpensesFromSupabase();
        await loadCommitmentsFromSupabase();
      } finally {
        setIsAutoDeducting(false);
      }

      if (failedCommitments.length > 0 && authUser) {
        window.setTimeout(() => {
          for (const commitment of failedCommitments) {
            const keyPrefix = `${authUser.id}:${commitment.id}:`;
            for (const attemptedKey of attemptedRecurringOccurrences.current) {
              if (attemptedKey.startsWith(keyPrefix)) {
                attemptedRecurringOccurrences.current.delete(attemptedKey);
              }
            }
          }
          setRecurringScanTimestamp(Date.now());
        }, 60_000);
      }
    }, [
      authUser,
      loadCommitmentsFromSupabase,
      loadExpensesFromSupabase,
      processCommitmentOnce,
    ],
  );

  async function recordCommitmentPayment(commitment: RecurringCommitment) {
    if (isAutoDeducting) {
      return;
    }

    setIsAutoDeducting(true);
    try {
      if (await processCommitmentOnce(commitment, "manual")) {
        await loadExpensesFromSupabase();
        await loadCommitmentsFromSupabase();
      }
    } finally {
      setIsAutoDeducting(false);
    }
  }

  async function muteCommitmentReminders(c: RecurringCommitment) {
    if (supabase && dbSupportsCommitments && authUser) {
      await supabase
        .from("recurring_commitments")
        .update({ disable_reminders: true })
        .eq("id", c.id)
        .eq("user_id", authUser.id);
    } else {
      if (!authUser) {
        return;
      }
      const localCommitmentsKey = `rumahbudget.localCommitments.${authUser.id}`;
      const localData = localStorage.getItem(localCommitmentsKey);
      if (localData) {
        const localCommitments: RecurringCommitment[] = JSON.parse(localData);
        const updatedCommitments = localCommitments.map((commitment) =>
          commitment.id === c.id
            ? { ...commitment, disableReminders: true }
            : commitment,
        );
        localStorage.setItem(localCommitmentsKey, JSON.stringify(updatedCommitments));
      }
    }

    await loadCommitmentsFromSupabase();
  }

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

      void withTimeout(
        supabase.auth.getSession(),
        AUTH_SESSION_RESTORE_TIMEOUT_MS,
      )
        .then(({ data, error }) => {
          if (!isMounted) {
            return;
          }

          if (error) {
            console.error("Session restore error:", error);
            if (isRecoverableSupabaseAuthError(error)) {
              if (supabase) {
                void supabase.auth.signOut().catch(() => {});
              }

              clearSupabaseAuthStorage();

              setAuthUser(null);
              setIsAuthLoading(false);
              return;
            }
          }

          setAuthUser(data.session?.user ?? null);
        })
        .catch((err) => {
          if (!isMounted) {
            return;
          }
          console.error("Unexpected session catch error:", err);

          if (isRecoverableSupabaseAuthError(err)) {
            if (supabase) {
              void supabase.auth.signOut().catch(() => {});
            }

            clearSupabaseAuthStorage();
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
        setTradingResults([]);
        setNetHourlyWage(0);
        setLivingAccountIds([]);
        setIsLivingPreferenceUnsynced(false);
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
      void loadTradingResultsFromSupabase();
      void loadPreferencesFromSupabase();
      void loadLivingAccountPreferences();
      void loadCommitmentsFromSupabase();
    });
  }, [
    authUser,
    loadEmailReportsFromSupabase,
    loadExpensesFromSupabase,
    loadIncomesFromSupabase,
    loadMoneyAccountsFromSupabase,
    loadTransfersFromSupabase,
    loadTradingResultsFromSupabase,
    loadPreferencesFromSupabase,
    loadLivingAccountPreferences,
    loadCommitmentsFromSupabase,
  ]);

  useEffect(() => {
    const now = new Date();
    const nextLocalDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      5,
    );
    const timeoutId = window.setTimeout(
      () => setRecurringScanTimestamp(Date.now()),
      nextLocalDay.getTime() - now.getTime(),
    );

    return () => window.clearTimeout(timeoutId);
  }, [recurringScanTimestamp]);

  useEffect(() => {
    const refreshFinancialNow = () => setFinancialNow(Date.now());
    const timeoutId = window.setTimeout(
      refreshFinancialNow,
      getMillisecondsUntilNextJakartaDay(new Date(financialNow)) + 100,
    );

    window.addEventListener("focus", refreshFinancialNow);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refreshFinancialNow);
    };
  }, [financialNow]);

  // Scan and trigger Auto-Deduct once per commitment occurrence.
  useEffect(() => {
    if (!authUser || isMoneyAccountLoading || isAutoDeducting) {
      return;
    }

    const today = new Date(recurringScanTimestamp);

    const toAutoDeduct = commitments.filter(
      (commitment) => {
        const occurrenceKey = `${authUser.id}:${getRecurringOccurrenceKey(
          commitment.id,
          today,
        )}`;
        return (
          !attemptedRecurringOccurrences.current.has(occurrenceKey) &&
          shouldProcessRecurringCommitment({
          dueDay: commitment.dueDay,
          isAutoDeduct: commitment.isAutoDeduct,
          lastProcessed: commitment.lastProcessed,
          now: today,
          })
        );
      },
    );

    if (toAutoDeduct.length > 0) {
      for (const commitment of toAutoDeduct) {
        attemptedRecurringOccurrences.current.add(
          `${authUser.id}:${getRecurringOccurrenceKey(commitment.id, today)}`,
        );
      }
      queueMicrotask(() => {
        void syncAutoDeducts(toAutoDeduct);
      });
    }
  }, [
    authUser,
    commitments,
    isAutoDeducting,
    isMoneyAccountLoading,
    recurringScanTimestamp,
    syncAutoDeducts,
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
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        document
          .getElementById(target.sectionId)
          ?.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "center",
          });
        setHighlightedSectionId(target.sectionId);
      }, 80);
    });
  }, [isOnboardingOpen, onboardingStep]);

  const activeExpenses = expenses;

  const activeIncomes = useMemo(
    () => getHouseholdIncomes(incomes, tradingResults),
    [incomes, tradingResults],
  );
  const signedInEmail = authUser?.email ?? "Signed-in account";
  const selectedMonth = useMemo(
    () =>
      getCalendarMonthPeriod(selectedMonthKey) ??
      getCalendarMonthPeriod(getCalendarMonthKey(new Date())),
    [selectedMonthKey],
  );
  const recentMonthOptions = useMemo(
    () => getRecentCalendarMonths(new Date(), 12),
    [],
  );

  const financeSnapshot = useMemo(
    () =>
      calculateFinanceSnapshot({
        accounts: moneyAccounts,
        expenses: activeExpenses,
        incomes: activeIncomes,
        transfers,
        tradingResults,
        periodReference: selectedMonth?.start.getTime(),
      }),
    [
      activeExpenses,
      activeIncomes,
      moneyAccounts,
      selectedMonth,
      tradingResults,
      transfers,
    ],
  );
  const monthlyExpenses = financeSnapshot.monthlyExpenses;
  const monthlyIncomes = financeSnapshot.monthlyIncomes;

  const totalExpense = useMemo(() => {
    const actual = financeSnapshot.monthlyExpense;
    if (isSandboxMode) {
      const sandboxOutflow = sandboxTransactions
        .filter((tx) => tx.type === "expense" && tx.timing === "recurring")
        .reduce((sum, tx) => sum + tx.amount, 0);
      return actual + sandboxOutflow;
    }
    return actual;
  }, [financeSnapshot.monthlyExpense, isSandboxMode, sandboxTransactions]);

  const totalIncome = useMemo(() => {
    const actual = financeSnapshot.monthlyIncome;
    if (isSandboxMode) {
      const sandboxInflow = sandboxTransactions
        .filter((tx) => tx.type === "income" && tx.timing === "recurring")
        .reduce((sum, tx) => sum + tx.amount, 0);
      return actual + sandboxInflow;
    }
    return actual;
  }, [financeSnapshot.monthlyIncome, isSandboxMode, sandboxTransactions]);

  const moneyAccountBalances = financeSnapshot.accountBalances;
  const tradingSummary = useMemo(
    () =>
      calculateTradingSummary({
        accounts: moneyAccounts,
        accountBalances: moneyAccountBalances,
        transfers,
        tradingResults,
        periodReference: selectedMonth?.start.getTime() ?? financialNow,
      }),
    [
      moneyAccountBalances,
      moneyAccounts,
      financialNow,
      selectedMonth,
      tradingResults,
      transfers,
    ],
  );
  const currentPayCycle = useMemo(
    () => getPayCycle(new Date(financialNow)),
    [financialNow],
  );
  const dailyAllowanceResult = useMemo(
    () =>
      calculateDailyAllowance({
        accountBalances: moneyAccountBalances,
        accounts: moneyAccounts,
        commitments,
        expenses: activeExpenses,
        incomes: activeIncomes,
        livingAccountIds,
        payCycle: currentPayCycle,
        transfers,
      }),
    [
      activeExpenses,
      activeIncomes,
      commitments,
      currentPayCycle,
      livingAccountIds,
      moneyAccountBalances,
      moneyAccounts,
      transfers,
    ],
  );
  // Reminders follow the pay cycle, not the calendar month. Keyed to the month
  // it happened to be viewed in, a bill due on the 16th read as overdue on the
  // 25th even though its next occurrence was three weeks away.
  const approachingCommitments = useMemo(
    () =>
      commitments.filter((commitment) => {
        if (commitment.isAutoDeduct || commitment.disableReminders) {
          return false;
        }

        const status = getCommitmentCycleStatus({
          commitment,
          expenses: activeExpenses,
          payCycle: currentPayCycle,
        });
        if (!status || status.isPaid) {
          return false;
        }

        const daysUntilDue = getDaysUntilDue(
          status.occurrence.dueDateKey,
          currentPayCycle.todayKey,
        );
        return daysUntilDue !== null && daysUntilDue <= 3;
      }),
    [activeExpenses, commitments, currentPayCycle],
  );

  const isCurrentSummaryMonth =
    selectedMonthKey === currentPayCycle.todayKey.slice(0, 7);

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

  const totalBalance = useMemo(() => {
    const actual = financeSnapshot.totalBalance;
    if (isSandboxMode) {
      const sandboxNet = sandboxTransactions
        .filter((tx) => tx.timing === "recurring")
        .reduce((sum, tx) => {
          if (tx.type === "income") return sum + tx.amount;
          if (tx.type === "expense") return sum - tx.amount;
          return sum;
        }, 0);
      return actual + sandboxNet;
    }
    return actual;
  }, [financeSnapshot.totalBalance, isSandboxMode, sandboxTransactions]);

  const recurringSandboxOutflow = useMemo(
    () =>
      isSandboxMode
        ? sandboxTransactions
            .filter((tx) => tx.type === "expense" && tx.timing === "recurring")
            .reduce((sum, tx) => sum + tx.amount, 0)
        : 0,
    [isSandboxMode, sandboxTransactions],
  );

  const burnProfile = useMemo(
    () => calculateBurnProfile({ expenses: activeExpenses, now: new Date(financialNow) }),
    [activeExpenses, financialNow],
  );

  // One burn rate feeds every reading, so the monthly and daily runways on the
  // Overview can never disagree with each other.
  const averageDailyBurn =
    burnProfile.averageDailyBurn + recurringSandboxOutflow / DAYS_PER_MONTH;
  const averageMonthlyBurn =
    burnProfile.averageMonthlyBurn + recurringSandboxOutflow;

  // Measured over the same window as the burn rate. The stress test used to
  // compare one month of income against a lifetime spending average.
  const averageMonthlyIncome = useMemo(
    () =>
      calculateFlowProfile({
        entries: activeIncomes,
        now: new Date(financialNow),
      }).averageMonthlyBurn,
    [activeIncomes, financialNow],
  );

  const householdAccounts = useMemo(
    () => moneyAccounts.filter((account) => account.purpose !== "trading"),
    [moneyAccounts],
  );
  const { householdBalance, tradingBalance } = useMemo(
    () => splitBalancesByPurpose(moneyAccounts, moneyAccountBalances),
    [moneyAccountBalances, moneyAccounts],
  );

  // Runway spends household cash. A broker balance is real money but it is not
  // what pays next week's groceries, so it is reported separately instead.
  const runwayBalance = isSandboxMode
    ? householdBalance + (totalBalance - financeSnapshot.totalBalance)
    : householdBalance;
  const survivalRunwayMonths = calculateRunwayMonths(
    runwayBalance,
    averageMonthlyBurn,
  );

  const remainingBalance = totalIncome - totalExpense;
  const cashflowPeriodLabel = selectedMonth?.label ?? "selected period";
  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;
  const monthlyStatus: MonthlyStatus =
    totalIncome === 0 && totalExpense > 0
      ? totalBalance <= 0
        ? {
            label: "Critical",
            explanation:
              `You have expenses in ${cashflowPeriodLabel}, no income recorded, and your current Total Account Balance is not positive.`,
            className: "text-rose-300",
          }
        : {
            label: "No income recorded",
            explanation:
              `You have expenses in ${cashflowPeriodLabel}, but no income was recorded. These expenses are being paid from your current account balance.`,
            className: "text-cyan-200",
          }
      : totalIncome > 0 && totalExpense > totalIncome
        ? {
            label: "Critical",
            explanation:
              totalBalance > 0
                ? `Expenses exceed recorded income in ${cashflowPeriodLabel}, but your current Total Account Balance is still positive.`
                : `Expenses exceed recorded income in ${cashflowPeriodLabel} and your current Total Account Balance is not positive.`,
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

  const plannedSpendAmount = Number(plannedSpend);
  const safePlannedSpendAmount =
    Number.isFinite(plannedSpendAmount) && plannedSpendAmount > 0
      ? plannedSpendAmount
      : 0;
  const balanceAfterPlannedSpend = runwayBalance - safePlannedSpendAmount;
  const runwayDays = calculateRunwayDays(runwayBalance, averageDailyBurn);
  const projectedMonthlyExpenses = totalExpense + safePlannedSpendAmount;
  const projectedNetCashflow = totalIncome - projectedMonthlyExpenses;
  // A one-off purchase shortens the runway by draining the reserve; it does not
  // permanently raise the burn rate, so the same rate is used on both sides.
  const projectedRunwayDays = calculateRunwayDays(
    balanceAfterPlannedSpend,
    averageDailyBurn,
  );
  const spendGaugePercent =
    runwayBalance > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((balanceAfterPlannedSpend / runwayBalance) * 100),
          ),
        )
      : 0;
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
              tone: isSandboxMode ? "text-amber-200" : "text-cyan-200",
              description:
                `Possible, but ${cashflowPeriodLabel} has no recorded income, so this uses the current balance.`,
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
      detail:
        totalIncome === 0
          ? `recorded in ${cashflowPeriodLabel}`
          : `${cashflowPeriodLabel} expense load`,
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
    if (!authUser) {
      setExpenseError("Please log in before saving an expense.");
      return false;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const storageKey = getUserOfflineQueueStorageKey(authUser.id);
      const queue = parseOfflineQueue(localStorage.getItem(storageKey));
      queue.push(
        createOfflineQueueItem({
          id: expense.id,
          userId: authUser.id,
          type: "expense",
          data: {
            accountId: expense.accountId,
            affectsDailyAllowance: expense.affectsDailyAllowance !== false,
            amount: expense.amount,
            category: expense.category,
            createdAt: expense.createdAt,
            description: expense.description ?? "",
            note: expense.note,
            paymentMethod: expense.paymentMethod,
          },
        }),
      );
      localStorage.setItem(storageKey, JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setExpenses((prev) => [
        {
          ...expense,
          owner: authUser?.email ?? "Offline user",
          userId: authUser.id,
        },
        ...prev,
      ]);
      return true;
    }

    if (!supabase) {
      setExpenseError(missingSupabaseEnvMessage);
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
          affects_daily_allowance: expense.affectsDailyAllowance !== false,
          amount: expense.amount,
          category: expense.category,
          client_entry_id: expense.id,
          created_at: new Date(expense.createdAt).toISOString(),
          description: expense.description ?? "",
          payment_method: expense.paymentMethod,
          note: expense.note,
          transaction_date:
            expense.transactionDate ??
            timestampToLocalDateInputValue(expense.createdAt),
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
    if (!authUser) {
      setIncomeError("Please log in before saving income.");
      return false;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const storageKey = getUserOfflineQueueStorageKey(authUser.id);
      const queue = parseOfflineQueue(localStorage.getItem(storageKey));
      queue.push(
        createOfflineQueueItem({
          id: income.id,
          userId: authUser.id,
          type: "income",
          data: {
            accountId: income.accountId,
            affectsDailyAllowance: income.affectsDailyAllowance !== false,
            amount: income.amount,
            createdAt: income.createdAt,
            note: income.note,
            source: income.source,
          },
        }),
      );
      localStorage.setItem(storageKey, JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setIncomes((prev) => [
        {
          ...income,
          owner: authUser?.email ?? "Offline user",
          userId: authUser.id,
        },
        ...prev,
      ]);
      return true;
    }

    if (!supabase) {
      setIncomeError(missingSupabaseEnvMessage);
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
          affects_daily_allowance: income.affectsDailyAllowance !== false,
          amount: income.amount,
          client_entry_id: income.id,
          created_at: new Date(income.createdAt).toISOString(),
          source: income.source,
          note: income.note,
          transaction_date:
            income.transactionDate ??
            timestampToLocalDateInputValue(income.createdAt),
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

  async function updateTransaction(update: LedgerTransactionUpdate) {
    if (!supabase || !authUser) {
      const message = !authUser
        ? "Please log in before editing a transaction."
        : missingSupabaseEnvMessage;
      setExpenseError(message);
      return false;
    }

    const transactionTimestamp = localDateInputToTimestamp(
      update.transactionDate,
    );
    if (!transactionTimestamp) {
      setExpenseError("Choose a valid transaction date.");
      return false;
    }

    const table =
      update.type === "expense"
        ? "expenses"
        : update.type === "income"
          ? "incomes"
          : "transfers";
    const values =
      update.type === "expense"
        ? {
            account_id: update.accountId,
            amount: update.amount,
            category: update.category,
            created_at: new Date(transactionTimestamp).toISOString(),
            description: update.description,
            note: update.note,
            payment_method: update.paymentMethod,
            transaction_date: update.transactionDate,
          }
        : update.type === "income"
          ? {
              account_id: update.accountId,
              amount: update.amount,
              created_at: new Date(transactionTimestamp).toISOString(),
              note: update.note,
              source: update.source,
              transaction_date: update.transactionDate,
            }
          : {
              amount: update.amount,
              created_at: new Date(transactionTimestamp).toISOString(),
              from_account_id: update.fromAccountId,
              note: update.note,
              to_account_id: update.toAccountId,
              transaction_date: update.transactionDate,
            };

    const { error } = await supabase
      .from(table)
      .update(values)
      .eq("id", update.id)
      .eq("user_id", authUser.id);

    if (error) {
      if (update.type === "income") setIncomeError(error.message);
      else if (update.type === "transfer") setTransferError(error.message);
      else setExpenseError(error.message);
      return false;
    }

    if (update.type === "income") await loadIncomesFromSupabase();
    else if (update.type === "transfer") await loadTransfersFromSupabase();
    else await loadExpensesFromSupabase();
    return true;
  }

  async function saveLivingAccountIds(nextIds: string[]) {
    if (!authUser) return;

    const normalizedIds = parseLivingAccountIds(nextIds);
    const storageKey = getLivingAccountStorageKey(authUser.id);
    setLivingAccountIds(normalizedIds);
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedIds));

    if (!supabase) {
      setIsLivingPreferenceUnsynced(true);
      return;
    }

    setIsLivingPreferenceLoading(true);
    const timeout = createSupabaseTimeout();
    try {
      const { error } = await updateLivingAccountPreference(
        supabase.from("report_preferences"),
        {
          livingAccountIds: normalizedIds,
          signal: timeout.signal,
          updatedAt: new Date().toISOString(),
          userId: authUser.id,
        },
      );

      if (error) {
        setIsLivingPreferenceUnsynced(true);
        if (
          error.code !== "42703" &&
          !error.message?.includes("living_account_ids")
        ) {
          console.error("Error saving living-account preferences:", error.message);
        }
        return;
      }

      setIsLivingPreferenceUnsynced(false);
    } catch (error) {
      setIsLivingPreferenceUnsynced(true);
      console.error(
        "Error saving living-account preferences:",
        getSupabaseErrorMessage(error, "Preference save failed."),
      );
    } finally {
      timeout.clear();
      setIsLivingPreferenceLoading(false);
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

  async function addTradingResult(draft: {
    accountId: string;
    transactionDate: string;
    netAmount: number;
    note: string;
  }) {
    if (!authUser) {
      setTradingError("Please log in before saving a Trading result.");
      return false;
    }

    if (!supabase) {
      setTradingError(missingSupabaseEnvMessage);
      return false;
    }

    const validation = validateTradingResultDraft({
      accountId: draft.accountId,
      transactionDate: draft.transactionDate,
      netAmount: draft.netAmount,
      accounts: moneyAccounts,
      userId: authUser.id,
    });
    if (!validation.ok) {
      setTradingError(validation.error);
      return false;
    }

    const timeout = createSupabaseTimeout();
    setIsTradingLoading(true);

    try {
      const { error } = await supabase
        .from("trading_results")
        .insert({
          user_id: authUser.id,
          account_id: validation.value.accountId,
          transaction_date: validation.value.transactionDate,
          net_amount: validation.value.netAmount,
          note: draft.note.trim(),
        })
        .abortSignal(timeout.signal);

      if (error) {
        setTradingError(error.message);
        return false;
      }

      await loadTradingResultsFromSupabase();
      return true;
    } catch (error) {
      setTradingError(
        getSupabaseErrorMessage(
          error,
          "Failed to save Trading result to Supabase.",
        ),
      );
      return false;
    } finally {
      timeout.clear();
      setIsTradingLoading(false);
    }
  }

  async function deleteTradingResult(id: string) {
    const result = tradingResults.find((candidate) => candidate.id === id);
    if (!result || result.sourceIncomeId) {
      setTradingError("Migrated Trading results cannot be deleted here.");
      return;
    }

    if (!authUser || !supabase) {
      setTradingError(
        authUser
          ? missingSupabaseEnvMessage
          : "Please log in before deleting a Trading result.",
      );
      return;
    }

    const timeout = createSupabaseTimeout();
    setIsTradingLoading(true);

    try {
      const { error } = await supabase
        .from("trading_results")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id)
        .is("source_income_id", null)
        .abortSignal(timeout.signal);

      if (error) {
        setTradingError(error.message);
        return;
      }

      await loadTradingResultsFromSupabase();
    } catch (error) {
      setTradingError(
        getSupabaseErrorMessage(
          error,
          "Failed to delete Trading result from Supabase.",
        ),
      );
    } finally {
      timeout.clear();
      setIsTradingLoading(false);
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
    affectsDailyAllowance: boolean;
    amount: number;
    fromAccountId: string;
    note: string;
    toAccountId: string;
  }) {
    if (!authUser) {
      setTransferError("Please log in before saving a transfer.");
      return false;
    }

    const createdAt = Date.now();
    const clientEntryId = crypto.randomUUID();

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const storageKey = getUserOfflineQueueStorageKey(authUser.id);
      const queue = parseOfflineQueue(localStorage.getItem(storageKey));
      queue.push(
        createOfflineQueueItem({
          id: clientEntryId,
          userId: authUser.id,
          type: "transfer",
          data: { ...transfer, createdAt },
        }),
      );
      localStorage.setItem(storageKey, JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setTransfers((prev) => [
        {
          id: clientEntryId,
          userId: authUser.id,
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          affectsDailyAllowance: transfer.affectsDailyAllowance,
          amount: transfer.amount,
          note: transfer.note,
          createdAt,
          transactionDate: timestampToLocalDateInputValue(createdAt),
        },
        ...prev,
      ]);
      return true;
    }

    if (!supabase) {
      setTransferError(missingSupabaseEnvMessage);
      return false;
    }

    const timeout = createSupabaseTimeout();

    try {
      const { error } = await supabase
        .from("transfers")
        .insert({
          user_id: authUser.id,
          affects_daily_allowance: transfer.affectsDailyAllowance,
          from_account_id: transfer.fromAccountId,
          to_account_id: transfer.toAccountId,
          amount: transfer.amount,
          client_entry_id: clientEntryId,
          created_at: new Date(createdAt).toISOString(),
          note: transfer.note,
          transaction_date: timestampToLocalDateInputValue(createdAt),
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
      ? "ledger-highlight"
      : "";
  }

  function openView(view: AppView) {
    setActiveView(view);
    setHighlightedSectionId("");
    setIsMobileMoreOpen(false);
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      top: 0,
    });
  }

  function closeMobileMoreSheet() {
    setIsMobileMoreOpen(false);
    window.requestAnimationFrame(() => mobileMoreTriggerRef.current?.focus());
  }

  async function logout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  return (
    <main
      className={`rb-app ledger-app min-h-screen text-white ${
        isSandboxMode ? "sandbox-active" : ""
      }`}
      id="main-content"
    >
      <div className="rb-status-stack">
        {isOfflineActive ? (
          <div className="rb-status rb-status--danger" role="alert">
            Koneksi terputus. {offlineQueueCount} transaksi menunggu sinkronisasi.
          </div>
        ) : null}
        {onlineSuccessMessage ? (
          <div className="rb-status rb-status--success" role="status">
            {onlineSuccessMessage}
          </div>
        ) : null}
        {isAutoDeducting ? (
          <div aria-busy="true" className="rb-status rb-status--warning" role="status">
            Pembayaran berulang sedang diproses dan disinkronkan.
          </div>
        ) : null}
      </div>

      {isAuthLoading ? (
        <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-8 sm:px-6">
          <TerminalPanel className="!p-6 text-sm text-slate-300">
            Memeriksa sesi...
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

          <div className="rb-shell">
            <aside className="rb-sidebar">
              <div className="rb-brand">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="rb-brand__mark"
                  height={44}
                  src="/assets/rumahbudget/pixel-house.png"
                  width={44}
                />
                <div>
                  <p className="rb-brand__name">RumahBudget</p>
                  <p className="rb-brand__tagline">Keuangan rumah tangga</p>
                </div>
              </div>

              <nav aria-label="Navigasi utama" className="rb-sidebar__nav">
                {appViewGroups.map((group) => (
                  <div className="rb-nav-group" key={group.label}>
                    <p className="rb-nav-group__label">{group.label}</p>
                    <div className="space-y-1">
                      {group.views.map((view) => {
                        const item = appViews.find(
                          (candidate) => candidate.value === view,
                        );

                        if (!item) {
                          return null;
                        }

                        return (
                          <button
                            aria-current={
                              activeView === item.value ? "page" : undefined
                            }
                            className="rb-nav-item"
                            key={item.value}
                            type="button"
                            onClick={() => openView(item.value)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="rb-sidebar__footer">
                <div className="rb-privacy-note">
                  <strong>Ruang privat</strong>
                  <span>Data keuangan tetap berada di ruang akun Anda.</span>
                </div>
                <p className="truncate text-xs text-slate-400">{signedInEmail}</p>
                <div className="grid grid-cols-2 gap-2">
                  <SharpButton
                    type="button"
                    onClick={() => openView("settings")}
                  >
                    Pengaturan
                  </SharpButton>
                  <SharpButton variant="danger" type="button" onClick={logout}>
                    Keluar
                  </SharpButton>
                </div>
              </div>
            </aside>

            <div className="rb-main">
              <header className="rb-topbar">
                <div>
                  <p className="ledger-eyebrow">
                    {isSandboxMode ? "Mode simulasi" : "Ledger aktif"}
                  </p>
                  <p className="rb-topbar__title">
                    {appViews.find((item) => item.value === activeView)?.label}
                  </p>
                </div>
                <p className="rb-topbar__date">
                  {selectedMonth?.label ?? headerDateFormatter.format(new Date())}
                </p>
                <div className="rb-topbar__actions">
                  <label className="sr-only" htmlFor="summary-month">
                    Periode ringkasan
                  </label>
                  <select
                    className="ledger-button ledger-button--secondary"
                    id="summary-month"
                    value={selectedMonthKey}
                    onChange={(event) => setSelectedMonthKey(event.target.value)}
                  >
                    {recentMonthOptions.map((period) => (
                      <option key={period.key} value={period.key}>
                        {period.label}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-pressed={isBalanceHidden}
                    className="ledger-button ledger-button--secondary"
                    type="button"
                    onClick={() =>
                      setIsBalanceHidden((currentValue) => !currentValue)
                    }
                  >
                    {isBalanceHidden ? "Tampilkan nominal" : "Privasi"}
                  </button>
                  <button
                    className="ledger-button ledger-button--primary"
                    type="button"
                    onClick={() => {
                      setQuickAddTab("expense");
                      openView("add");
                    }}
                  >
                    Catat transaksi
                  </button>
                </div>
              </header>

              <div className="rb-mode-bar">
                <div>
                  <strong>
                    {isSandboxMode ? "Simulasi aktif" : "Ledger asli"}
                  </strong>
                  <span>
                    {isSandboxMode
                      ? "Perubahan hanya memengaruhi proyeksi."
                      : "Transaksi tersimpan pada ledger aktif."}
                  </span>
                </div>
                <button
                  aria-checked={isSandboxMode}
                  aria-label="Gunakan mode simulasi"
                  className="rb-switch"
                  role="switch"
                  type="button"
                  onClick={() => handleSetSandboxMode(!isSandboxMode)}
                >
                  <span aria-hidden="true" />
                </button>
              </div>

              <nav aria-label="Navigasi tablet" className="rb-tablet-nav">
                {appViews.map((item) => (
                  <button
                    aria-current={
                      activeView === item.value ? "page" : undefined
                    }
                    className="rb-nav-item"
                    key={item.value}
                    type="button"
                    onClick={() => openView(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <nav aria-label="Navigasi seluler" className="rb-mobile-nav">
                {mobilePrimaryViews.map((view) => {
                  const item = appViews.find(
                    (candidate) => candidate.value === view,
                  );

                  if (!item) {
                    return null;
                  }

                  return (
                    <button
                      aria-current={
                        activeView === item.value ? "page" : undefined
                      }
                      className="rb-mobile-nav__item"
                      key={item.value}
                      type="button"
                      onClick={() => openView(item.value)}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <button
                  aria-controls="mobile-more-sheet"
                  aria-expanded={isMobileMoreOpen}
                  className={`rb-mobile-nav__item ${
                    mobileMoreViews.includes(activeView) ? "is-active" : ""
                  }`}
                  ref={mobileMoreTriggerRef}
                  type="button"
                  onClick={() =>
                    setIsMobileMoreOpen((currentValue) => !currentValue)
                  }
                >
                  Lainnya
                </button>
              </nav>

              {isMobileMoreOpen ? (
                <div
                  aria-label="Navigasi lainnya"
                  aria-modal="true"
                  className="rb-more-sheet"
                  id="mobile-more-sheet"
                  role="dialog"
                >
                  <button
                    aria-label="Tutup navigasi lainnya"
                    className="rb-more-sheet__backdrop"
                    type="button"
                    onClick={closeMobileMoreSheet}
                  />
                  <div className="rb-more-sheet__panel" ref={mobileMorePanelRef}>
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="ledger-section-title">Menu lainnya</h2>
                      <button
                        className="ledger-button ledger-button--secondary"
                        ref={mobileMoreCloseButtonRef}
                        type="button"
                        onClick={closeMobileMoreSheet}
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {mobileMoreViews.map((view) => {
                        const item = appViews.find(
                          (candidate) => candidate.value === view,
                        );

                        if (!item) {
                          return null;
                        }

                        return (
                          <button
                            aria-current={
                              activeView === item.value ? "page" : undefined
                            }
                            className="rb-nav-item"
                            key={item.value}
                            type="button"
                            onClick={() => openView(item.value)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rb-view-content pb-28 sm:pb-10">
            {activeView === "overview" ? (
              <>
                <OverviewDashboard
                  accountBalances={moneyAccountBalances}
                  actionProtocol={actionProtocol}
                  averageMonthlyBurn={averageMonthlyBurn}
                  balanceAfterPlannedSpend={balanceAfterPlannedSpend}
                  chartHighlightClassName={getSectionHighlightClass(
                    "dashboard-charts",
                  )}
                  decisionChecks={decisionChecks}
                  dailyAllowanceResult={dailyAllowanceResult}
                  expenses={monthlyExpenses}
                  highlightClassName={getSectionHighlightClass("overview")}
                  isBalanceHidden={isBalanceHidden}
                  isSandboxMode={isSandboxMode}
                  isLivingPreferenceLoading={isLivingPreferenceLoading}
                  isLivingPreferenceUnsynced={isLivingPreferenceUnsynced}
                  livingAccountIds={livingAccountIds}
                  monthlyStatus={monthlyStatus}
                  monthlyTradingNet={financeSnapshot.monthlyTradingNet}
                  moneyAccounts={moneyAccounts}
                  netHourlyWage={netHourlyWage}
                  onOpenQuickAdd={(tab) => {
                    setQuickAddTab(tab);
                    openView("add");
                  }}
                  onLivingAccountIdsChange={saveLivingAccountIds}
                  onOpenCommitments={() => {
                    openView("settings");
                    window.setTimeout(() => {
                      document
                        .getElementById("commitments-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  }}
                  onOpenView={openView}
                  onToggleBalanceVisibility={() =>
                    setIsBalanceHidden((currentValue) => !currentValue)
                  }
                  periodLabel={cashflowPeriodLabel}
                  plannedSpend={plannedSpend}
                  projectedMonthlyExpenses={projectedMonthlyExpenses}
                  projectedNetCashflow={projectedNetCashflow}
                  projectedRunwayDays={projectedRunwayDays}
                  recentActivity={recentActivity}
                  remainingBalance={remainingBalance}
                  safePlannedSpendAmount={safePlannedSpendAmount}
                  showDailyAllowance={isCurrentSummaryMonth}
                  setPlannedSpend={setPlannedSpend}
                  spendGaugePercent={spendGaugePercent}
                  tradingBalance={tradingBalance}
                  spendSignal={spendSignal}
                  survivalRunwayMonths={survivalRunwayMonths}
                  totalBalance={totalBalance}
                  totalExpense={totalExpense}
                  totalIncome={totalIncome}
                />

                {approachingCommitments.length > 0 ? (
                  <section className="mx-auto max-w-6xl px-4 pb-5 sm:px-6">
                    <TerminalPanel className="ledger-panel !p-5">
                      <SectionHeader
                        description="Tagihan manual yang jatuh tempo dalam tiga hari atau sudah lewat."
                        eyebrow="Komitmen"
                        title="Pembayaran mendekati jatuh tempo"
                        tone="amber"
                      />
                      <div className="mt-4 space-y-3">
                        {approachingCommitments.map((commitment) => {
                          const reminderDate = new Date();
                          const isOverdue =
                            reminderDate.getDate() >=
                            getEffectiveRecurringDueDay(
                              commitment.dueDay,
                              reminderDate,
                            );

                          return (
                            <article
                              className="ledger-row flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
                              key={commitment.id}
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`ledger-state-tag ${
                                      isOverdue
                                        ? "ledger-state-tag--danger"
                                        : "ledger-state-tag--warning"
                                    }`}
                                  >
                                    {isOverdue ? "Terlambat" : "Segera jatuh tempo"}
                                  </span>
                                  <h3 className="font-bold text-white">
                                    {commitment.name}
                                  </h3>
                                </div>
                                <p className="mt-2 text-sm text-slate-400">
                                  Tanggal {commitment.dueDay} ·{" "}
                                  {commitment.category} ·{" "}
                                  {commitment.accountId
                                    ? accountNamesById[commitment.accountId] ??
                                      "Akun tidak dikenal"
                                    : "Tunai"}
                                </p>
                              </div>
                              <div className="flex flex-col gap-3 sm:items-end">
                                <span className="numeric-value text-lg font-black text-white">
                                  {isBalanceHidden
                                    ? "••••••"
                                    : formatCurrency(commitment.amount)}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  <SharpButton
                                    type="button"
                                    disabled={isAutoDeducting}
                                    onClick={() =>
                                      recordCommitmentPayment(commitment)
                                    }
                                  >
                                    {isAutoDeducting
                                      ? "Memproses..."
                                      : "Catat pembayaran"}
                                  </SharpButton>
                                  <SharpButton
                                    type="button"
                                    onClick={() =>
                                      muteCommitmentReminders(commitment)
                                    }
                                  >
                                    Senyapkan
                                  </SharpButton>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </TerminalPanel>
                  </section>
                ) : null}

                <SurvivalMatrix
                  accounts={householdAccounts}
                  accountBalances={moneyAccountBalances}
                  averageMonthlyBurn={averageMonthlyBurn}
                  monthlyIncome={
                    isSandboxMode ? totalIncome : averageMonthlyIncome
                  }
                  isBalanceHidden={isBalanceHidden}
                />

                <SystemDiagnostics
                  accounts={moneyAccounts}
                  accountBalances={moneyAccountBalances}
                  expenses={activeExpenses}
                  isBalanceHidden={isBalanceHidden}
                  autoStartScanTrigger={autoStartScanTrigger}
                />

                <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
                  <TerminalPanel className="ledger-panel !p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-300">
                          Mode simulasi
                        </p>
                        <h2 className="mt-2 text-xl font-black text-white">
                          Uji skenario tanpa mengubah ledger asli
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          {isSandboxMode
                            ? `${sandboxTransactions.length} skenario aktif. Angka ringkasan saat ini mencakup proyeksi simulasi.`
                            : "Simulasi nonaktif. Angka ringkasan berasal dari ledger aktif Anda."}
                        </p>
                      </div>
                      <SharpButton
                        className="shrink-0"
                        type="button"
                        onClick={() => openView("sandbox")}
                      >
                        {isSandboxMode
                          ? "Kelola simulasi"
                          : "Buka simulasi"}
                      </SharpButton>
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
                        className="grid-cols-1 sm:min-w-[25rem] sm:grid-cols-3"
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
                        netHourlyWage={netHourlyWage}
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
                onUpdateTransaction={updateTransaction}
                error={expenseError || incomeError || transferError}
                isLoading={
                  isExpenseLoading || isIncomeLoading || isTransferLoading
                }
                netHourlyWage={netHourlyWage}
                isBalanceHidden={isBalanceHidden}
              />
            ) : null}

            {activeView === "allocation" ? (
              <MoneyAllocationWatch
                accounts={moneyAccounts}
                isBalanceHidden={isBalanceHidden}
                userId={authUser.id}
              />
            ) : null}

            {activeView === "trading" ? (
              <TradingDashboard
                accounts={moneyAccounts}
                error={tradingError}
                isBalanceHidden={isBalanceHidden}
                isLoading={isTradingLoading}
                onAddResult={addTradingResult}
                onDeleteResult={deleteTradingResult}
                periodLabel={selectedMonth?.label ?? "Periode terpilih"}
                summary={tradingSummary}
              />
            ) : null}

            {activeView === "sandbox" ? (
              <SandboxControls
                sandboxTransactions={sandboxTransactions}
                onAddSandboxTransaction={handleAddSandboxTransaction}
                onDeleteSandboxTransaction={handleDeleteSandboxTransaction}
                actualTotalBalance={moneyAccounts.reduce(
                  (total, account) =>
                    total + (moneyAccountBalances[account.id] ?? account.initialBalance),
                  0,
                )}
                actualMonthlyIncome={monthlyIncomes.reduce((total, income) => total + income.amount, 0)}
                actualMonthlyExpense={monthlyExpenses.reduce((total, expense) => total + expense.amount, 0)}
                isBalanceHidden={isBalanceHidden}
                isSandboxMode={isSandboxMode}
                onToggleSandboxMode={handleSetSandboxMode}
                onCreateShareUrl={handleShareSandboxTransactions}
                importNotice={sandboxImportNotice}
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
                  isBalanceHidden={isBalanceHidden}
                  now={financialNow}
                  referenceDate={
                    selectedMonth?.start.getTime() ?? financialNow
                  }
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

                <RecurringCommitments
                  commitments={commitments}
                  moneyAccounts={moneyAccounts}
                  accountNamesById={accountNamesById}
                  onAddCommitment={addCommitment}
                  onDeleteCommitment={deleteCommitment}
                  error={commitmentsError}
                  isLoading={isCommitmentsLoading}
                />

                <EmailReportPreferences user={authUser} onWageChange={setNetHourlyWage} />
              </>
            ) : null}

            <CommandK
              accounts={moneyAccounts}
              addExpense={addExpense}
              addIncome={addIncome}
              addTransfer={addTransfer}
              setActiveView={setActiveView}
              isSandboxMode={isSandboxMode}
              handleSetSandboxMode={handleSetSandboxMode}
              isBalanceHidden={isBalanceHidden}
              setIsBalanceHidden={setIsBalanceHidden}
              onScan={() => {
                setActiveView("overview");
                setAutoStartScanTrigger((prev) => prev + 1);
                setTimeout(() => {
                  const el = document.getElementById("system-diagnostics");
                  const prefersReducedMotion = window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches;
                  el?.scrollIntoView({
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                  });
                }, 100);
              }}
            />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
