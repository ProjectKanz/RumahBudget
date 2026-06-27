export type BucketType =
  | "living"
  | "emergency"
  | "investment_cash"
  | "sinking"
  | "trading_lab"
  | "lifestyle"
  | "giving"
  | "unallocated"
  | "custom";

export type Bucket = {
  id: string;
  userId: string;
  name: string;
  type: BucketType;
  linkedAccountId?: string;
  targetAmount?: number;
  createdAt: number;
  updatedAt: number;
};

export type AllocationTemplateItem = {
  bucketId: string;
  percentage: number;
};

export type AllocationTemplate = {
  id: string;
  userId: string;
  name: string;
  items: AllocationTemplateItem[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AllocationIncomeRecord = {
  id: string;
  userId: string;
  date: string;
  source: string;
  amount: number;
  note: string;
  allocationStatus: "unallocated" | "allocated" | "partially_allocated";
  allocationTemplateId?: string;
  createdAt: number;
};

export type AllocationRecord = {
  id: string;
  userId: string;
  incomeRecordId: string;
  bucketId: string;
  amount: number;
  percentage: number;
  createdAt: number;
};

export type AllocationDraftItem = {
  bucketId: string;
  percentage: number;
  amount: number;
};
