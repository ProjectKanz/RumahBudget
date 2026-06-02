export interface RecurringCommitment {
  id: string;
  userId: string;
  accountId: string | null;
  name: string;
  amount: number;
  category: string;
  commitmentType: "subscription" | "installment" | "paylater" | "rent" | "other";
  dueDay: number;
  isAutoDeduct: boolean;
  disableReminders: boolean;
  lastProcessed: string | null; // ISO string date e.g. "2026-06-02T13:45:33.000Z"
  createdAt: number;
}
