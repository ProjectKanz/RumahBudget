"use client";

import {
  EmptyState,
  NumberValue,
  SectionHeader,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
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
      <EmptyState>
        {emptyMessage}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width =
          maxValue > 0
            ? Math.max(8, (Math.abs(item.value) / maxValue) * 100)
            : 8;

        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-300">{item.label}</span>
              <NumberValue className="shrink-0 text-slate-400">
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : formatCurrency(item.value)}
              </NumberValue>
            </div>
            <div className="h-3 overflow-hidden border border-white/10 bg-black/60">
              <div
                className="h-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.35)] transition-all duration-700"
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
      <TerminalPanel
        className={`!p-5 transition sm:!p-6 ${highlightClassName}`}
      >
        <SectionHeader
          description={
            <>
            Transfers affect account balances only. Expense breakdown uses
            expense transactions.
            </>
          }
          eyebrow="Dashboard Charts"
          title="Balance and expense overview"
          tone="cyan"
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="cockpit-card border border-cyan-300/15 bg-black/25 p-5 transition hover:border-cyan-300/35">
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

          <div className="cockpit-card border border-fuchsia-300/15 bg-black/25 p-5 transition hover:border-fuchsia-300/35">
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
      </TerminalPanel>
    </section>
  );
}
