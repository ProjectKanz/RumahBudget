export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Dining Out",
  "Transportation",
  "Housing",
  "Bills",
  "Household",
  "Health",
  "Education",
  "Personal Care",
  "Family & Kids",
  "Entertainment",
  "Debt & Installments",
  "Fees & Taxes",
  "Gifts & Donations",
  "Travel",
  "Work",
  "Other",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "Debit Card",
  "Credit Card",
  "Bank Transfer",
  "E-Wallet",
  "QRIS",
  "PayLater",
  "Auto Debit",
  "Other",
] as const;

export const EXPENSE_CATEGORY_OPTIONS: ReadonlyArray<{
  label: string;
  value: string;
}> = EXPENSE_CATEGORIES.map((value) => ({ label: value, value }));

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  label: string;
  value: string;
}> = PAYMENT_METHODS.map((value) => ({ label: value, value }));

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const CATEGORY_ALIASES = new Map<string, ExpenseCategory>([
  ["belanja", "Groceries"],
  ["dapur", "Groceries"],
  ["grocery", "Groceries"],
  ["grocer", "Groceries"],
  ["makanan", "Dining Out"],
  ["makan", "Dining Out"],
  ["restaurant", "Dining Out"],
  ["restoran", "Dining Out"],
  ["ojek", "Transportation"],
  ["bensin", "Transportation"],
  ["transport", "Transportation"],
  ["transportasi", "Transportation"],
  ["sewa", "Housing"],
  ["rent", "Housing"],
  ["tagihan", "Bills"],
  ["listrik", "Bills"],
  ["air", "Bills"],
  ["internet", "Bills"],
  ["wifi", "Bills"],
  ["pulsa", "Bills"],
  ["rumah tangga", "Household"],
  ["kesehatan", "Health"],
  ["obat", "Health"],
  ["dokter", "Health"],
  ["klinik", "Health"],
  ["sakit", "Health"],
  ["pendidikan", "Education"],
  ["sekolah", "Education"],
  ["kuliah", "Education"],
  ["kursus", "Education"],
  ["perawatan", "Personal Care"],
  ["anak", "Family & Kids"],
  ["hiburan", "Entertainment"],
  ["donasi", "Gifts & Donations"],
  ["hadiah", "Gifts & Donations"],
  ["utang", "Debt & Installments"],
  ["cicilan", "Debt & Installments"],
  ["pajak", "Fees & Taxes"],
  ["biaya", "Fees & Taxes"],
  ["perjalanan", "Travel"],
  ["kerja", "Work"],
  ["kantor", "Work"],
  ["lainnya", "Other"],
]);

const NORMALIZED_CATEGORIES = new Map(
  EXPENSE_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

export function resolveExpenseCategory(input: string) {
  const normalized = input.trim().toLowerCase();

  return NORMALIZED_CATEGORIES.get(normalized) ?? CATEGORY_ALIASES.get(normalized) ?? null;
}

export function normalizeExpenseCategory(input: string) {
  return resolveExpenseCategory(input) ?? "Other";
}
