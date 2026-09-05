/**
 * A budget line is a planning label, not a balance. Money keeps living on the
 * money accounts; a line only answers "what job does this spending have?".
 *
 * `key` is the stable machine identity. `name` is display only, so renaming
 * "Nongkrong & Jajan" later cannot break references or the seed.
 */
export type BudgetLineKind = "spending" | "reserve";

export type BudgetLine = {
  id: string;
  userId: string;
  key: string;
  name: string;
  kind: BudgetLineKind;
  sortOrder: number;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
};
