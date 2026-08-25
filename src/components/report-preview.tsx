"use client";

import {
  Notice,
  NumberValue,
  SectionHeader,
  SegmentedControl,
  SharpButton,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import {
  getReportPeriod,
  summarizeReportPeriod,
} from "@/src/lib/report-period";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import {
  clearSupabaseAuthStorage,
  isRecoverableSupabaseAuthError,
} from "@/src/lib/supabase-auth-recovery";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import { useMemo, useState } from "react";

type ReportType = "weekly" | "monthly";

type FinancialStatus = {
  label: "Safe" | "Warning" | "Critical";
  className: string;
  explanation: string;
};

type ReportPreviewProps = {
  expenses: Expense[];
  highlightClassName?: string;
  incomes: Income[];
  isBalanceHidden: boolean;
  now: number;
  referenceDate: number;
  onReportSent?: () => void | Promise<void>;
};

const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);

function getFinancialStatus(totalIncome: number, totalExpense: number) {
  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;

  if (totalExpense > totalIncome) {
    return {
      label: "Critical",
      className: "text-rose-300",
      explanation: "Expenses are higher than income for this period.",
    } satisfies FinancialStatus;
  }

  if (expenseRatio >= 0.7) {
    return {
      label: "Warning",
      className: "text-amber-300",
      explanation: "Expenses are getting close to income for this period.",
    } satisfies FinancialStatus;
  }

  return {
    label: "Safe",
    className: "text-lime-300",
    explanation: "Expenses are still under control for this period.",
  } satisfies FinancialStatus;
}

function getRecommendation(
  status: FinancialStatus["label"],
  topCategory: string,
  totalIncome: number,
) {
  if (totalIncome <= 0) {
    return "Start by adding income so net cashflow is clearer.";
  }

  if (status === "Critical") {
    return topCategory === "None yet"
      ? "Review expenses and postpone non-urgent purchases."
      : `Reduce spending in ${topCategory} and prioritize essentials.`;
  }

  if (status === "Warning") {
    return topCategory === "None yet"
      ? "Keep monitoring expenses before adding new transactions."
      : `Watch ${topCategory} so expenses do not exceed income.`;
  }

  return "Keep tracking consistently and set aside part of your income when possible.";
}

function getResponseError(data: unknown) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;

    if (typeof error === "string") {
      return error;
    }
  }

  return "Failed to send email report.";
}

