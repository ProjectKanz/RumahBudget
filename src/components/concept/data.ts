export const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

export function formatRp(value: number) {
  return currency.format(value)
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export type BucketStatus = "safe" | "watch" | "over"

export type Bucket = {
  name: string
  allocated: number
  spent: number
  status: BucketStatus
}

export type AlertTone = "info" | "warning" | "danger"

export type FinanceAlert = {
  id: string
  tone: AlertTone
  title: string
  detail: string
}

export type TxnDirection = "in" | "out"

export type Transaction = {
  id: string
  title: string
  category: string
  account: string
  date: string
  amount: number
  direction: TxnDirection
  note?: string
}

export const summary = {
  totalBalance: 48250000,
  monthlyIncome: 22500000,
  monthlyExpenses: 17840000,
  get netCashflow() {
    return this.monthlyIncome - this.monthlyExpenses
  },
  budgetHealthScore: 78,
  budgetHealthLabel: "On track",
  runwayMonths: 2.7,
}

export const buckets: Bucket[] = [
  { name: "Living", allocated: 8000000, spent: 6420000, status: "safe" },
  { name: "Investment Cash", allocated: 5000000, spent: 5000000, status: "safe" },
  { name: "Emergency Fund", allocated: 3000000, spent: 600000, status: "safe" },
  { name: "Lifestyle", allocated: 3500000, spent: 3380000, status: "watch" },
  { name: "Giving / Family", allocated: 2500000, spent: 2840000, status: "over" },
]

export const alerts: FinanceAlert[] = [
  {
    id: "lifestyle",
    tone: "warning",
    title: "Lifestyle budget needs attention",
    detail: "You've used 97% of this bucket with 9 days left in the month.",
  },
  {
    id: "giving",
    tone: "danger",
    title: "Giving / Family is over budget",
    detail: "Spending is Rp 340.000 above the amount you allocated.",
  },
  {
    id: "runway",
    tone: "info",
    title: "Runway is below 3 months",
    detail: "Recommended action: move a little from Lifestyle into savings.",
  },
]

export const transactions: Transaction[] = [
  {
    id: "t1",
    title: "Monthly salary",
    category: "Income",
    account: "BCA Main",
    date: "Jun 25",
    amount: 22500000,
    direction: "in",
    note: "June payroll",
  },
  {
    id: "t2",
    title: "Grocery run",
    category: "Living",
    account: "BCA Main",
    date: "Jun 24",
    amount: 685000,
    direction: "out",
    note: "Weekly groceries",
  },
  {
    id: "t3",
    title: "Family support",
    category: "Giving / Family",
    account: "Jago Pocket",
    date: "Jun 23",
    amount: 1500000,
    direction: "out",
  },
  {
    id: "t4",
    title: "Coffee & coworking",
    category: "Lifestyle",
    account: "Gopay",
    date: "Jun 22",
    amount: 142000,
    direction: "out",
    note: "Afternoon work session",
  },
  {
    id: "t5",
    title: "Mutual fund top-up",
    category: "Investment Cash",
    account: "Bibit",
    date: "Jun 21",
    amount: 2000000,
    direction: "out",
    note: "Scheduled investment",
  },
]

export const recommendedAction = {
  title: "Review your biggest expenses",
  reason:
    "Spending is close to income this month, and two budgets are running hot. A quick review can free up about Rp 1.200.000.",
  primaryLabel: "Review expenses",
  secondaryLabel: "Adjust allocation",
}
