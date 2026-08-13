export type Transfer = {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note: string;
  createdAt: number;
  transactionDate?: string;
};
