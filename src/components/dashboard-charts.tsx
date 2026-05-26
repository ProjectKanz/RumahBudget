"use client";

import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import { useMemo } from "react";

const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);

type BarChartItem = {
  label: string;
  value: number;
};

type DashboardChartsProps = {
  accountBalances: Record<string, number>;
  expenses: Expense[];
  highlightClassName?: string;
  isBalanceHidden: boolean;
  moneyAccounts: MoneyAccount[];
};

function SimpleBarList({
  emptyMessage,
  isBalanceHidden = false,
  items,
}: {
  emptyMessage: string;
  isBalanceHidden?: boolean;
  items: BarChartItem[];
}) {
  const maxValue = Math.max(...items.map((item) => Math.abs(item.value)), 0);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/5 px-4 py-8 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width = maxValue > 0 ? Math.max(8, (Math.abs(item.value) / maxValue) * 100) : 8;

        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-300">{item.label}</span>
              <span className="shrink-0 text-slate-400">
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : formatCurrency(item.value)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-lime-300 to-fuchsia-300 shadow-[0_0_18px_rgba(34,211,238,0.35)] transition-all duration-700"
                style={{ width: isBalanceHidden ? "48%" : `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardCharts({
  accountBalances,
  expenses,
  highlightClassName = "",
  isBalanceHidden,
  moneyAccounts,
}: DashboardChartsProps) {
  const accountItems = useMemo(
    () =>
      moneyAccounts.map((account) => ({
        label: account.name,
        value: accountBalances[account.id] ?? account.initialBalance,
      })),
    [accountBalances, moneyAccounts],
  );
  const expenseItems = useMemo(() => {
    const totals = expenses.reduce<Record<string, number>>((nextTotals, expense) => {
      const category = categoryLabels.get(expense.category) ?? expense.category;

      return {
        ...nextTotals,
        [category]: (nextTotals[category] ?? 0) + expense.amount,
      };
    }, {});

    return Object.entries(totals)
      .map(([label, value]) => ({ label, value }))
      .sort((firstItem, secondItem) => secondItem.value - firstItem.value);
  }, [expenses]);

  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-6"
      id="dashboard-charts"
    >
      <div
        className={`rounded-[1.75rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-[0_0_46px_rgba(34,211,238,0.1)] backdrop-blur-xl transition sm:p-6 ${highlightClassName}`}
      >
        <div className="border-b border-cyan-300/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
            Dashboard Charts
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Balance and expense overview
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Transfers affect account balances only. Expense breakdown uses
            expense transactions.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/15 bg-black/25 p-4 transition hover:border-cyan-300/35 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)]">
            <h3 className="text-lg font-black text-white">
              Account Balance Overview
            </h3>
            <div className="mt-4">
              <SimpleBarList
                emptyMessage="No money accounts yet."
                isBalanceHidden={isBalanceHidden}
                items={accountItems}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-fuchsia-300/15 bg-black/25 p-4 transition hover:border-fuchsia-300/35 hover:shadow-[0_0_28px_rgba(217,70,239,0.12)]">
            <h3 className="text-lg font-black text-white">
              All-time Expense Breakdown
            </h3>
            <div className="mt-4">
              <SimpleBarList
                emptyMessage="No expenses yet."
                items={expenseItems}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