export default function ReportPreview({
  expenses,
  highlightClassName = "",
  incomes,
  isBalanceHidden,
  now,
  referenceDate,
  onReportSent,
}: ReportPreviewProps) {
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [isSending, setIsSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sendError, setSendError] = useState("");

  const report = useMemo(() => {
    // A weekly report always describes the week containing today. It used to be
    // derived from the first day of whichever month the selector was showing,
    // so on the 25th it reported a week that had ended three weeks earlier.
    const period = getReportPeriod({
      monthReference: referenceDate ? new Date(referenceDate) : undefined,
      now: new Date(now),
      type: reportType,
    });
    const summary = summarizeReportPeriod({ expenses, incomes, period });
    const status = getFinancialStatus(summary.totalIncome, summary.totalExpense);
    const topCategoryKey = summary.sortedCategories[0]?.[0];
    const topCategory = topCategoryKey
      ? (categoryLabels.get(topCategoryKey) ?? topCategoryKey)
      : "None yet";

    return {
      label: `${period.reportName}: ${period.label}`,
      period,
      periodLabel: period.label,
      recommendation: getRecommendation(
        status.label,
        topCategory,
        summary.totalIncome,
      ),
      remainingBalance: summary.netCashflow,
      reportName: period.reportName,
      status,
      topCategory,
      totalExpense: summary.totalExpense,
      totalIncome: summary.totalIncome,
    };
  }, [expenses, incomes, now, referenceDate, reportType]);

  async function sendReport() {
    setIsSending(true);
    setSendMessage("");
    setSendError("");

    if (!supabase) {
      setSendError(missingSupabaseEnvMessage);
      setIsSending(false);
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Session retrieval error:", error);

        if (isRecoverableSupabaseAuthError(error)) {
          if (supabase) {
            void supabase.auth.signOut().catch(() => {});
          }

          clearSupabaseAuthStorage();
        }

        setSendError(error.message || "Session error. Please log in again.");
        setIsSending(false);
        return;
      }

      if (!session?.access_token) {
        setSendError("Please log in before sending a report.");
        setIsSending(false);
        return;
      }

      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType: report.reportName,
          periodLabel: report.periodLabel,
          periodStart: report.period.startKey,
          periodEnd: report.period.endKey,
          totalIncome: formatCurrency(report.totalIncome),
          totalExpense: formatCurrency(report.totalExpense),
          remainingBalance: formatCurrency(report.remainingBalance),
          financialStatus: report.status.label,
          topExpenseCategory: report.topCategory,
          explanation: report.status.explanation,
          recommendation: report.recommendation,
        }),
      });
      const data = (await response.json()) as unknown;

      if (!response.ok) {
        setSendError(getResponseError(data));
        await onReportSent?.();
        return;
      }

      setSendMessage("Report email request completed.");
      await onReportSent?.();
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Failed to send email report.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 pt-5 sm:px-6"
      id="report-preview"
    >
      <TerminalPanel
        className={`!p-5 transition sm:!p-6 ${highlightClassName}`}
      >
        <SectionHeader
          action={
            <SegmentedControl
              className="grid-cols-2"
              options={[
                { label: "Weekly", value: "weekly" as const },
                { label: "Monthly", value: "monthly" as const },
              ]}
              value={reportType}
              onChange={setReportType}
            />
          }
          description={
            <>
              This summary is generated from the signed-in account. Period Net
              Cashflow means income minus expenses for the selected report
              period.
            </>
          }
          eyebrow="Financial Report"
          title="Personal report preview"
          tone="cyan"
        />

        <div className="cockpit-card mt-5 border border-white/10 bg-black/25 p-5">
          <p className="text-sm font-semibold text-slate-300">
            {report.label}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Total Income</p>
              <p className="mt-2 text-xl font-bold text-lime-300">
                <NumberValue>
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(report.totalIncome)}
                </NumberValue>
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Total Expenses</p>
              <p className="mt-2 text-xl font-bold text-rose-300">
                <NumberValue>
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(report.totalExpense)}
                </NumberValue>
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Period Net Cashflow</p>
              <p
                className={`mt-2 text-xl font-bold ${
                  !isBalanceHidden && report.remainingBalance < 0
                    ? "text-rose-300"
                    : "text-white"
                }`}
              >
                <NumberValue>
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(report.remainingBalance)}
                </NumberValue>
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="cockpit-card border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-500">
                Period Cashflow Status
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  isBalanceHidden ? "text-slate-300" : report.status.className
                }`}
              >
                {isBalanceHidden ? "Hidden" : report.status.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isBalanceHidden
                  ? "Cashflow status hidden while privacy mode is active."
                  : report.status.explanation}
              </p>
            </div>

            <div className="cockpit-card border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-500">Top Category</p>
              <p className="mt-2 flex flex-wrap gap-2 text-2xl font-bold text-white">
                <StatusChip tone="fuchsia">
                  {isBalanceHidden ? "Hidden" : report.topCategory}
                </StatusChip>
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isBalanceHidden
                  ? "Category recommendation hidden while privacy mode is active."
                  : report.recommendation}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <SharpButton
              className="w-full sm:w-auto"
              variant="primary"
              type="button"
              disabled={isSending}
              onClick={sendReport}
            >
              {isSending ? "Sending report..." : "Send Report Email"}
            </SharpButton>

            {sendMessage ? (
              <Notice className="mt-4" tone="lime">
                {sendMessage}
              </Notice>
            ) : null}

            {sendError ? (
              <Notice className="mt-4" tone="rose">
                {sendError}
              </Notice>
            ) : null}
          </div>
        </div>
      </TerminalPanel>
    </section>
  );
}
