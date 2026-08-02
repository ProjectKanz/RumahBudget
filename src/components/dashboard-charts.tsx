"use client";

import { EmptyState, NumberValue } from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";
import Image from "next/image";
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
  remainingBalance: number;
  totalExpense: number;
  totalIncome: number;
};

function SimpleBarList({
  emptyMessage,
  isBalanceHidden = false,
  items,
  tone,
}: {
  emptyMessage: string;
  isBalanceHidden?: boolean;
  items: BarChartItem[];
  tone: "account" | "expense";
}) {
  const maxValue = isBalanceHidden
    ? 1
    : Math.max(...items.map((item) => Math.abs(item.value)), 0);

  if (items.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <ul className="rb-composition-list">
      {items.map((item) => {
        const width = isBalanceHidden
          ? 56
          : maxValue > 0
            ? Math.max(8, (Math.abs(item.value) / maxValue) * 100)
            : 8;

        return (
          <li className="rb-composition-item" key={item.label}>
            <div className="rb-composition-item__copy">
              <span>{item.label}</span>
              <NumberValue>
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : formatCurrency(item.value)}
              </NumberValue>
            </div>
            <div className="rb-composition-track" aria-hidden="true">
              <div
                className={`rb-composition-track__fill rb-composition-track__fill--${tone}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardCharts({
  accountBalances,
  expenses,
  highlightClassName = "",
  isBalanceHidden,
  moneyAccounts,
  remainingBalance,
  totalExpense,
  totalIncome,
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
  const cashflowMaximum = isBalanceHidden
    ? 1
    : Math.max(
        Math.abs(totalIncome),
        Math.abs(totalExpense),
        Math.abs(remainingBalance),
        1,
      );
  const cashflowItems = [
    {
      label: "Pemasukan",
      tone: isBalanceHidden ? "masked" : "income",
      value: totalIncome,
    },
    {
      label: "Pengeluaran",
      tone: isBalanceHidden ? "masked" : "expense",
      value: totalExpense,
    },
    {
      label: "Selisih",
      tone: isBalanceHidden
        ? "masked"
        : remainingBalance < 0
          ? "negative"
          : "net",
      value: remainingBalance,
    },
  ];

  return (
    <section
      className={`rb-vault-chart ${highlightClassName}`}
      id="dashboard-charts"
    >
      <header className="rb-vault-chart__header">
        <div>
          <p className="ledger-eyebrow">Vault Split</p>
          <h2 className="ledger-section-title">Peta arus kas rumah tangga</h2>
          <p className="rb-vault-chart__description">
            Pemasukan, pengeluaran, dan selisih untuk periode saat ini.
            Komposisi akun dan kategori berdasarkan data tersimpan.
          </p>
        </div>
        <span className="ledger-state-tag">
          {isBalanceHidden ? "Privasi aktif" : "Ringkasan data"}
        </span>
      </header>

      <div
        aria-label="Arus kas periode saat ini"
        className="rb-cashflow-columns"
        role="list"
      >
        {cashflowItems.map((item) => {
          const stackLevelCount = isBalanceHidden
            ? 4
            : item.value === 0
              ? 0
              : Math.max(
                  1,
                  Math.round(
                    (Math.abs(item.value) / cashflowMaximum) * 5,
                  ),
                );

          return (
            <div
              className="rb-cashflow-column"
              data-tone={item.tone}
              key={item.label}
              role="listitem"
            >
              <div className="rb-cashflow-column__plot" aria-hidden="true">
                <div className="rb-cashflow-column__stack">
                  {Array.from({ length: stackLevelCount }, (_, levelIndex) => (
                    <Image
                      alt=""
                      className="rb-cashflow-column__cash"
                      draggable={false}
                      height={128}
                      key={`${item.label}-${levelIndex}`}
                      src="/assets/rumahbudget/pixel-cash.png"
                      unoptimized
                      width={128}
                    />
                  ))}
                </div>
              </div>
              <div className="rb-cashflow-column__copy">
                <span>{item.label}</span>
                <NumberValue>
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(item.value)}
                </NumberValue>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rb-vault-composition">
        <section aria-labelledby="account-composition-title">
          <div className="rb-vault-composition__header">
            <h3 id="account-composition-title">Komposisi akun</h3>
            <span>{accountItems.length} akun</span>
          </div>
          <div className="rb-vault-composition__content">
            <SimpleBarList
              emptyMessage="Belum ada akun uang."
              isBalanceHidden={isBalanceHidden}
              items={accountItems}
              tone="account"
            />
          </div>
        </section>

        <section aria-labelledby="expense-composition-title">
          <div className="rb-vault-composition__header">
            <h3 id="expense-composition-title">Kategori pengeluaran</h3>
            <span>{expenseItems.length} kategori</span>
          </div>
          <div className="rb-vault-composition__content">
            <SimpleBarList
              emptyMessage="Belum ada pengeluaran."
              isBalanceHidden={isBalanceHidden}
              items={expenseItems}
              tone="expense"
            />
          </div>
        </section>
      </div>
    </section>
  );
}
