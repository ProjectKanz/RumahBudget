const OFFLINE_QUEUE_STORAGE_PREFIX = "rumahbudget.offlineQueue.v2";

type ExpenseQueueData = {
  accountId: string;
  affectsDailyAllowance: boolean;
  amount: number;
  category: string;
  createdAt: number;
  description: string;
  note: string;
  paymentMethod: string;
};

type IncomeQueueData = {
  accountId: string;
  affectsDailyAllowance: boolean;
  amount: number;
  createdAt: number;
  note: string;
  source: string;
};

type TransferQueueData = {
  affectsDailyAllowance: boolean;
  amount: number;
  createdAt: number;
  fromAccountId: string;
  note: string;
  toAccountId: string;
};

type OfflineQueuePayloadByType = {
  expense: ExpenseQueueData;
  income: IncomeQueueData;
  transfer: TransferQueueData;
};

export type OfflineQueueItem = {
  [Type in keyof OfflineQueuePayloadByType]: {
    data: OfflineQueuePayloadByType[Type];
    id: string;
    type: Type;
    userId: string;
  };
}[keyof OfflineQueuePayloadByType];

type OfflineQueueInsert = {
  table: "expenses" | "incomes" | "transfers";
  values: Record<string, boolean | string | number | null>;
};

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function isValidCreatedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toLocalTransactionDate(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getUserOfflineQueueStorageKey(userId: string) {
  assertNonEmpty(userId, "User ID");
  return `${OFFLINE_QUEUE_STORAGE_PREFIX}.${userId}`;
}

export function createOfflineQueueItem<
  Type extends keyof OfflineQueuePayloadByType,
>({
  data,
  id,
  type,
  userId,
}: {
  data: OfflineQueuePayloadByType[Type];
  id: string;
  type: Type;
  userId: string;
}): OfflineQueueItem {
  assertNonEmpty(id, "Queue item ID");
  assertNonEmpty(userId, "User ID");

  if (!isValidCreatedAt(data.createdAt)) {
    throw new Error("Original transaction date is required.");
  }

  return { data, id, type, userId } as OfflineQueueItem;
}

export function parseOfflineQueue(serializedQueue: string | null) {
  if (!serializedQueue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedQueue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is OfflineQueueItem => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Partial<OfflineQueueItem>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.userId === "string" &&
      (candidate.type === "expense" ||
        candidate.type === "income" ||
        candidate.type === "transfer") &&
      Boolean(candidate.data) &&
      isValidCreatedAt(candidate.data?.createdAt)
    );
  });
}

export function buildOfflineQueueInsert(
  item: OfflineQueueItem,
  authenticatedUserId: string,
  ownerEmail: string | null,
): OfflineQueueInsert {
  if (item.userId !== authenticatedUserId) {
    throw new Error("Offline queue item belongs to a different user.");
  }

  const createdAt = new Date(item.data.createdAt).toISOString();
  const transactionDate = toLocalTransactionDate(item.data.createdAt);

  if (item.type === "expense") {
    return {
      table: "expenses",
      values: {
        account_id: item.data.accountId,
        affects_daily_allowance: item.data.affectsDailyAllowance,
        amount: item.data.amount,
        category: item.data.category,
        client_entry_id: item.id,
        created_at: createdAt,
        description: item.data.description,
        note: item.data.note,
        owner: ownerEmail,
        payment_method: item.data.paymentMethod,
        user_id: authenticatedUserId,
        transaction_date: transactionDate,
      },
    };
  }

  if (item.type === "income") {
    return {
      table: "incomes",
      values: {
        account_id: item.data.accountId,
        affects_daily_allowance: item.data.affectsDailyAllowance,
        amount: item.data.amount,
        client_entry_id: item.id,
        created_at: createdAt,
        note: item.data.note,
        owner: ownerEmail,
        source: item.data.source,
        user_id: authenticatedUserId,
        transaction_date: transactionDate,
      },
    };
  }

  return {
    table: "transfers",
    values: {
      affects_daily_allowance: item.data.affectsDailyAllowance,
      amount: item.data.amount,
      client_entry_id: item.id,
      created_at: createdAt,
      from_account_id: item.data.fromAccountId,
      note: item.data.note,
      to_account_id: item.data.toAccountId,
      user_id: authenticatedUserId,
      transaction_date: transactionDate,
    },
  };
}

export async function syncUserOfflineQueue({
  items,
  syncItem,
  userId,
}: {
  items: readonly OfflineQueueItem[];
  syncItem: (item: OfflineQueueItem) => Promise<boolean>;
  userId: string;
}) {
  assertNonEmpty(userId, "User ID");

  const remainingItems: OfflineQueueItem[] = [];
  let failedCount = 0;
  let skippedOtherUserCount = 0;
  let syncedCount = 0;
  const syncedItemIds: string[] = [];

  for (const item of items) {
    if (item.userId !== userId) {
      remainingItems.push(item);
      skippedOtherUserCount += 1;
      continue;
    }

    try {
      if (await syncItem(item)) {
        syncedCount += 1;
        syncedItemIds.push(item.id);
      } else {
        remainingItems.push(item);
        failedCount += 1;
      }
    } catch {
      remainingItems.push(item);
      failedCount += 1;
    }
  }

  return {
    failedCount,
    remainingItems,
    skippedOtherUserCount,
    syncedCount,
    syncedItemIds,
  };
}

export function removeSyncedOfflineQueueItems(
  latestItems: readonly OfflineQueueItem[],
  syncedItemIds: readonly string[],
) {
  const syncedIds = new Set(syncedItemIds);
  return latestItems.filter((item) => !syncedIds.has(item.id));
}
