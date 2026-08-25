import type {
  AllocationIncomeRecord,
  AllocationRecord,
  AllocationState,
  AllocationTemplate,
  AllocationTemplateItem,
  Bucket,
  BucketType,
} from "@/src/types/allocation";
import type {
  Asset,
  AssetCurrency,
  AssetType,
  InvestmentTransaction,
  PriceProviderId,
  PriceSnapshot,
} from "@/src/types/portfolio";

type Row = Record<string, unknown>;

type QueryResult<T> = { data: T | null; error: { message: string } | null };

/**
 * The narrow slice of the Supabase client this store needs. Declaring it here
 * keeps the store testable without standing up a real client.
 */
export type AllocationStoreClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<QueryResult<Row[]>>;
    };
    upsert: (
      rows: Row[],
      options: { onConflict: string },
    ) => PromiseLike<QueryResult<unknown>>;
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => {
        in: (
          column: string,
          values: string[],
        ) => PromiseLike<QueryResult<unknown>>;
      };
    };
  };
};

type CollectionSpec = {
  fromRow: (row: Row) => unknown;
  table: string;
  toRow: (item: never, userId: string) => Row;
};

const CONFLICT_TARGET = "user_id,id";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function templateItems(value: unknown): AllocationTemplateItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Row => Boolean(item) && typeof item === "object")
    .map((item) => ({
      bucketId: text(item.bucketId),
      percentage: num(item.percentage),
    }))
    .filter((item) => Boolean(item.bucketId));
}

export const allocationCollections: Record<
  keyof AllocationState,
  CollectionSpec
> = {
  buckets: {
    table: "allocation_buckets",
    toRow: (bucket: Bucket, userId) => ({
      created_at: bucket.createdAt,
      id: bucket.id,
      linked_account_id: bucket.linkedAccountId ?? null,
      name: bucket.name,
      target_amount: bucket.targetAmount ?? null,
      type: bucket.type,
      updated_at: bucket.updatedAt,
      user_id: userId,
    }),
    fromRow: (row): Bucket => ({
      createdAt: num(row.created_at),
      id: text(row.id),
      linkedAccountId: optionalText(row.linked_account_id),
      name: text(row.name),
      targetAmount:
        row.target_amount === null || row.target_amount === undefined
          ? undefined
          : num(row.target_amount),
      type: text(row.type, "custom") as BucketType,
      updatedAt: num(row.updated_at),
      userId: text(row.user_id),
    }),
  },
  assets: {
    table: "allocation_assets",
    toRow: (asset: Asset, userId) => ({
      currency: asset.currency,
      id: asset.id,
      name: asset.name,
      price_provider: asset.priceProvider ?? null,
      symbol: asset.symbol,
      type: asset.type,
      user_id: userId,
    }),
    fromRow: (row): Asset => ({
      currency: text(row.currency, "IDR") as AssetCurrency,
      id: text(row.id),
      name: text(row.name),
      priceProvider: optionalText(row.price_provider) as
        | PriceProviderId
        | undefined,
      symbol: text(row.symbol),
      type: text(row.type, "other") as AssetType,
      userId: text(row.user_id),
    }),
  },
  templates: {
    table: "allocation_templates",
    toRow: (template: AllocationTemplate, userId) => ({
      created_at: template.createdAt,
      id: template.id,
      is_default: template.isDefault,
      items: template.items,
      name: template.name,
      updated_at: template.updatedAt,
      user_id: userId,
    }),
    fromRow: (row): AllocationTemplate => ({
      createdAt: num(row.created_at),
      id: text(row.id),
      isDefault: Boolean(row.is_default),
      items: templateItems(row.items),
      name: text(row.name),
      updatedAt: num(row.updated_at),
      userId: text(row.user_id),
    }),
  },
  incomeRecords: {
    table: "allocation_income_records",
    toRow: (record: AllocationIncomeRecord, userId) => ({
      allocation_status: record.allocationStatus,
      allocation_template_id: record.allocationTemplateId ?? null,
      amount: record.amount,
      created_at: record.createdAt,
      date: record.date,
      id: record.id,
      note: record.note,
      source: record.source,
      user_id: userId,
    }),
    fromRow: (row): AllocationIncomeRecord => ({
      allocationStatus: text(
        row.allocation_status,
        "unallocated",
      ) as AllocationIncomeRecord["allocationStatus"],
      allocationTemplateId: optionalText(row.allocation_template_id),
      amount: num(row.amount),
      createdAt: num(row.created_at),
      date: text(row.date),
      id: text(row.id),
      note: text(row.note),
      source: text(row.source),
      userId: text(row.user_id),
    }),
  },
  allocationRecords: {
    table: "allocation_records",
    toRow: (record: AllocationRecord, userId) => ({
      amount: record.amount,
      bucket_id: record.bucketId,
      created_at: record.createdAt,
      id: record.id,
      income_record_id: record.incomeRecordId,
      percentage: record.percentage,
      user_id: userId,
    }),
    fromRow: (row): AllocationRecord => ({
      amount: num(row.amount),
      bucketId: text(row.bucket_id),
      createdAt: num(row.created_at),
      id: text(row.id),
      incomeRecordId: text(row.income_record_id),
      percentage: num(row.percentage),
      userId: text(row.user_id),
    }),
  },
  investmentTransactions: {
    table: "allocation_investment_transactions",
    toRow: (transaction: InvestmentTransaction, userId) => ({
      amount_idr: transaction.amountIdr,
      asset_id: transaction.assetId,
      created_at: transaction.createdAt,
      date: transaction.date,
      fee: transaction.fee,
      id: transaction.id,
      note: transaction.note,
      price: transaction.price,
      quantity: transaction.quantity,
      source_bucket_id: transaction.sourceBucketId ?? null,
      type: transaction.type,
      user_id: userId,
    }),
    fromRow: (row): InvestmentTransaction => ({
      amountIdr: num(row.amount_idr),
      assetId: text(row.asset_id),
      createdAt: num(row.created_at),
      date: text(row.date),
      fee: num(row.fee),
      id: text(row.id),
      note: text(row.note),
      price: num(row.price),
      quantity: num(row.quantity),
      sourceBucketId: optionalText(row.source_bucket_id),
      type: row.type === "sell" ? "sell" : "buy",
      userId: text(row.user_id),
    }),
  },
  priceSnapshots: {
    table: "allocation_price_snapshots",
    toRow: (snapshot: PriceSnapshot, userId) => ({
      asset_id: snapshot.assetId,
      captured_at: snapshot.timestamp,
      currency: snapshot.currency,
      id: snapshot.id,
      is_manual: snapshot.isManual,
      price: snapshot.price,
      source: snapshot.source,
      user_id: userId,
    }),
    fromRow: (row): PriceSnapshot => ({
      assetId: text(row.asset_id),
      currency: text(row.currency, "IDR") as AssetCurrency,
      id: text(row.id),
      isManual: Boolean(row.is_manual),
      price: num(row.price),
      source: text(row.source, "manual") as PriceProviderId,
      timestamp: num(row.captured_at),
      userId: text(row.user_id),
    }),
  },
};

