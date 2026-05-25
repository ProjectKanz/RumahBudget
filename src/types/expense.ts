export type Expense = {
  id: string;
  owner: string;
  userId: string;
  accountId: string;
  createdAt: number;
  amount: number;
  category: string;
  paymentMethod: string;
  note: string;
};
