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
      <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
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
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-400"
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
      className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
      id="dashboard-charts"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Dashboard Charts
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Balance and expense overview
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Transfers affect account balances only. Expense breakdown uses
            expense transactions.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="text-lg font-bold text-white">
              Account Balance Overview
            </h3>
            <div className="mt-5">
              <SimpleBarList
                emptyMessage="No money accounts yet."
                isBalanceHidden={isBalanceHidden}
                items={accountItems}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="text-lg font-bold text-white">
              All-time Expense Breakdown
            </h3>
            <div className="mt-5">
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
