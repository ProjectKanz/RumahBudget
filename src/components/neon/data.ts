import {
  PixHouse,
  PixSeed,
  PixShield,
  PixCart,
  PixHeart,
  PixGrid,
  PixWallet,
  PixTransfer,
  PixChart,
  PixTarget,
} from "./pixel-icons"

export const CURRENCY = "Rp"

export function formatIDR(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString("id-ID")
  return `${value < 0 ? "-" : ""}${CURRENCY}${formatted}`
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${CURRENCY}${(value / 1_000_000).toFixed(1)}jt`
  if (Math.abs(value) >= 1_000) return `${CURRENCY}${Math.round(value / 1_000)}rb`
  return `${CURRENCY}${value}`
}

export const SUMMARY = {
  period: "JUNE 2026",
  totalBalance: 48250000,
  income: 22500000,
  expenses: 14180000,
  get net() {
    return this.income - this.expenses
  },
  allocated: 19800000,
  spent: 14180000,
  get remaining() {
    return this.allocated - this.spent
  },
  // budget health 0-100
  health: 72,
  runwayDays: 96,
}

export type BucketStatus = "safe" | "watch" | "over"

export type Bucket = {
  id: string
  name: string
  icon: typeof PixHouse
  allocated: number
  spent: number
  accent: "cyan" | "pink" | "lime" | "amber" | "purple"
  status: BucketStatus
}

export const BUCKETS: Bucket[] = [
  { id: "living", name: "LIVING", icon: PixHouse, allocated: 6500000, spent: 5100000, accent: "cyan", status: "safe" },
  { id: "lifestyle", name: "LIFESTYLE", icon: PixCart, allocated: 3000000, spent: 2880000, accent: "amber", status: "watch" },
  { id: "invest", name: "INVEST", icon: PixSeed, allocated: 4500000, spent: 4500000, accent: "lime", status: "safe" },
  { id: "emergency", name: "EMERGENCY", icon: PixShield, allocated: 2500000, spent: 900000, accent: "purple", status: "safe" },
  { id: "family", name: "GIVING / FAMILY", icon: PixHeart, allocated: 3300000, spent: 3520000, accent: "pink", status: "over" },
]

export type FlowNode = {
  id: string
  label: string
  value: string
  accent: "cyan" | "pink" | "lime" | "amber" | "purple"
}

export const FLOW: FlowNode[] = [
  { id: "in", label: "INCOME", value: formatCompact(22500000), accent: "lime" },
  { id: "alloc", label: "ALLOCATE", value: formatCompact(19800000), accent: "purple" },
  { id: "spend", label: "SPENT", value: formatCompact(14180000), accent: "pink" },
  { id: "left", label: "REMAINING", value: formatCompact(5620000), accent: "cyan" },
]

export type Txn = {
  id: string
  name: string
  bucket: string
  amount: number
  time: string
  icon: typeof PixHouse
}

export const TRANSACTIONS: Txn[] = [
  { id: "t1", name: "Salary — June", bucket: "Income", amount: 22500000, time: "Jun 25", icon: PixWallet },
  { id: "t2", name: "Family transfer", bucket: "Giving / Family", amount: -1200000, time: "Jun 24", icon: PixHeart },
  { id: "t3", name: "Groceries — SuperIndo", bucket: "Living", amount: -640000, time: "Jun 23", icon: PixHouse },
  { id: "t4", name: "Index fund top-up", bucket: "Invest", amount: -2000000, time: "Jun 22", icon: PixSeed },
  { id: "t5", name: "Coffee + dining", bucket: "Lifestyle", amount: -385000, time: "Jun 21", icon: PixCart },
]

export type WarningLevel = "over" | "watch"

export type Warning = {
  id: string
  level: WarningLevel
  title: string
  detail: string
}

export const WARNINGS: Warning[] = [
  {
    id: "w1",
    level: "over",
    title: "GIVING / FAMILY breached",
    detail: "Over by Rp220.000 — pulling from this month's buffer.",
  },
  {
    id: "w2",
    level: "watch",
    title: "LIFESTYLE almost maxed",
    detail: "96% used with 5 days left in the cycle.",
  },
]

export const NEXT_ACTION = {
  title: "Rebalance Rp220.000 into Giving / Family",
  detail: "Move from your Rp5,62jt remaining to clear the only over-budget bucket and keep health green.",
  impact: "+8 health",
}

export const NAV = [
  { id: "overview", label: "CORE", icon: PixGrid },
  { id: "accounts", label: "VAULTS", icon: PixWallet },
  { id: "txns", label: "FLOW", icon: PixTransfer },
  { id: "budget", label: "BUCKETS", icon: PixTarget },
  { id: "reports", label: "STATS", icon: PixChart },
] as const
