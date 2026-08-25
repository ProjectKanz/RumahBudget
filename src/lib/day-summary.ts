type DayEntry = {
  amount: number;
  transactionDate?: string;
};

export type DaySummary = {
  expenseCount: number;
  expenseTotal: number;
  incomeCount: number;
  incomeTotal: number;
  /** Expenses minus income. Negative means the day ended up net positive. */
  netOutflow: number;
  /**
   * The part of the day's spending that income covered. Money fronted for
   * someone and paid back shows up here, and is the difference between what left
   * the accounts and what the day actually cost.
   */
  offsetTotal: number;
};

function total(entries: DayEntry[], dateKey: string) {
  return entries.reduce(
    (running, entry) => {
      if (!entry.transactionDate || entry.transactionDate !== dateKey) {
        return running;
      }

      const amount = Number(entry.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return running;
      }

      return { count: running.count + 1, sum: running.sum + amount };
    },
    { count: 0, sum: 0 },
  );
}

/**
 * What one day cost, separating money that left the accounts from money that
 * stayed gone.
 *
 * Gross spending alone overstates a day where something was fronted and then
 * reimbursed: both legs are real ledger rows, but the pair nets to nothing.
 * Transfers are excluded on purpose, since moving money between your own
 * accounts is not a cost.
 */
export function summarizeDay({
  dateKey,
  expenses,
  incomes,
}: {
  dateKey: string;
  expenses: DayEntry[];
  incomes: DayEntry[];
}): DaySummary {
  const expense = total(expenses, dateKey);
  const income = total(incomes, dateKey);

  return {
    expenseCount: expense.count,
    expenseTotal: expense.sum,
    incomeCount: income.count,
    incomeTotal: income.sum,
    netOutflow: expense.sum - income.sum,
    offsetTotal: Math.min(expense.sum, income.sum),
  };
}
