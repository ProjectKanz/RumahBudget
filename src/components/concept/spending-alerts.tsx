"use client"

import { type AlertTone, alerts } from "./data"
import { AlertIcon, ClockIcon, PulseIcon } from "./icons"

const toneConfig: Record<
  AlertTone,
  { wrap: string; icon: string; Icon: typeof AlertIcon }
> = {
  info: {
    wrap: "border-cyan-400/15 bg-cyan-400/[0.06]",
    icon: "bg-cyan-400/12 text-cyan-300",
    Icon: ClockIcon,
  },
  warning: {
    wrap: "border-amber-400/15 bg-amber-400/[0.06]",
    icon: "bg-amber-400/12 text-amber-300",
    Icon: PulseIcon,
  },
  danger: {
    wrap: "border-rose-400/20 bg-rose-400/[0.07]",
    icon: "bg-rose-400/12 text-rose-300",
    Icon: AlertIcon,
  },
}

export function SpendingAlerts() {
  return (
    <section aria-label="Spending alerts" className="rb2-surface p-6 sm:p-7">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">Spending alerts</h2>
        <p className="text-sm text-slate-400">Calm heads-up on what to watch</p>
      </div>
      <ul className="flex flex-col gap-3">
        {alerts.map((alert) => {
          const config = toneConfig[alert.tone]
          return (
            <li
              key={alert.id}
              className={`flex gap-3 rounded-xl border p-4 ${config.wrap}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${config.icon}`}>
                <config.Icon width={18} height={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{alert.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-slate-400">{alert.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
