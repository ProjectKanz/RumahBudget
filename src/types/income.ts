export type Income = {
  id: string;
  owner: string;
  userId: string;
  accountId: string;
  createdAt: number;
  transactionDate?: string;
  amount: number;
  source: string;
  note: string;
};