const collectionKeys = Object.keys(allocationCollections) as Array<
  keyof AllocationState
>;

export type AllocationLoadResult =
  | { ok: true; isEmpty: boolean; state: AllocationState }
  | { ok: false; message: string };

/** Ids present remotely that the local state no longer contains. */
export function getRemovedIds(remoteIds: string[], localIds: string[]) {
  const keep = new Set(localIds);
  return remoteIds.filter((id) => id && !keep.has(id));
}

export async function loadAllocationState(
  client: AllocationStoreClient,
  userId: string,
): Promise<AllocationLoadResult> {
  const results = await Promise.all(
    collectionKeys.map(async (key) => {
      const spec = allocationCollections[key];
      const { data, error } = await client
        .from(spec.table)
        .select("*")
        .eq("user_id", userId);

      return { data: data ?? [], error, key };
    }),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return { ok: false, message: failed.error.message };
  }

  const state = {} as AllocationState;
  let rowCount = 0;

  for (const result of results) {
    const spec = allocationCollections[result.key];
    rowCount += result.data.length;
    // The cast is contained here: each spec only ever maps its own table's rows.
    (state[result.key] as unknown[]) = result.data.map((row) =>
      spec.fromRow(row),
    );
  }

  return { ok: true, isEmpty: rowCount === 0, state };
}

export type AllocationSaveResult = { ok: true } | { ok: false; message: string };

/**
 * Write-through sync: upsert what the client holds, then remove rows it no
 * longer has. The collections carry no foreign keys to each other, so they can
 * be written in any order.
 */
export async function saveAllocationState(
  client: AllocationStoreClient,
  userId: string,
  state: AllocationState,
): Promise<AllocationSaveResult> {
  for (const key of collectionKeys) {
    const spec = allocationCollections[key];
    const items = (state[key] ?? []) as never[];
    const rows = items.map((item) => spec.toRow(item, userId));

    if (rows.length > 0) {
      const { error } = await client
        .from(spec.table)
        .upsert(rows, { onConflict: CONFLICT_TARGET });

      if (error) {
        return { ok: false, message: error.message };
      }
    }

    const { data, error: readError } = await client
      .from(spec.table)
      .select("id")
      .eq("user_id", userId);

    if (readError) {
      return { ok: false, message: readError.message };
    }

    const removedIds = getRemovedIds(
      (data ?? []).map((row) => text(row.id)),
      rows.map((row) => text(row.id)),
    );

    if (removedIds.length > 0) {
      const { error } = await client
        .from(spec.table)
        .delete()
        .eq("user_id", userId)
        .in("id", removedIds);

      if (error) {
        return { ok: false, message: error.message };
      }
    }
  }

  return { ok: true };
}
