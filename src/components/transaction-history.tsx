"use client";

import {
  EmptyState,
  NumberValue,
  SectionHeader,
  SegmentedControl,
  SharpButton,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";
import { useMemo, useState } from "react";

type TransactionFilter = "All" | "Income" | "Expenses" | "Transfers";

type CombinedTransaction =
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Income";
      amount: number;
      accountName: string;
      title: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Expenses";
      amount: number;
      accountName: string;
      title: string;
      paymentMethod: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      type: "Transfers";
      amount: number;
      fromAccountName: string;
      toAccountName: string;
      title: string;
      note: string;
    };

const filters: TransactionFilter[] = ["All", "Income", "Expenses", "Transfers"];
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const categoryLabels = new Map([
  ["Belanja Dapur", "Groceries"],
  ["Transportasi", "Transportation"],
  ["Tagihan", "Bills"],
  ["Pendidikan", "Education"],
  ["Kesehatan", "Health"],
  ["Lainnya", "Other"],
]);
const paymentMethodLabels = new Map([
  ["Tunai", "Cash"],
  ["Kartu Debit", "Debit Card"],
  ["E-Wallet", "E-Wallet"],
  ["Transfer Bank", "Bank Transfer"],
]);

type TransactionHistoryProps = {
  accountLabel: string;
  moneyAccounts: MoneyAccount[];
  expenses: Expense[];
  incomes: Income[];
  transfers: Transfer[];
  onDeleteExpense: (id: string) => void | Promise<void>;
  onDeleteIncome: (id: string) => void | Promise<void>;
  onDeleteTransfer: (id: string) => void | Promise<void>;
  netHourlyWage?: number;
};

