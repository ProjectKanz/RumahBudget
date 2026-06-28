"use client"

import { ArrowDownIcon, ArrowUpIcon, ClockIcon, PulseIcon } from "./icons"
import { formatRp, summary } from "./data"

function HealthRing({ score }: { score: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="relative grid h-20 w-20 place-items-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#healthGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="healthGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <span className="rb2-num absolute text-lg font-semibold text-white">{score}</span>
    </div>
  )
}

function MetricTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone: "positive" | "danger" | "neutral"
  icon: React.ReactNode
}) {
  const toneText =
    tone === "positive" ? "text-lime-300" : tone === "danger" ? "text-rose-300" : "text-slate-200"
  const toneBg =
    tone === "positive"
      ? "bg-lime-400/10 text-lime-300"
      : tone === "danger"
        ? "bg-rose-400/10 text-rose-300"
        : "bg-white/5 text-slate-300"
  return (
    <div className="rb2-surface-soft rb2-interactive flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneBg}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-400">{label}</p>
        <p className={`rb2-num truncate text-base font-semibold ${toneText}`}>{value}</p>
      </div>
    </div>
  )
}

export function StatusSummary() {
  const positiveCashflow = summary.netCashflow >= 0
  return (
    <section aria-label="Financial status summary" className="grid gap-4 lg:grid-cols-3">
      <div className="rb2-hero p-6 sm:p-7 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm text-cyan-200/80">Total balance across all accounts</p>
            <p className="rb2-num mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {formatRp(summary.totalBalance)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/12 px-3 py-1 text-xs font-medium text-lime-300">
                <ClockIcon width={14} height={14} />
                {summary.runwayMonths.toFixed(1)} months of runway
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                Updated just now
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3 pr-4">
            <HealthRing score={summary.budgetHealthScore} />
            <div>
              <p className="text-xs text-slate-400">Budget health</p>
              <p className="text-sm font-semibold text-white">{summary.budgetHealthLabel}</p>
              <p className="mt-1 text-xs text-lime-300">Safe to spend this week</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <MetricTile
          label="Monthly income"
          value={formatRp(summary.monthlyIncome)}
          tone="positive"
          icon={<ArrowUpIcon width={18} height={18} />}
        />
        <MetricTile
          label="Monthly expenses"
          value={formatRp(summary.monthlyExpenses)}
          tone="neutral"
          icon={<ArrowDownIcon width={18} height={18} />}
        />
        <MetricTile
          label="Net cashflow"
          value={`${positiveCashflow ? "+" : "-"}${formatRp(Math.abs(summary.netCashflow))}`}
          tone={positiveCashflow ? "positive" : "danger"}
          icon={<PulseIcon width={18} height={18} />}
        />
      </div>
    </section>
  )
}
