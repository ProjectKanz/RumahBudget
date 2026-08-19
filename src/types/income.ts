export type Income = {
  id: string;
  owner: string;
  userId: string;
  accountId: string;
  createdAt: number;
  transactionDate?: string;
  affectsDailyAllowance?: boolean;
  amount: number;
  source: string;
  note: string;
};
