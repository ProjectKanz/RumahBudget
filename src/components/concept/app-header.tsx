"use client"

import { useState } from "react"
import {
  ChartIcon,
  CloseIcon,
  GridIcon,
  MenuIcon,
  TargetIcon,
  TransferIcon,
  WalletIcon,
} from "./icons"

type NavItem = {
  label: string
  icon: (props: { width?: number; height?: number }) => React.ReactElement
  active?: boolean
}

const NAV: NavItem[] = [
  { label: "Overview", icon: GridIcon, active: true },
  { label: "Accounts", icon: WalletIcon },
  { label: "Transactions", icon: TransferIcon },
  { label: "Budget", icon: TargetIcon },
  { label: "Reports", icon: ChartIcon },
]

export function AppHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0f1b]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/90 to-cyan-600/90 text-[#04222a] shadow-[0_8px_24px_-10px_rgba(34,211,238,0.8)]">
            <WalletIcon width={22} height={22} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-white">RumahBudget</p>
            <p className="truncate text-xs text-slate-400">Your money, calmly organized</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                item.active
                  ? "bg-cyan-400/12 text-cyan-200"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
              aria-current={item.active ? "page" : undefined}
            >
              <item.icon width={16} height={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] py-1 pl-1 pr-3 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-lime-300 to-emerald-500 text-sm font-bold text-emerald-950">
              AR
            </span>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-white">Adi R.</p>
              <p className="text-[0.65rem] text-slate-400">Personal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-slate-200 transition hover:bg-white/5 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-white/[0.06] px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
          <div className="grid grid-cols-1 gap-1">
            {NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  item.active
                    ? "bg-cyan-400/12 text-cyan-200"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                <item.icon width={18} height={18} />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  )
}
