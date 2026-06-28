"use client"

import {
  ArrowDownIcon,
  ArrowRightIcon,
  FlowIncomeIcon,
  SparkIcon,
  TargetIcon,
  WalletIcon,
} from "./icons"
import { formatRp, summary } from "./data"

const allocated = 22000000
const remaining = summary.monthlyIncome - summary.monthlyExpenses

const steps = [
  {
    key: "income",
    label: "Income",
    value: formatRp(summary.monthlyIncome),
    icon: FlowIncomeIcon,
    accent: "from-lime-400/20 text-lime-300",
  },
  {
    key: "allocation",
    label: "Allocation",
    value: formatRp(allocated),
    icon: TargetIcon,
    accent: "from-cyan-400/20 text-cyan-300",
  },
  {
    key: "spending",
    label: "Spending",
    value: formatRp(summary.monthlyExpenses),
    icon: ArrowDownIcon,
    accent: "from-slate-400/20 text-slate-200",
  },
  {
    key: "remaining",
    label: "Remaining",
    value: formatRp(remaining),
    icon: WalletIcon,
    accent: "from-emerald-400/20 text-emerald-300",
  },
  {
    key: "action",
    label: "Next step",
    value: "Review",
    icon: SparkIcon,
    accent: "from-cyan-400/20 text-cyan-300",
  },
] as const

export function MoneyFlow() {
  return (
    <section aria-label="Money flow" className="rb2-surface p-6 sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Money flow</h2>
          <p className="text-sm text-slate-400">How this month moves from income to action</p>
        </div>
      </div>
      <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {steps.map((step, index) => (
          <li key={step.key} className="flex flex-1 items-center gap-3 md:flex-col md:gap-2">
            <div className="rb2-surface-soft flex w-full items-center gap-3 p-3 md:flex-col md:items-start md:gap-2">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${step.accent}`}
              >
                <step.icon width={18} height={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{step.label}</p>
                <p className="rb2-num truncate text-sm font-semibold text-white">{step.value}</p>
              </div>
            </div>
            {index < steps.length - 1 ? (
              <span className="grid shrink-0 rotate-90 place-items-center text-slate-500 md:rotate-0">
                <ArrowRightIcon width={18} height={18} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
