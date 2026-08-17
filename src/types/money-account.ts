export type MoneyAccountType =
  | "Bank"
  | "E-Wallet"
  | "Cash"
  | "Investment"
  | "Other";

export type MoneyAccountPurpose = "general" | "trading";

export type MoneyAccount = {
  id: string;
  userId: string;
  name: string;
  accountType: MoneyAccountType;
  purpose: MoneyAccountPurpose;
  initialBalance: number;
  isArchived: boolean;
  createdAt: number;
};