export default function TransactionHistory({
  accountLabel,
  moneyAccounts,
  expenses,
  incomes,
  transfers,
  onDeleteExpense,
  onDeleteIncome,
  onDeleteTransfer,
  netHourlyWage = 0,
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>("All");

  const transactions = useMemo(() => {
    const accountNames = new Map(
      moneyAccounts.map((account) => [account.id, account.name]),
    );
    const incomeTransactions: CombinedTransaction[] = incomes.map((income) => ({
      id: income.id,
      owner: income.owner,
      createdAt: income.createdAt ?? 0,
      type: "Income",
      amount: income.amount,
      accountName: accountNames.get(income.accountId) ?? "Unassigned",
      title: income.source,
      note: income.note,
    }));

    const expenseTransactions: CombinedTransaction[] = expenses.map(
      (expense) => ({
        id: expense.id,
        owner: expense.owner,
        createdAt: expense.createdAt ?? 0,
        type: "Expenses",
        amount: expense.amount,
        accountName: accountNames.get(expense.accountId) ?? "Unassigned",
        title: categoryLabels.get(expense.category) ?? expense.category,
        paymentMethod: expense.paymentMethod,
        note: expense.note,
      }),
    );
    const transferTransactions: CombinedTransaction[] = transfers.map(
      (transfer) => {
        const fromAccountName =
          accountNames.get(transfer.fromAccountId) ?? "Unassigned";
        const toAccountName =
          accountNames.get(transfer.toAccountId) ?? "Unassigned";

        return {
          id: transfer.id,
          owner: transfer.userId,
          createdAt: transfer.createdAt ?? 0,
          type: "Transfers",
          amount: transfer.amount,
          fromAccountName,
          toAccountName,
          title: `${fromAccountName} to ${toAccountName}`,
          note: transfer.note,
        };
      },
    );

    return [
      ...incomeTransactions,
      ...expenseTransactions,
      ...transferTransactions,
    ].sort(
      (firstTransaction, secondTransaction) =>
        secondTransaction.createdAt - firstTransaction.createdAt,
    );
  }, [expenses, incomes, moneyAccounts, transfers]);

  const filteredTransactions = useMemo(
    () =>
      filter === "All"
        ? transactions
        : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions],
  );

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-8 pt-5 sm:px-6"
      id="transaction-history"
    >
      <TerminalPanel className="!p-5 sm:!p-6">
        <SectionHeader
          action={
            <SegmentedControl
              className="grid-cols-2 lg:min-w-[32rem] lg:grid-cols-4"
              options={filters.map((option) => ({
                label: option === "Transfers" ? "Transfer" : option,
                value: option,
              }))}
              value={filter}
              onChange={setFilter}
            />
          }
          description={
            <>
              All income, expenses, and transfers in one place for{" "}
              <span className="text-slate-200">{accountLabel}</span>.
            </>
          }
          eyebrow="Transaction History"
          title="Ledger records"
          tone="cyan"
        />

        <div className="mt-5 space-y-3">
          {filteredTransactions.length === 0 ? (
            <EmptyState>
              No transactions for this filter yet.
            </EmptyState>
          ) : (
            filteredTransactions.map((transaction) => {
              const isIncome = transaction.type === "Income";
              const isTransfer = transaction.type === "Transfers";
              const transactionTypeLabel = isTransfer
                ? "Transfer"
                : isIncome
                  ? "Income"
                  : "Expense";
              const transactionDate =
                transaction.createdAt > 0
                  ? dateTimeFormatter.format(new Date(transaction.createdAt))
                  : "Date unavailable";

              return (
                <article
                  className={`cockpit-card flex flex-col gap-3 border p-5 sm:flex-row sm:items-center sm:justify-between ${
                    isTransfer
                      ? "border-cyan-300/30 bg-cyan-300/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                  key={`${transaction.type}-${transaction.id}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip
                        className="inline-flex min-w-28 justify-center whitespace-nowrap py-1 text-center"
                        tone={isTransfer ? "cyan" : isIncome ? "lime" : "rose"}
                      >
                        {transactionTypeLabel}
                      </StatusChip>
                      <span className="text-xs text-slate-500">
                        {transaction.owner}
                      </span>
                      <span className="text-xs text-slate-500">
                        {transactionDate}
                      </span>
                    </div>

                    <p
                      className={`mt-3 text-xl font-bold ${
                        isTransfer
                          ? "text-cyan-300"
                          : isIncome
                            ? "text-lime-300"
                            : "text-rose-300"
                      }`}
                    >
                      <NumberValue>
                        {isTransfer ? "" : isIncome ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </NumberValue>
                      {transaction.type === "Expenses" && netHourlyWage > 0 && (
                        <span className="ml-2 text-sm font-mono text-cyan-300/80">
                          (~{(transaction.amount / netHourlyWage).toFixed(1)} hrs)
                        </span>
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {transaction.title}
                      {!isIncome && !isTransfer
                        ? ` / ${
                            paymentMethodLabels.get(transaction.paymentMethod) ??
                            transaction.paymentMethod
                          }`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isTransfer
                        ? `Transfer: ${transaction.fromAccountName} to ${transaction.toAccountName}`
                        : `Account: ${transaction.accountName}`}
                    </p>

                    {transaction.note ? (
                      <p className="mt-2 text-sm text-slate-500">
                        {transaction.note}
                      </p>
                    ) : null}
                  </div>

                  <SharpButton
                    className="min-h-10 px-3 py-2"
                    variant="danger"
                    type="button"
                    onClick={() => {
                      const didConfirm = window.confirm(
                        `Delete this ${transactionTypeLabel.toLowerCase()} record? This cannot be undone.`,
                      );

                      if (!didConfirm) {
                        return;
                      }

                      if (isIncome) {
                        void onDeleteIncome(transaction.id);
                        return;
                      }

                      if (isTransfer) {
                        void onDeleteTransfer(transaction.id);
                        return;
                      }

                      void onDeleteExpense(transaction.id);
                    }}
                  >
                    Delete
                  </SharpButton>
                </article>
              );
            })
          )}
        </div>
      </TerminalPanel>
    </section>
  );
}
