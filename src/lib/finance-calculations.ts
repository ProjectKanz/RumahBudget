import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Transfer } from "@/src/types/transfer";
import type { TradingResult } from "@/src/types/trading-result";

type FinanceCalculationInput = {
  accounts: MoneyAccount[];
  incomes: Income[];
  expenses: Expense[];
  transfers: Transfer[];
  tradingResults?: TradingResult[];
  now?: number;
  periodReference?: number;
};

export type FinanceSnapshot = {
  accountBalances: Record<string, number>;
  totalBalance: number;
  monthlyIncomes: Income[];
  monthlyExpenses: Expense[];
  monthlyTradingResults: TradingResult[];
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyTradingNet: number;
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

function getUniqueSourceIncomeIds(tradingResults: TradingResult[]) {
  const sourceCounts = new Map<string, number>();

  tradingResults.forEach((result) => {
    if (result.sourceIncomeId) {
      sourceCounts.set(
        result.sourceIncomeId,
        (sourceCounts.get(result.sourceIncomeId) ?? 0) + 1,
      );
    }
  });

  return new Set(
    [...sourceCounts.entries()]
      .filter(([, count]) => count === 1)
      .map(([sourceIncomeId]) => sourceIncomeId),
  );
}

export function getHouseholdIncomes(
  incomes: Income[],
  tradingResults: TradingResult[],
) {
  const migratedIncomeIds = getUniqueSourceIncomeIds(tradingResults);
  return incomes.filter((income) => !migratedIncomeIds.has(income.id));
}

export function calculateFinanceSnapshot({
  accounts,
  incomes,
  expenses,
  transfers,
  tradingResults = [],
  now = Date.now(),
  periodReference = now,
}: FinanceCalculationInput): FinanceSnapshot {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const sourceCounts = new Map<string, number>();
  tradingResults.forEach((result) => {
    if (result.sourceIncomeId) {
      sourceCounts.set(
        result.sourceIncomeId,
        (sourceCounts.get(result.sourceIncomeId) ?? 0) + 1,
      );
    }
  });
  const validTradingResults = tradingResults.filter((result) => {
    const account = accountById.get(result.accountId);
    return (
      Boolean(account) &&
      account?.purpose === "trading" &&
      !account.isArchived &&
      account.userId === result.userId &&
      Number.isFinite(result.netAmount) &&
      result.netAmount !== 0 &&
      (!result.sourceIncomeId || sourceCounts.get(result.sourceIncomeId) === 1)
    );
  });
  const householdIncomes = getHouseholdIncomes(incomes, validTradingResults);
  const monthlyIncomes = householdIncomes.filter((income) =>
    isSameLocalMonth(income.createdAt, periodReference),
  );
  const monthlyExpenses = expenses.filter((expense) =>
    isSameLocalMonth(expense.createdAt, periodReference),
  );
  const monthlyTradingResults = validTradingResults.filter((result) =>
    isSameLocalMonth(result.createdAt, periodReference),
  );

  const accountBalances = accounts.reduce<Record<string, number>>(
    (balances, account) => {
      balances[account.id] = account.initialBalance;
      return balances;
    },
    {},
  );

  householdIncomes.forEach((income) => {
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

  validTradingResults.forEach((result) => {
    accountBalances[result.accountId] += result.netAmount;
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
  const monthlyTradingNet = monthlyTradingResults.reduce(
    (total, result) => total + result.netAmount,
    0,
  );

  return {
    accountBalances,
    totalBalance,
    monthlyIncomes,
    monthlyExpenses,
    monthlyTradingResults,
    monthlyIncome,
    monthlyExpense,
    monthlyTradingNet,
    netCashflow: monthlyIncome - monthlyExpense,
  };
}
