"use client"

import { ChartIcon, MinusIcon, PlusIcon, TargetIcon, TransferIcon } from "./icons"

const actions = [
  { label: "Add expense", icon: MinusIcon, primary: false },
  { label: "Add income", icon: PlusIcon, primary: true },
  { label: "Transfer", icon: TransferIcon, primary: false },
  { label: "Review budget", icon: TargetIcon, primary: false },
  { label: "View report", icon: ChartIcon, primary: false },
] as const

export function QuickActions() {
  return (
    <section aria-label="Quick actions" className="rb2-surface p-6 sm:p-7">
      <h2 className="mb-4 text-base font-semibold text-white">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={`rb2-interactive flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-medium ${
              action.primary
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                : "border-white/8 bg-white/[0.03] text-slate-200 hover:bg-white/5"
            }`}
          >
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl ${
                action.primary ? "bg-cyan-400/20 text-cyan-200" : "bg-white/5 text-slate-300"
              }`}
            >
              <action.icon width={18} height={18} />
            </span>
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}
