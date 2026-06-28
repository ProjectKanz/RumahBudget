"use client"

import { ArrowRightIcon, SparkIcon } from "./icons"
import { recommendedAction } from "./data"

export function RecommendedAction() {
  return (
    <section
      aria-label="Recommended action"
      className="rb2-surface relative overflow-hidden p-6 sm:p-7"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <SparkIcon width={22} height={22} />
          </span>
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-wider text-cyan-300/80">
              Recommended action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">{recommendedAction.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-400">{recommendedAction.reason}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rb2-cta inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            {recommendedAction.primaryLabel}
            <ArrowRightIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="rb2-interactive inline-flex items-center justify-center rounded-[0.85rem] border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            {recommendedAction.secondaryLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
