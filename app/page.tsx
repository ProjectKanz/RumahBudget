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
import SurvivalMatrix from "@/src/components/survival-matrix";
import SystemDiagnostics from "@/src/components/system-diagnostics";
import SandboxControls from "@/src/components/sandbox-controls";
import CommandK from "@/src/components/command-k";
import MoneyAllocationWatch from "@/src/components/money-allocation-watch";
import { calculateFinanceSnapshot } from "@/src/lib/finance-calculations";
import { formatCurrency } from "@/src/lib/format";
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
import type { SandboxTransaction } from "@/src/types/sandbox";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecurringCommitments from "@/src/components/recurring-commitments";
import type { RecurringCommitment } from "@/src/types/recurring-commitment";

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
  { label: "Perencanaan", views: ["allocation", "sandbox"] },
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

type OfflineQueueItem =
  | {
      type: "expense";
      data: {
        accountId: string;
        amount: number;
        category: string;
        paymentMethod: string;
        note: string;
      };
    }
  | {
      type: "income";
      data: {
        accountId: string;
        amount: number;
        source: string;
        note: string;
      };
    }
  | {
      type: "transfer";
      data: {
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        note: string;
      };
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

function isCurrentMonthString(dateStr: string | null | undefined): boolean {
  if (!dateStr) {
    return false;
  }

  const date = new Date(dateStr);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
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
  const [netHourlyWage, setNetHourlyWage] = useState<number>(0);
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
  const hasScannedAutoDeducts = useRef(false);
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

  const loadCommitmentsFromSupabase = useCallback(async () => {
    setIsCommitmentsLoading(true);
    setCommitmentsError("");

    if (!authUser) {
      setCommitments([]);
      setIsCommitmentsLoading(false);
      return;
    }

    if (!supabase) {
      const localData = window.localStorage.getItem("rumahbudget.localCommitments");
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
          const localData = window.localStorage.getItem("rumahbudget.localCommitments");
          if (localData) {
            setCommitments(JSON.parse(localData));
          } else {
            const fallbackComs: RecurringCommitment[] = [
              {
                id: "fallback-sub-1",
                userId: authUser.id,
                accountId: null,
                name: "Spotify Premium (Local Fallback)",
                amount: 54990,
                category: "Bills",
                commitmentType: "subscription",
                dueDay: 15,
                isAutoDeduct: true,
                disableReminders: false,
                lastProcessed: null,
                createdAt: Date.now(),
              },
              {
                id: "fallback-rent-2",
                userId: authUser.id,
                accountId: null,
                name: "Rent (Local Fallback)",
                amount: 2500000,
                category: "Other",
                commitmentType: "rent",
                dueDay: 1,
                isAutoDeduct: false,
                disableReminders: false,
                lastProcessed: null,
                createdAt: Date.now(),
              },
            ];
            window.localStorage.setItem("rumahbudget.localCommitments", JSON.stringify(fallbackComs));
            setCommitments(fallbackComs);
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

    if (!supabase || !dbSupportsCommitments) {
      const localData = window.localStorage.getItem("rumahbudget.localCommitments");
      const localComs: RecurringCommitment[] = localData ? JSON.parse(localData) : [];
      const newCommitment: RecurringCommitment = {
        ...c,
        id: crypto.randomUUID(),
        userId: authUser.id,
        createdAt: Date.now(),
        lastProcessed: null,
      };
      const updated = [newCommitment, ...localComs];
      window.localStorage.setItem("rumahbudget.localCommitments", JSON.stringify(updated));
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

    if (!supabase || !dbSupportsCommitments) {
      const localData = window.localStorage.getItem("rumahbudget.localCommitments");
      if (localData) {
        const localComs: RecurringCommitment[] = JSON.parse(localData);
        const updated = localComs.filter((c) => c.id !== id);
        window.localStorage.setItem("rumahbudget.localCommitments", JSON.stringify(updated));
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
    const queueJson = localStorage.getItem("rumahbudget.offlineQueue");
    if (!queueJson) return;

    let queue: OfflineQueueItem[] = [];
    try {
      queue = JSON.parse(queueJson);
    } catch {
      return;
    }

    if (queue.length === 0) return;
    if (!supabase) return;

    let successCount = 0;

    for (const item of queue) {
      try {
        if (item.type === "expense") {
          const { error } = await supabase.from("expenses").insert({
            user_id: authUser?.id,
            owner: authUser?.email,
            account_id: item.data.accountId,
            amount: item.data.amount,
            category: item.data.category,
            payment_method: item.data.paymentMethod,
            note: item.data.note,
          });
          if (!error) successCount++;
        } else if (item.type === "income") {
          const { error } = await supabase.from("incomes").insert({
            user_id: authUser?.id,
            owner: authUser?.email,
            account_id: item.data.accountId,
            amount: item.data.amount,
            source: item.data.source,
            note: item.data.note,
          });
          if (!error) successCount++;
        } else if (item.type === "transfer") {
          const { error } = await supabase.from("transfers").insert({
            user_id: authUser?.id,
            from_account_id: item.data.fromAccountId,
            to_account_id: item.data.toAccountId,
            amount: item.data.amount,
            note: item.data.note,
          });
          if (!error) successCount++;
        }
      } catch (err) {
        console.error("Offline sync item failed:", err);
      }
    }

    localStorage.removeItem("rumahbudget.offlineQueue");
    setOfflineQueueCount(0);

    if (successCount > 0) {
      setOnlineSuccessMessage(`⚠️ [OFFLINE ACTIVE] Connection restored. ${successCount} transaction(s) synced.`);
      void loadExpensesFromSupabase();
      void loadIncomesFromSupabase();
      void loadTransfersFromSupabase();
      void loadMoneyAccountsFromSupabase();

      setTimeout(() => {
        setOnlineSuccessMessage("");
      }, 5000);
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
      const queueJson = localStorage.getItem("rumahbudget.offlineQueue");
      if (queueJson) {
        try {
          const q = JSON.parse(queueJson) as OfflineQueueItem[];
          setOfflineQueueCount(q.length);
        } catch {}
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

  const syncAutoDeducts = useCallback(async (commitmentsToProcess: RecurringCommitment[]) => {
    setIsAutoDeducting(true);
    try {
      for (const c of commitmentsToProcess) {
        const expenseAccountId = c.accountId || (moneyAccounts[0]?.id ?? "");
        if (!expenseAccountId) {
          console.warn(`No account available to auto-deduct commitment: ${c.name}`);
          continue;
        }

        if (supabase) {
          const { error: expError } = await supabase.from("expenses").insert({
            user_id: authUser?.id,
            owner: authUser?.email,
            account_id: expenseAccountId,
            amount: c.amount,
            category: c.category,
            payment_method: "Debit Card",
            note: `Auto-Deducted commitment: ${c.name}`,
          });

          if (expError) {
            console.error("Auto-deduct expense insert failed:", expError.message);
            continue;
          }
        } else {
          const localExp: Expense = {
            id: crypto.randomUUID(),
            owner: authUser?.email ?? "Offline user",
            userId: authUser?.id ?? "",
            accountId: expenseAccountId,
            createdAt: new Date().getTime(),
            amount: c.amount,
            category: c.category,
            paymentMethod: "Debit Card",
            note: `Auto-Deducted commitment: ${c.name}`,
          };
          setExpenses((prev) => [localExp, ...prev]);
        }

        const nowStr = new Date().toISOString();
        if (supabase && dbSupportsCommitments) {
          const { error: comError } = await supabase
            .from("recurring_commitments")
            .update({ last_processed: nowStr })
            .eq("id", c.id);

          if (comError) {
            console.error("Failed to update last_processed:", comError.message);
          }
        } else {
          const localData = localStorage.getItem("rumahbudget.localCommitments");
          if (localData) {
            const localComs: RecurringCommitment[] = JSON.parse(localData);
            const updated = localComs.map((lc) =>
              lc.id === c.id ? { ...lc, lastProcessed: nowStr } : lc
            );
            localStorage.setItem("rumahbudget.localCommitments", JSON.stringify(updated));
          }
        }
      }

      await loadExpensesFromSupabase();
      await loadCommitmentsFromSupabase();
    } catch (err) {
      console.error("Error running auto-deducts:", err);
    } finally {
      setIsAutoDeducting(false);
    }
  }, [
    authUser,
    dbSupportsCommitments,
    loadCommitmentsFromSupabase,
    loadExpensesFromSupabase,
    moneyAccounts,
  ]);

  async function recordCommitmentPayment(c: RecurringCommitment) {
    const expenseAccountId = c.accountId || (moneyAccounts[0]?.id ?? "");
    if (!expenseAccountId) {
      alert("Buat akun uang terlebih dahulu.");
      return;
    }

    setIsAutoDeducting(true);
    try {
      if (supabase) {
        const { error: expError } = await supabase.from("expenses").insert({
          user_id: authUser?.id,
          owner: authUser?.email,
          account_id: expenseAccountId,
          amount: c.amount,
          category: c.category,
          payment_method: "Debit Card",
          note: `Manual payment for commitment: ${c.name}`,
        });

        if (expError) {
          alert(`Gagal menyimpan pengeluaran: ${expError.message}`);
          return;
        }
      } else {
        const localExp: Expense = {
          id: crypto.randomUUID(),
          owner: authUser?.email ?? "Offline user",
          userId: authUser?.id ?? "",
          accountId: expenseAccountId,
          createdAt: new Date().getTime(),
          amount: c.amount,
          category: c.category,
          paymentMethod: "Debit Card",
          note: `Manual payment for commitment: ${c.name}`,
        };
        setExpenses((previousExpenses) => [localExp, ...previousExpenses]);
      }

      const processedAt = new Date().toISOString();
      if (supabase && dbSupportsCommitments) {
        await supabase
          .from("recurring_commitments")
          .update({ last_processed: processedAt })
          .eq("id", c.id);
      } else {
        const localData = localStorage.getItem(
          "rumahbudget.localCommitments",
        );
        if (localData) {
          const localCommitments: RecurringCommitment[] =
            JSON.parse(localData);
          const updatedCommitments = localCommitments.map((commitment) =>
            commitment.id === c.id
              ? { ...commitment, lastProcessed: processedAt }
              : commitment,
          );
          localStorage.setItem(
            "rumahbudget.localCommitments",
            JSON.stringify(updatedCommitments),
          );
        }
      }

      await loadExpensesFromSupabase();
      await loadCommitmentsFromSupabase();
    } catch (error) {
      console.error(error);
    } finally {
      setIsAutoDeducting(false);
    }
  }

  async function muteCommitmentReminders(c: RecurringCommitment) {
    if (supabase && dbSupportsCommitments) {
      await supabase
        .from("recurring_commitments")
        .update({ disable_reminders: true })
        .eq("id", c.id);
    } else {
      const localData = localStorage.getItem("rumahbudget.localCommitments");
      if (localData) {
        const localCommitments: RecurringCommitment[] = JSON.parse(localData);
        const updatedCommitments = localCommitments.map((commitment) =>
          commitment.id === c.id
            ? { ...commitment, disableReminders: true }
            : commitment,
        );
        localStorage.setItem(
          "rumahbudget.localCommitments",
          JSON.stringify(updatedCommitments),
        );
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
        setNetHourlyWage(0);
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
      void loadPreferencesFromSupabase();
      void loadCommitmentsFromSupabase();
    });
  }, [
    authUser,
    loadEmailReportsFromSupabase,
    loadExpensesFromSupabase,
    loadIncomesFromSupabase,
    loadMoneyAccountsFromSupabase,
    loadTransfersFromSupabase,
    loadPreferencesFromSupabase,
    loadCommitmentsFromSupabase,
  ]);

  // Scan and trigger Auto-Deduct
  useEffect(() => {
    if (!authUser || isMoneyAccountLoading || isAutoDeducting) {
      return;
    }
    if (hasScannedAutoDeducts.current) {
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();

    const toAutoDeduct = commitments.filter(
      (c) =>
        c.isAutoDeduct &&
        currentDay >= c.dueDay &&
        !isCurrentMonthString(c.lastProcessed)
    );

    if (toAutoDeduct.length > 0) {
      hasScannedAutoDeducts.current = true;
      queueMicrotask(() => {
        void syncAutoDeducts(toAutoDeduct);
      });
    }
  }, [authUser, isMoneyAccountLoading, commitments, isAutoDeducting, syncAutoDeducts]);

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

  const activeIncomes = incomes;
  const signedInEmail = authUser?.email ?? "Signed-in account";

  const approachingCommitments = useMemo(() => {
    const currentDay = new Date().getDate();

    return commitments.filter((commitment) => {
      if (commitment.isAutoDeduct || commitment.disableReminders) {
        return false;
      }

      if (isCurrentMonthString(commitment.lastProcessed)) {
        return false;
      }

      return commitment.dueDay - currentDay <= 3;
    });
  }, [commitments]);

  const financeSnapshot = useMemo(
    () =>
      calculateFinanceSnapshot({
        accounts: moneyAccounts,
        expenses: activeExpenses,
        incomes: activeIncomes,
        transfers,
      }),
    [activeExpenses, activeIncomes, moneyAccounts, transfers],
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

  const averageMonthlyBurn = useMemo(() => {
    if (activeExpenses.length === 0 && (!isSandboxMode || sandboxTransactions.filter(t => t.type === "expense").length === 0)) {
      return 0;
    }

    const monthlyBurnMap = new Map<string, number>();
    activeExpenses.forEach((expense) => {
      if (expense.createdAt <= 0) return;
      const date = new Date(expense.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyBurnMap.set(key, (monthlyBurnMap.get(key) || 0) + expense.amount);
    });

    const recurringSandboxOutflow = isSandboxMode
      ? sandboxTransactions
          .filter((tx) => tx.type === "expense" && tx.timing === "recurring")
          .reduce((sum, tx) => sum + tx.amount, 0)
      : 0;

    if (monthlyBurnMap.size === 0) {
      return recurringSandboxOutflow;
    }

    const totalAllExpenses = Array.from(monthlyBurnMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );

    return (totalAllExpenses / monthlyBurnMap.size) + recurringSandboxOutflow;
  }, [activeExpenses, isSandboxMode, sandboxTransactions]);

  const survivalRunwayMonths = useMemo(() => {
    if (averageMonthlyBurn === 0) {
      return Infinity;
    }
    return totalBalance / averageMonthlyBurn;
  }, [totalBalance, averageMonthlyBurn]);

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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const queueJson = localStorage.getItem("rumahbudget.offlineQueue");
      const queue = queueJson ? JSON.parse(queueJson) : [];
      queue.push({ type: "expense", data: expense });
      localStorage.setItem("rumahbudget.offlineQueue", JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setExpenses((prev) => [
        {
          ...expense,
          owner: authUser?.email ?? "Offline user",
          userId: authUser?.id ?? "",
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      return true;
    }

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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const queueJson = localStorage.getItem("rumahbudget.offlineQueue");
      const queue = queueJson ? JSON.parse(queueJson) : [];
      queue.push({ type: "income", data: income });
      localStorage.setItem("rumahbudget.offlineQueue", JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setIncomes((prev) => [
        {
          ...income,
          owner: authUser?.email ?? "Offline user",
          userId: authUser?.id ?? "",
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      return true;
    }

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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const queueJson = localStorage.getItem("rumahbudget.offlineQueue");
      const queue = queueJson ? JSON.parse(queueJson) : [];
      queue.push({ type: "transfer", data: transfer });
      localStorage.setItem("rumahbudget.offlineQueue", JSON.stringify(queue));
      setOfflineQueueCount(queue.length);

      setTransfers((prev) => [
        {
          id: crypto.randomUUID(),
          userId: authUser?.id ?? "",
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          amount: transfer.amount,
          note: transfer.note,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      return true;
    }

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
                  <strong>Privasi aktif</strong>
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
                  {headerDateFormatter.format(new Date())}
                </p>
                <div className="rb-topbar__actions">
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
                  expenses={activeExpenses}
                  highlightClassName={getSectionHighlightClass("overview")}
                  isBalanceHidden={isBalanceHidden}
                  isSandboxMode={isSandboxMode}
                  monthlyStatus={monthlyStatus}
                  moneyAccounts={moneyAccounts}
                  netHourlyWage={netHourlyWage}
                  onOpenQuickAdd={(tab) => {
                    setQuickAddTab(tab);
                    openView("add");
                  }}
                  onOpenView={openView}
                  onToggleBalanceVisibility={() =>
                    setIsBalanceHidden((currentValue) => !currentValue)
                  }
                  plannedSpend={plannedSpend}
                  projectedMonthlyExpenses={projectedMonthlyExpenses}
                  projectedNetCashflow={projectedNetCashflow}
                  projectedRunwayDays={projectedRunwayDays}
                  recentActivity={recentActivity}
                  remainingBalance={remainingBalance}
                  safePlannedSpendAmount={safePlannedSpendAmount}
                  setPlannedSpend={setPlannedSpend}
                  spendGaugePercent={spendGaugePercent}
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
                          const isOverdue =
                            new Date().getDate() >= commitment.dueDay;

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
                                    onClick={() =>
                                      recordCommitmentPayment(commitment)
                                    }
                                  >
                                    Catat pembayaran
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
                  accounts={moneyAccounts}
                  accountBalances={moneyAccountBalances}
                  averageMonthlyBurn={averageMonthlyBurn}
                  monthlyIncome={totalIncome}
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
                netHourlyWage={netHourlyWage}
              />
            ) : null}

            {activeView === "allocation" ? (
              <MoneyAllocationWatch
                accounts={moneyAccounts}
                isBalanceHidden={isBalanceHidden}
                userId={authUser.id}
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
