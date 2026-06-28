"use client"

import { AppHeader } from "./app-header"
import { BudgetProgress } from "./budget-progress"
import { MoneyFlow } from "./money-flow"
import { QuickActions } from "./quick-actions"
import { RecentTransactions } from "./recent-transactions"
import { RecommendedAction } from "./recommended-action"
import { SpendingAlerts } from "./spending-alerts"
import { StatusSummary } from "./status-summary"

export function OverviewDashboard() {
  return (
    <div className="rb2 min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Good evening, Adi
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Here&apos;s how your money looks today — calm and under control.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <StatusSummary />
          <RecommendedAction />
          <MoneyFlow />

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BudgetProgress />
            </div>
            <SpendingAlerts />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentTransactions />
            </div>
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  )
}
