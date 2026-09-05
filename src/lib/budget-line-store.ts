import type { BudgetLine, BudgetLineKind } from "@/src/types/budget-line";

type Row = Record<string, unknown>;

export type BudgetLineSeed = {
  key: string;
  name: string;
  kind: BudgetLineKind;
  sortOrder: number;
};

/**
 * The starting set. Deliberately small: a taxonomy nobody maintains decays into
 * one giant "Other", which is exactly what made the earlier bucket screen
 * useless. Reserve lines are not seeded yet because this slice cannot assign
 * expenses to them.
 */
export const INITIAL_BUDGET_LINES: readonly BudgetLineSeed[] = [
  { key: "food", name: "Food", kind: "spending", sortOrder: 10 },
  { key: "social_treats", name: "Nongkrong & Jajan", kind: "spending", sortOrder: 20 },
  { key: "vape", name: "Vape", kind: "spending", sortOrder: 30 },
  { key: "laundry", name: "Laundry", kind: "spending", sortOrder: 40 },
  { key: "toiletries", name: "Toiletries", kind: "spending", sortOrder: 50 },
  { key: "water", name: "Water", kind: "spending", sortOrder: 60 },
  { key: "fuel", name: "Fuel", kind: "spending", sortOrder: 70 },
  {
    key: "fixed_commitments",
    name: "Fixed Commitments",
    kind: "spending",
    sortOrder: 80,
  },
  { key: "unplanned", name: "Unplanned", kind: "spending", sortOrder: 90 },
] as const;

/** The conflict target of the seed upsert, mirroring budget_lines_user_key_unique. */
export const BUDGET_LINE_CONFLICT_TARGET = "user_id,key";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function mapBudgetLineRow(row: Row, userId: string): BudgetLine {
  const kind = text(row.kind, "spending");

  return {
    createdAt: timestamp(row.created_at),
    id: text(row.id),
    isArchived: Boolean(row.is_archived),
    key: text(row.key),
    kind: kind === "reserve" ? "reserve" : "spending",
    name: text(row.name, "Untitled budget line"),
    sortOrder: num(row.sort_order),
    updatedAt: timestamp(row.updated_at),
    userId: text(row.user_id, userId),
  };
}

export function mapBudgetLineRows(rows: Row[], userId: string): BudgetLine[] {
  return rows.map((row) => mapBudgetLineRow(row, userId));
}

/**
 * Seed rows carry no id: the unique index on (user_id, key) is what makes the
 * upsert idempotent, so re-running this never duplicates a line and never
 * overwrites a name the owner has since changed by hand.
 */
export function buildBudgetLineSeedRows(userId: string): Row[] {
  return INITIAL_BUDGET_LINES.map((line) => ({
    key: line.key,
    kind: line.kind,
    name: line.name,
    sort_order: line.sortOrder,
    user_id: userId,
  }));
}

/** Only active spending lines may be assigned in this slice — the DB trigger agrees. */
export function getAssignableBudgetLines(budgetLines: BudgetLine[]) {
  return budgetLines
    .filter((line) => line.kind === "spending" && !line.isArchived)
    .sort((first, second) =>
      first.sortOrder === second.sortOrder
        ? first.name.localeCompare(second.name)
        : first.sortOrder - second.sortOrder,
    );
}

export function isAssignableBudgetLineId(
  budgetLines: BudgetLine[],
  budgetLineId: string,
) {
  return getAssignableBudgetLines(budgetLines).some(
    (line) => line.id === budgetLineId,
  );
}

export function getBudgetLineLabel(
  budgetLines: BudgetLine[],
  budgetLineId: string | undefined,
  fallback = "Uncategorized",
) {
  if (!budgetLineId) {
    return fallback;
  }

  return (
    budgetLines.find((line) => line.id === budgetLineId)?.name ?? fallback
  );
}
