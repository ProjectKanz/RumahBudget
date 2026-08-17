export type TradingResult = {
  id: string;
  userId: string;
  accountId: string;
  transactionDate: string;
  netAmount: number;
  note: string;
  sourceIncomeId?: string;
  createdAt: number;
};
