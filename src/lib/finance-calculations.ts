import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";

type FinanceCalculationInput = {
  accounts: MoneyAccount[];
  incomes: Income[];
  expenses: Expense[];
  transfers: Transfer[];
  now?: number;
};

export type FinanceSnapshot = {
  accountBalances: Record<string, number>;
  totalBalance: number;
  monthlyIncomes: Income[];
  monthlyExpenses: Expense[];
  monthlyIncome: number;
  monthlyExpense: number;
  netCashflow: number;
};

function isSameLocalMonth(timestamp: number, referenceTimestamp: number) {
  if (!timestamp) {
    return false;
  }

  const transactionDate = new Date(timestamp);
  const referenceDate = new Date(referenceTimestamp);

  return (
    transactionDate.getFullYear() === referenceDate.getFullYear() &&
    transactionDate.getMonth() === referenceDate.getMonth()
  );
}

export function calculateFinanceSnapshot({
  accounts,
  incomes,
  expenses,
  transfers,
  now = Date.now(),
}: FinanceCalculationInput): FinanceSnapshot {
  const monthlyIncomes = incomes.filter((income) =>
    isSameLocalMonth(income.createdAt, now),
  );
  const monthlyExpenses = expenses.filter((expense) =>
    isSameLocalMonth(expense.createdAt, now),
  );

  const accountBalances = accounts.reduce<Record<string, number>>(
    (balances, account) => {
      balances[account.id] = account.initialBalance;
      return balances;
    },
    {},
  );

  incomes.forEach((income) => {
    if (income.accountId && income.accountId in accountBalances) {
      accountBalances[income.accountId] += income.amount;
    }
  });

  expenses.forEach((expense) => {
    if (expense.accountId && expense.accountId in accountBalances) {
      accountBalances[expense.accountId] -= expense.amount;
    }
  });

  transfers.forEach((transfer) => {
    if (transfer.toAccountId && transfer.toAccountId in accountBalances) {
      accountBalances[transfer.toAccountId] += transfer.amount;
    }

    if (transfer.fromAccountId && transfer.fromAccountId in accountBalances) {
      accountBalances[transfer.fromAccountId] -= transfer.amount;
    }
  });

  const totalBalance = accounts.reduce(
    (total, account) => total + (accountBalances[account.id] ?? account.initialBalance),
    0,
  );
  const monthlyIncome = monthlyIncomes.reduce(
    (total, income) => total + income.amount,
    0,
  );
  const monthlyExpense = monthlyExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  return {
    accountBalances,
    totalBalance,
    monthlyIncomes,
    monthlyExpenses,
    monthlyIncome,
    monthlyExpense,
    netCashflow: monthlyIncome - monthlyExpense,
  };
}
