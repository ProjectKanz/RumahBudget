"use client";

import {
  EmptyState,
  Notice,
  NumberValue,
  SectionHeader,
  SegmentedControl,
  SharpButton,
  SharpInput,
  SharpSelect,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import {
  EXPENSE_CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/src/lib/expense-options";
import { summarizeDay } from "@/src/lib/day-summary";
import { calculateLifeEnergyHours } from "@/src/lib/life-energy";
import {
  localDateInputToTimestamp,
  timestampToLocalDateInputValue,
  type LedgerTransactionUpdate,
} from "@/src/lib/transaction-entry";
import type { BudgetLine } from "@/src/types/budget-line";
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
      transactionDate: string;
      type: "Income";
      amount: number;
      accountId: string;
      accountName: string;
      title: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      transactionDate: string;
      type: "Expenses";
      amount: number;
      accountId: string;
      accountName: string;
      category: string;
      budgetLineId?: string;
      description: string;
      title: string;
      paymentMethod: string;
      note: string;
    }
  | {
      id: string;
      owner: string;
      createdAt: number;
      transactionDate: string;
      type: "Transfers";
      amount: number;
      fromAccountId: string;
      fromAccountName: string;
      toAccountId: string;
      toAccountName: string;
      title: string;
      note: string;
    };

const filters: TransactionFilter[] = ["All", "Income", "Expenses", "Transfers"];
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
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
  error?: string;
  isBalanceHidden: boolean;
  isLoading?: boolean;
  netHourlyWage?: number;
  todayKey: string;
  onUpdateTransaction?: (
    update: LedgerTransactionUpdate,
  ) => Promise<boolean>;
  budgetLines?: BudgetLine[];
  onUpdateExpenseBudgetLine?: (
    expenseId: string,
    budgetLineId: string | null,
  ) => Promise<boolean>;
};

const UNCATEGORIZED_BUDGET_LINE_VALUE = "";

/**
 * Reclassification control. The select is driven purely by the persisted value,
 * never by local optimistic state: a rejected write leaves the old label on
 * screen and surfaces the failure instead of quietly looking saved.
 */
function BudgetLineSelect({
  budgetLineId,
  budgetLines,
  expenseId,
  onUpdateExpenseBudgetLine,
}: {
  budgetLineId: string | undefined;
  budgetLines: BudgetLine[];
  expenseId: string;
  onUpdateExpenseBudgetLine: (
    expenseId: string,
    budgetLineId: string | null,
  ) => Promise<boolean>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const selectedValue = budgetLineId ?? UNCATEGORIZED_BUDGET_LINE_VALUE;
  // An archived or otherwise unassignable line must still render its own name,
  // otherwise the row would silently look Uncategorized.
  const isMissingOption =
    Boolean(budgetLineId) &&
    !budgetLines.some((line) => line.id === budgetLineId);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">
        Budget line
      </span>
      <SharpSelect
        className="min-h-9 py-1 text-sm"
        aria-label="Budget line"
        disabled={isSaving}
        value={selectedValue}
        onChange={async (event) => {
          const nextValue = event.target.value;
          setIsSaving(true);
          setHasFailed(false);

          const didSave = await onUpdateExpenseBudgetLine(
            expenseId,
            nextValue === UNCATEGORIZED_BUDGET_LINE_VALUE ? null : nextValue,
          );

          setIsSaving(false);
          setHasFailed(!didSave);
        }}
      >
        <option value={UNCATEGORIZED_BUDGET_LINE_VALUE}>Uncategorized</option>
        {isMissingOption ? (
          <option value={selectedValue}>Unavailable line</option>
        ) : null}
        {budgetLines.map((line) => (
          <option key={line.id} value={line.id}>
            {line.name}
          </option>
        ))}
      </SharpSelect>
      {isSaving ? (
        <span className="text-xs text-slate-500">Saving...</span>
      ) : null}
      {hasFailed ? (
        <span className="text-xs text-rose-600">Not saved. Try again.</span>
      ) : null}
    </div>
  );
}

function getTransactionDate(transactionDate: string | undefined, createdAt: number) {
  if (transactionDate) {
    return transactionDate;
  }

  return createdAt > 0 ? timestampToLocalDateInputValue(createdAt) : "";
}

