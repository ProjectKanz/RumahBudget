"use client"

import { type Bucket, type BucketStatus, buckets, formatRp } from "./data"

const statusConfig: Record<
  BucketStatus,
  { label: string; chip: string; bar: string }
> = {
  safe: {
    label: "Safe",
    chip: "bg-lime-400/12 text-lime-300",
    bar: "bg-gradient-to-r from-lime-400 to-emerald-400",
  },
  watch: {
    label: "Watch",
    chip: "bg-amber-400/12 text-amber-300",
    bar: "bg-gradient-to-r from-amber-400 to-amber-300",
  },
  over: {
    label: "Over budget",
    chip: "bg-rose-400/12 text-rose-300",
    bar: "bg-gradient-to-r from-rose-500 to-rose-400",
  },
}

function BucketRow({ bucket }: { bucket: Bucket }) {
  const pct = Math.min(Math.round((bucket.spent / bucket.allocated) * 100), 100)
  const remaining = bucket.allocated - bucket.spent
  const config = statusConfig[bucket.status]
  return (
    <div className="rb2-surface-soft rb2-interactive p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{bucket.name}</p>
        <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${config.chip}`}>
          {config.label}
        </span>
      </div>
      <div className="mt-3 rb2-track h-2">
        <span className={config.bar} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          <span className="rb2-num text-slate-200">{formatRp(bucket.spent)}</span> of{" "}
          <span className="rb2-num">{formatRp(bucket.allocated)}</span>
        </span>
        <span className={remaining < 0 ? "text-rose-300" : "text-slate-300"}>
          {remaining < 0 ? "Over by " : "Left "}
          <span className="rb2-num">{formatRp(Math.abs(remaining))}</span>
        </span>
      </div>
    </div>
  )
}

export function BudgetProgress() {
  return (
    <section aria-label="Budget progress" className="rb2-surface p-6 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Budget progress</h2>
          <p className="text-sm text-slate-400">Where your allocated money is going this month</p>
        </div>
        <button
          type="button"
          className="rb2-interactive rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/10"
        >
          Adjust allocation
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {buckets.map((bucket) => (
          <BucketRow key={bucket.name} bucket={bucket} />
        ))}
      </div>
    </section>
  )
}
