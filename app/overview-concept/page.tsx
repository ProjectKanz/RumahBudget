import type { Metadata } from "next"
import { OverviewDashboard } from "@/src/components/concept/overview-dashboard"

export const metadata: Metadata = {
  title: "RumahBudget | Overview",
  description:
    "A calm, premium personal finance dashboard concept — see your balance, budget health, money flow, and recommended next action at a glance.",
}

export default function OverviewConceptPage() {
  return <OverviewDashboard />
}
