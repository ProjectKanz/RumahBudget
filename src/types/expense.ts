export type Expense = {
  id: string;
  owner: string;
  userId: string;
  createdAt: number;
  amount: number;
  category: string;
  paymentMethod: string;
  note: string;
};
