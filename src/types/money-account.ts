export type MoneyAccountType =
  | "Bank"
  | "E-Wallet"
  | "Cash"
  | "Investment"
  | "Other";

export type MoneyAccount = {
  id: string;
  userId: string;
  name: string;
  accountType: MoneyAccountType;
  initialBalance: number;
  isArchived: boolean;
  createdAt: number;
};
