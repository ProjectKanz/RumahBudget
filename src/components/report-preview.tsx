"use client";

import { formatCurrency } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import { missingSupabaseEnvMessage, supabase } from "@/src/lib/supabase";
import { useMemo, useState } from "react";

type ReportType = "weekly" | "monthly";

type FinancialStatus = {
  label: "Safe" | "Warning" | "Critical";
  className: string;
  explanation: string;
};

type ReportPreviewProps = {
  expenses: Expense[];
  incomes: Income[];
  onReportSent?: () => void | Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);

function getWeekStart(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;

  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

function getWeekEnd(weekStart: Date) {
  const weekEnd = new Date(weekStart);

  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return weekEnd;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isInPeriod(createdAt: number, startDate: Date, endDate: Date) {
  return createdAt >= startDate.getTime() && createdAt <= endDate.getTime();
}

function getFinancialStatus(totalIncome: number, totalExpense: number) {
  const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;

  if (totalExpense > totalIncome) {
    return {
      label: "Critical",
      className: "text-red-300",
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
    className: "text-emerald-300",
    explanation: "Expenses are still under control for this period.",
  } satisfies FinancialStatus;
}

function getRecommendation(
  status: FinancialStatus["label"],
  topCategory: string,
  totalIncome: number,
) {
  if (totalIncome <= 0) {
    return "Start by adding income so the remaining balance is clearer.";
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
  incomes,
  onReportSent,
}: ReportPreviewProps) {
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [isSending, setIsSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sendError, setSendError] = useState("");

  const report = useMemo(() => {
    const today = new Date();
    const startDate =
      reportType === "weekly" ? getWeekStart(today) : getMonthStart(today);
    const endDate =
      reportType === "weekly" ? getWeekEnd(startDate) : getMonthEnd(today);

    const periodExpenses = expenses.filter((expense) =>
      isInPeriod(expense.createdAt, startDate, endDate),
    );
    const periodIncomes = incomes.filter((income) =>
      isInPeriod(income.createdAt, startDate, endDate),
    );

    const totalExpense = periodExpenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );
    const totalIncome = periodIncomes.reduce(
      (total, income) => total + income.amount,
      0,
    );
    const remainingBalance = totalIncome - totalExpense;

    const categoryTotals = periodExpenses.reduce<Record<string, number>>(
      (totals, expense) => ({
        ...totals,
        [expense.category]: (totals[expense.category] ?? 0) + expense.amount,
      }),
      {},
    );

    const topCategoryEntry = Object.entries(categoryTotals).sort(
      ([, firstAmount], [, secondAmount]) => secondAmount - firstAmount,
    )[0];

    const status = getFinancialStatus(totalIncome, totalExpense);
    const topCategory = topCategoryEntry?.[0]
      ? (categoryLabels.get(topCategoryEntry[0]) ?? topCategoryEntry[0])
      : "None yet";
    const reportName =
      reportType === "weekly" ? "Weekly Report" : "Monthly Report";
    const periodLabel = `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`;

    return {
      reportName,
      periodLabel,
      label: `${reportName}: ${periodLabel}`,
      totalIncome,
      totalExpense,
      remainingBalance,
      status,
      topCategory,
      recommendation: getRecommendation(status.label, topCategory, totalIncome),
    };
  }, [expenses, incomes, reportType]);

  async function sendReport() {
    setIsSending(true);
    setSendMessage("");
    setSendError("");

    if (!supabase) {
      setSendError(missingSupabaseEnvMessage);
      setIsSending(false);
      return;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      setSendError(error?.message ?? "Please log in before sending a report.");
      setIsSending(false);
      return;
    }

    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType: report.reportName,
          periodLabel: report.periodLabel,
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

      setSendMessage(
        "Report sent to the verified Resend testing email.",
      );
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
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="report-preview"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="flex flex-col gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Financial Report
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Personal report preview
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This summary is generated from the signed-in account.
            </p>
            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              Testing mode: email reports are sent only to the verified Resend
              email. Sending to other emails requires a verified domain.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-full border border-slate-800 bg-slate-950 p-1">
            {[
              { label: "Weekly Report", value: "weekly" as const },
              { label: "Monthly Report", value: "monthly" as const },
            ].map((option) => (
              <button
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  reportType === option.value
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
                key={option.value}
                type="button"
                onClick={() => setReportType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm font-semibold text-slate-300">
            {report.label}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Total Income</p>
              <p className="mt-2 text-xl font-bold text-emerald-300">
                {formatCurrency(report.totalIncome)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Total Expenses</p>
              <p className="mt-2 text-xl font-bold text-red-300">
                {formatCurrency(report.totalExpense)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Remaining Balance</p>
              <p
                className={`mt-2 text-xl font-bold ${
                  report.remainingBalance < 0 ? "text-red-300" : "text-white"
                }`}
              >
                {formatCurrency(report.remainingBalance)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-sm text-slate-500">Financial Status</p>
              <p className={`mt-2 text-2xl font-bold ${report.status.className}`}>
                {report.status.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {report.status.explanation}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-sm text-slate-500">Top Category</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {report.topCategory}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {report.recommendation}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              disabled={isSending}
              onClick={sendReport}
            >
              {isSending ? "Sending report..." : "Send Report Email"}
            </button>

            {sendMessage ? (
              <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                {sendMessage}
              </p>
            ) : null}

            {sendError ? (
              <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {sendError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
