"use client"

import { ArrowDownIcon, ArrowUpIcon } from "./icons"
import { formatRp, transactions } from "./data"

export function RecentTransactions() {
  return (
    <section aria-label="Recent transactions" className="rb2-surface p-6 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Recent transactions</h2>
          <p className="text-sm text-slate-400">Your latest money movements</p>
        </div>
        <button
          type="button"
          className="rb2-interactive rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/10"
        >
          View all
        </button>
      </div>
      <ul className="flex flex-col">
        {transactions.map((txn, index) => {
          const isIn = txn.direction === "in"
          return (
            <li
              key={txn.id}
              className={`flex items-center gap-3 py-3 ${
                index < transactions.length - 1 ? "border-b border-white/[0.06]" : ""
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  isIn ? "bg-lime-400/10 text-lime-300" : "bg-white/5 text-slate-300"
                }`}
              >
                {isIn ? <ArrowUpIcon width={18} height={18} /> : <ArrowDownIcon width={18} height={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{txn.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {txn.category} · {txn.account}
                  {txn.note ? ` · ${txn.note}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`rb2-num text-sm font-semibold ${isIn ? "text-lime-300" : "text-white"}`}>
                  {isIn ? "+" : "-"}
                  {formatRp(txn.amount)}
                </p>
                <p className="text-xs text-slate-500">{txn.date}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
