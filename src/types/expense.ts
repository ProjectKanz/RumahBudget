import type { ActiveUser } from "@/src/types/user";

export type Expense = {
  id: string;
  owner: ActiveUser;
  createdAt: number;
  amount: number;
  category: string;
  paymentMethod: string;
  note: string;
};