function escapeCsvValue(value: string | number) {
  const normalized = String(value).replace(/\r?\n/g, " ");
  const spreadsheetSafe = /^[=+\-@]/.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

export default function TransactionHistory({
  accountLabel,
  moneyAccounts,
  expenses,
  incomes,
  transfers,
  onDeleteExpense,
  onDeleteIncome,
  onDeleteTransfer,
  error = "",
  isBalanceHidden,
  isLoading = false,
  netHourlyWage = 0,
  onUpdateTransaction,
  budgetLines = [],
  onUpdateExpenseBudgetLine,
  todayKey,
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>("All");
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editDraft, setEditDraft] = useState<LedgerTransactionUpdate | null>(
    null,
  );
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Gross spending overstates a day where something was fronted and reimbursed:
  // both legs are real rows, but the pair nets to nothing.
  const todaySummary = useMemo(
    () => summarizeDay({ dateKey: todayKey, expenses, incomes }),
    [expenses, incomes, todayKey],
  );

  const transactions = useMemo(() => {
    const accountNames = new Map(
      moneyAccounts.map((account) => [account.id, account.name]),
    );
    const incomeTransactions: CombinedTransaction[] = incomes.map((income) => ({
      id: income.id,
      owner: income.owner,
      createdAt: income.createdAt ?? 0,
      transactionDate: getTransactionDate(
        income.transactionDate,
        income.createdAt,
      ),
      type: "Income",
      amount: income.amount,
      accountId: income.accountId,
      accountName: accountNames.get(income.accountId) ?? "Unassigned",
      title: income.source,
      note: income.note,
    }));

    const expenseTransactions: CombinedTransaction[] = expenses.map(
      (expense) => {
        const category = categoryLabels.get(expense.category) ?? expense.category;
        const description = expense.description?.trim() ?? "";
        const paymentMethod =
          paymentMethodLabels.get(expense.paymentMethod) ?? expense.paymentMethod;

        return {
          id: expense.id,
          owner: expense.owner,
          createdAt: expense.createdAt ?? 0,
          transactionDate: getTransactionDate(
            expense.transactionDate,
            expense.createdAt,
          ),
          type: "Expenses",
          amount: expense.amount,
          accountId: expense.accountId,
          accountName: accountNames.get(expense.accountId) ?? "Unassigned",
          category,
          budgetLineId: expense.budgetLineId,
          description,
          title: description || category,
          paymentMethod,
          note: expense.note,
        };
      },
    );
    const transferTransactions: CombinedTransaction[] = transfers.map(
      (transfer) => {
        const fromAccountName =
          accountNames.get(transfer.fromAccountId) ?? "Unassigned";
        const toAccountName =
          accountNames.get(transfer.toAccountId) ?? "Unassigned";

        return {
          id: transfer.id,
          owner: accountLabel,
          createdAt: transfer.createdAt ?? 0,
          transactionDate: getTransactionDate(
            transfer.transactionDate,
            transfer.createdAt,
          ),
          type: "Transfers",
          amount: transfer.amount,
          fromAccountId: transfer.fromAccountId,
          fromAccountName,
          toAccountId: transfer.toAccountId,
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
    ].sort((firstTransaction, secondTransaction) => {
      const dateDifference =
        (localDateInputToTimestamp(secondTransaction.transactionDate) ??
          secondTransaction.createdAt) -
        (localDateInputToTimestamp(firstTransaction.transactionDate) ??
          firstTransaction.createdAt);

      return dateDifference || secondTransaction.createdAt - firstTransaction.createdAt;
    });
  }, [accountLabel, expenses, incomes, moneyAccounts, transfers]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (filter !== "All" && transaction.type !== filter) {
        return false;
      }

      if (
        dateFrom &&
        (!transaction.transactionDate || transaction.transactionDate < dateFrom)
      ) {
        return false;
      }

      if (
        dateTo &&
        (!transaction.transactionDate || transaction.transactionDate > dateTo)
      ) {
        return false;
      }

      if (accountFilter !== "All") {
        const matchesAccount =
          transaction.type === "Transfers"
            ? transaction.fromAccountId === accountFilter ||
              transaction.toAccountId === accountFilter
            : transaction.accountId === accountFilter;

        if (!matchesAccount) {
          return false;
        }
      }

      if (
        categoryFilter !== "All" &&
        (transaction.type !== "Expenses" ||
          transaction.category !== categoryFilter)
      ) {
        return false;
      }

      if (
        paymentMethodFilter !== "All" &&
        (transaction.type !== "Expenses" ||
          transaction.paymentMethod !== paymentMethodFilter)
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText =
        transaction.type === "Transfers"
          ? [
              transaction.title,
              transaction.note,
              transaction.owner,
              transaction.fromAccountName,
              transaction.toAccountName,
            ]
          : transaction.type === "Expenses"
            ? [
                transaction.title,
                transaction.description,
                transaction.category,
                transaction.paymentMethod,
                transaction.note,
                transaction.owner,
                transaction.accountName,
              ]
            : [
                transaction.title,
                transaction.note,
                transaction.owner,
                transaction.accountName,
              ];

      return searchableText.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [
    accountFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    filter,
    paymentMethodFilter,
    query,
    transactions,
  ]);

  const hasSecondaryFilters = Boolean(
    query ||
      dateFrom ||
      dateTo ||
      accountFilter !== "All" ||
      categoryFilter !== "All" ||
      paymentMethodFilter !== "All",
  );

  function clearSecondaryFilters() {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setAccountFilter("All");
    setCategoryFilter("All");
    setPaymentMethodFilter("All");
  }

  function exportFilteredTransactions() {
    if (isBalanceHidden || filteredTransactions.length === 0) {
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Description",
      "Account",
      "Category",
      "Payment Method",
      "Amount",
      "Note",
      "Owner",
    ];
    const rows = filteredTransactions.map((transaction) => {
      const account =
        transaction.type === "Transfers"
          ? `${transaction.fromAccountName} -> ${transaction.toAccountName}`
          : transaction.accountName;
      const category =
        transaction.type === "Expenses" ? transaction.category : "";
      const paymentMethod =
        transaction.type === "Expenses" ? transaction.paymentMethod : "";

      return [
        transaction.transactionDate,
        transaction.type === "Expenses"
          ? "Expense"
          : transaction.type === "Transfers"
            ? "Transfer"
            : "Income",
        transaction.title,
        account,
        category,
        paymentMethod,
        transaction.amount,
        transaction.note,
        transaction.owner,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rumahbudget-ledger-${timestampToLocalDateInputValue(Date.now())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function beginEdit(transaction: CombinedTransaction) {
    setEditError("");

    if (transaction.type === "Expenses") {
      setEditDraft({
        type: "expense",
        id: transaction.id,
        accountId: transaction.accountId,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
        note: transaction.note,
        paymentMethod: transaction.paymentMethod,
        transactionDate: transaction.transactionDate,
      });
      return;
    }

    if (transaction.type === "Income") {
      setEditDraft({
        type: "income",
        id: transaction.id,
        accountId: transaction.accountId,
        amount: transaction.amount,
        note: transaction.note,
        source: transaction.title,
        transactionDate: transaction.transactionDate,
      });
      return;
    }

    setEditDraft({
      type: "transfer",
      id: transaction.id,
      amount: transaction.amount,
      fromAccountId: transaction.fromAccountId,
      note: transaction.note,
      toAccountId: transaction.toAccountId,
      transactionDate: transaction.transactionDate,
    });
  }

  async function saveEdit() {
    if (!editDraft || !onUpdateTransaction) {
      return;
    }

    if (!Number.isFinite(editDraft.amount) || editDraft.amount <= 0) {
      setEditError("Enter an amount greater than 0.");
      return;
    }

    if (!localDateInputToTimestamp(editDraft.transactionDate)) {
      setEditError("Choose a valid transaction date.");
      return;
    }

    if (editDraft.type === "expense" && !editDraft.description.trim()) {
      setEditError("Enter a merchant or transaction description.");
      return;
    }

    if (editDraft.type === "income" && !editDraft.source.trim()) {
      setEditError("Enter an income source or description.");
      return;
    }

    if (
      editDraft.type !== "transfer" &&
      !moneyAccounts.some((account) => account.id === editDraft.accountId)
    ) {
      setEditError("Choose an active account.");
      return;
    }

    if (
      editDraft.type === "transfer" &&
      (editDraft.fromAccountId === editDraft.toAccountId ||
        !moneyAccounts.some(
          (account) => account.id === editDraft.fromAccountId,
        ) ||
        !moneyAccounts.some((account) => account.id === editDraft.toAccountId))
    ) {
      setEditError("Choose two different active accounts.");
      return;
    }

    setIsUpdating(true);
    setEditError("");

    try {
      const didUpdate = await onUpdateTransaction(editDraft);

      if (didUpdate) {
        setEditDraft(null);
      } else {
        setEditError("The transaction could not be updated.");
      }
    } catch (updateError) {
      setEditError(
        updateError instanceof Error
          ? updateError.message
          : "The transaction could not be updated.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

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
              <span className="text-slate-200">
                {isBalanceHidden ? "hidden account" : accountLabel}
              </span>
              .
            </>
          }
          eyebrow="Transaction History"
          title="Ledger records"
          tone="cyan"
        />

        <div className="mt-5 border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">
              Hari ini · {todayKey}
            </p>
            <p className="text-xs text-slate-500">
              Seluruh akun, di luar filter. Transfer antar akun sendiri tidak dihitung.
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.02] px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Keluar</p>
              <p className="mt-1 text-lg font-black text-rose-200">
                <NumberValue>
                  {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(todaySummary.expenseTotal)}
                </NumberValue>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {todaySummary.expenseCount} pengeluaran
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.02] px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Masuk</p>
              <p className="mt-1 text-lg font-black text-lime-200">
                <NumberValue>
                  {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(todaySummary.incomeTotal)}
                </NumberValue>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {todaySummary.incomeCount} pemasukan
              </p>
            </div>
            <div className="border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">
                Benar-benar keluar
              </p>
              <p
                className={`mt-1 text-lg font-black ${
                  todaySummary.netOutflow > 0 ? "text-rose-200" : "text-lime-200"
                }`}
              >
                <NumberValue>
                  {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(todaySummary.netOutflow)}
                </NumberValue>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {todaySummary.offsetTotal > 0
                  ? `${formatCurrency(todaySummary.offsetTotal)} tertutup pemasukan hari ini.`
                  : "Belum ada pemasukan yang menutup pengeluaran hari ini."}
              </p>
            </div>
          </div>
        </div>

        {!isBalanceHidden ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-300 sm:col-span-2 lg:col-span-3">
            Search ledger
            <SharpInput
              placeholder="Search description, note, account, category, or payment method"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="text-sm text-slate-300">
            From date
            <SharpInput
              max={dateTo || undefined}
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label className="text-sm text-slate-300">
            To date
            <SharpInput
              min={dateFrom || undefined}
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <label className="text-sm text-slate-300">
            Account
            <SharpSelect
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="All">All accounts</option>
              {moneyAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SharpSelect>
          </label>

          <label className="text-sm text-slate-300">
            Category
            <SharpSelect
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="All">All categories</option>
              {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </SharpSelect>
          </label>

          <label className="text-sm text-slate-300">
            Payment method
            <SharpSelect
              value={paymentMethodFilter}
              onChange={(event) => setPaymentMethodFilter(event.target.value)}
            >
              <option value="All">All payment methods</option>
              {PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                <option key={paymentMethod.value} value={paymentMethod.value}>
                  {paymentMethod.label}
                </option>
              ))}
            </SharpSelect>
          </label>
          </div>
        ) : (
          <Notice className="mt-5">
            Ledger search and detailed filters are hidden while privacy mode is
            active.
          </Notice>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {filteredTransactions.length} of {transactions.length} records
          </p>
          <div className="flex flex-wrap gap-2">
            {hasSecondaryFilters ? (
              <SharpButton type="button" onClick={clearSecondaryFilters}>
                Clear Filters
              </SharpButton>
            ) : null}
            <SharpButton
              disabled={
                isBalanceHidden || filteredTransactions.length === 0
              }
              title={
                isBalanceHidden
                  ? "Turn off privacy mode before exporting sensitive data."
                  : undefined
              }
              type="button"
              onClick={exportFilteredTransactions}
            >
              Export Filtered CSV
            </SharpButton>
          </div>
        </div>

        {error ? (
          <Notice className="mt-4" tone="rose">
            {error}
          </Notice>
        ) : null}

        {!isBalanceHidden && editDraft ? (
          <div className="cockpit-card mt-4 border border-cyan-300/30 bg-cyan-300/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-white">Edit transaction</h3>
              <SharpButton type="button" onClick={() => setEditDraft(null)}>
                Cancel
              </SharpButton>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Amount
                <SharpInput
                  inputMode="numeric"
                  min="0"
                  type="number"
                  value={String(editDraft.amount)}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      amount: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Transaction date
                <SharpInput
                  type="date"
                  value={editDraft.transactionDate}
                  onChange={(event) =>
                    setEditDraft({
                      ...editDraft,
                      transactionDate: event.target.value,
                    })
                  }
                />
              </label>

              {editDraft.type === "expense" ? (
                <>
                  <label className="text-sm text-slate-300 sm:col-span-2">
                    Merchant / Description
                    <SharpInput
                      maxLength={120}
                      value={editDraft.description}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Account
                    <SharpSelect
                      value={editDraft.accountId}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          accountId: event.target.value,
                        })
                      }
                    >
                      {moneyAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                  <label className="text-sm text-slate-300">
                    Category
                    <SharpSelect
                      value={editDraft.category}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          category: event.target.value,
                        })
                      }
                    >
                      {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                  <label className="text-sm text-slate-300">
                    Payment method
                    <SharpSelect
                      value={editDraft.paymentMethod}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          paymentMethod: event.target.value,
                        })
                      }
                    >
                      {PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                        <option
                          key={paymentMethod.value}
                          value={paymentMethod.value}
                        >
                          {paymentMethod.label}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                </>
              ) : null}

              {editDraft.type === "income" ? (
                <>
                  <label className="text-sm text-slate-300">
                    Account
                    <SharpSelect
                      value={editDraft.accountId}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          accountId: event.target.value,
                        })
                      }
                    >
                      {moneyAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                  <label className="text-sm text-slate-300">
                    Source / Description
                    <SharpInput
                      maxLength={120}
                      value={editDraft.source}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          source: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : null}

              {editDraft.type === "transfer" ? (
                <>
                  <label className="text-sm text-slate-300">
                    From account
                    <SharpSelect
                      value={editDraft.fromAccountId}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          fromAccountId: event.target.value,
                        })
                      }
                    >
                      {moneyAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                  <label className="text-sm text-slate-300">
                    To account
                    <SharpSelect
                      value={editDraft.toAccountId}
                      onChange={(event) =>
                        setEditDraft({
                          ...editDraft,
                          toAccountId: event.target.value,
                        })
                      }
                    >
                      {moneyAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </SharpSelect>
                  </label>
                </>
              ) : null}

              <label className="text-sm text-slate-300 sm:col-span-2">
                Additional note (optional)
                <SharpInput
                  maxLength={240}
                  value={editDraft.note}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, note: event.target.value })
                  }
                />
              </label>
            </div>

            {editError ? (
              <Notice className="mt-3" tone="rose">
                {editError}
              </Notice>
            ) : null}

            <SharpButton
              className="mt-4"
              disabled={isUpdating}
              type="button"
              variant="primary"
              onClick={() => void saveEdit()}
            >
              {isUpdating ? "Saving changes..." : "Save Changes"}
            </SharpButton>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <EmptyState>Loading ledger records...</EmptyState>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState>
              {transactions.length === 0
                ? "No transactions yet."
                : "No transactions match the active filters."}
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
              const transactionTimestamp = localDateInputToTimestamp(
                transaction.transactionDate,
              );
              const transactionDate = transactionTimestamp
                ? dateFormatter.format(new Date(transactionTimestamp))
                : "Date unavailable";
              const lifeEnergyHours =
                transaction.type === "Expenses"
                  ? calculateLifeEnergyHours(
                      transaction.amount,
                      netHourlyWage,
                    )
                  : null;

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
                        {isBalanceHidden ? "Email hidden" : transaction.owner}
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
                        {isBalanceHidden
                          ? hiddenBalanceLabel
                          : `${isTransfer ? "" : isIncome ? "+" : "-"}${formatCurrency(transaction.amount)}`}
                      </NumberValue>
                      {!isBalanceHidden && lifeEnergyHours !== null ? (
                        <span className="ml-2 text-sm font-mono text-cyan-300/80">
                          (~{lifeEnergyHours.toFixed(1)} hrs)
                        </span>
                      ) : null}
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {isBalanceHidden
                        ? "Transaction details hidden"
                        : transaction.title}
                      {!isBalanceHidden &&
                      transaction.type === "Expenses"
                        ? ` / ${transaction.category} / ${
                            paymentMethodLabels.get(
                              transaction.paymentMethod,
                            ) ?? transaction.paymentMethod
                          }`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isBalanceHidden
                        ? "Account details hidden"
                        : isTransfer
                          ? `Transfer: ${transaction.fromAccountName} to ${transaction.toAccountName}`
                          : `Account: ${transaction.accountName}`}
                    </p>

                    {!isBalanceHidden && transaction.note ? (
                      <p className="mt-2 text-sm text-slate-500">
                        {transaction.note}
                      </p>
                    ) : null}

                    {!isBalanceHidden &&
                    transaction.type === "Expenses" &&
                    onUpdateExpenseBudgetLine ? (
                      <BudgetLineSelect
                        budgetLineId={transaction.budgetLineId}
                        budgetLines={budgetLines}
                        expenseId={transaction.id}
                        onUpdateExpenseBudgetLine={onUpdateExpenseBudgetLine}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {!isBalanceHidden && onUpdateTransaction ? (
                      <SharpButton
                        className="min-h-10 px-3 py-2"
                        type="button"
                        onClick={() => beginEdit(transaction)}
                      >
                        Edit
                      </SharpButton>
                    ) : null}
                    {!isBalanceHidden ? (
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
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </TerminalPanel>
    </section>
  );
}
