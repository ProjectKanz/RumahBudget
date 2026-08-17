export type Expense = {
  id: string;
  owner: string;
  userId: string;
  accountId: string;
  createdAt: number;
  description?: string;
  transactionDate?: string;
  amount: number;
  category: string;
  paymentMethod: string;
  note: string;
  recurringCommitmentId?: string;
  recurringPeriod?: string;
};
