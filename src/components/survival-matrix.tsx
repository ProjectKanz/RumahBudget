"use client";

import { useState, useMemo } from "react";
import {
  TerminalPanel,
  SharpButton,
  SharpInput,
  StatusChip,
  SystemReading,
} from "./cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { MoneyAccount } from "@/src/types/money-account";

type SurvivalMatrixProps = {
  accounts: MoneyAccount[];
  accountBalances: Record<string, number>;
  averageMonthlyBurn: number;
  monthlyIncome: number;
  isBalanceHidden: boolean;
};

// Liquidity order priority mapping (lower is more liquid)
const LIQUIDITY_PRIORITY: Record<string, number> = {
  "Cash": 1,
  "E-Wallet": 2,
  "Bank": 3,
  "Other": 4,
  "Investment": 5,
};

function getLiquidityScore(type: string): number {
  return LIQUIDITY_PRIORITY[type] || 99;
}

export default function SurvivalMatrix({
  accounts,
  accountBalances,
  averageMonthlyBurn,
  monthlyIncome,
  isBalanceHidden,
}: SurvivalMatrixProps) {
  const [jobLossActive, setJobLossActive] = useState(false);
  const [shockInput, setShockInput] = useState("");
  
  // Quick presets for the sudden shock (in Rp)
  const presets = [5000000, 15000000, 30000000];

  const parsedShockAmount = useMemo(() => {
    const parsed = Number(shockInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [shockInput]);

  // Run the stress test simulation
  const simulation = useMemo(() => {
    const simulatedIncome = jobLossActive ? 0 : monthlyIncome;
    const simulatedExpense = averageMonthlyBurn;
    const netMonthlyCashflow = simulatedIncome - simulatedExpense;

    // Filter active accounts
    const activeAccounts = accounts.filter((acc) => !acc.isArchived);

    // Initial balances copy
    const simulatedBalances: Record<string, number> = {};
    activeAccounts.forEach((acc) => {
      simulatedBalances[acc.id] = accountBalances[acc.id] ?? acc.initialBalance;
    });

    const totalInitialBalance = activeAccounts.reduce(
      (sum, acc) => sum + (simulatedBalances[acc.id] ?? 0),
      0
    );

    // Sort accounts by liquidity order to apply shock and deficit depletion
    const sortedAccounts = [...activeAccounts].sort(
      (a, b) => getLiquidityScore(a.accountType) - getLiquidityScore(b.accountType)
    );

    const timelineEvents: Array<{
      month: number;
      type: "shock" | "depletion" | "stabilized" | "insolvent" | "info";
      title: string;
      description: string;
      balances: Record<string, number>;
    }> = [];

    // 1. Apply Sudden Shock (deducted in order of liquidity)
    let remainingShock = parsedShockAmount;
    const shockDeductions: Record<string, number> = {};

    if (remainingShock > 0 && sortedAccounts.length > 0) {
      for (const account of sortedAccounts) {
        const bal = simulatedBalances[account.id] ?? 0;
        if (bal > 0) {
          const deduction = Math.min(bal, remainingShock);
          simulatedBalances[account.id] = bal - deduction;
          remainingShock -= deduction;
          shockDeductions[account.id] = deduction;
          if (remainingShock <= 0) break;
        }
      }
      
      // If there's still shock remaining after exhausting all accounts, force it on the most liquid account (can go negative)
      if (remainingShock > 0) {
        const primaryAcc = sortedAccounts[0];
        simulatedBalances[primaryAcc.id] = (simulatedBalances[primaryAcc.id] ?? 0) - remainingShock;
        shockDeductions[primaryAcc.id] = (shockDeductions[primaryAcc.id] || 0) + remainingShock;
        remainingShock = 0;
      }

      timelineEvents.push({
        month: 0,
        type: "shock",
        title: "Sudden Emergency Shock Applied",
        description: `Rp ${parsedShockAmount.toLocaleString("en-US")} deducted from liquid accounts.`,
        balances: { ...simulatedBalances },
      });
    }

    const currentSimulatedTotal = sortedAccounts.reduce(
      (sum, acc) => sum + (simulatedBalances[acc.id] ?? 0),
      0
    );

    // Keep track of which accounts are already dry or go dry
    const driedUpAccounts = new Set<string>();
    
    // Mark accounts that started at or below 0
    sortedAccounts.forEach((acc) => {
      if ((simulatedBalances[acc.id] ?? 0) <= 0) {
        driedUpAccounts.add(acc.id);
      }
    });

    let totalSimulatedRunwayMonths: number | null = 0;
    
    if (simulatedExpense <= 0) {
      // Without a measured burn rate there is nothing to deplete against, so the
      // honest reading is "unknown" rather than an unlimited reserve.
      timelineEvents.push({
        month: 0,
        type: "info",
        title: "Not Enough Spending History",
        description:
          "No measured burn rate yet. Record expenses for a few days before trusting this stress test.",
        balances: { ...simulatedBalances },
      });
      totalSimulatedRunwayMonths = null;
    } else if (currentSimulatedTotal <= 0) {
      // Immediate insolvency
      timelineEvents.push({
        month: 0,
        type: "insolvent",
        title: "Total System Depletion",
        description: "Total account balances have been exhausted by the shock event.",
        balances: { ...simulatedBalances },
      });
      totalSimulatedRunwayMonths = 0;
    } else if (netMonthlyCashflow >= 0) {
      // Cashflow surplus
      timelineEvents.push({
        month: 1,
        type: "stabilized",
        title: "Stable Operational State",
        description: `Income (${formatCurrency(simulatedIncome)}) exceeds or equals burn rate (${formatCurrency(simulatedExpense)}). Balances will grow under this scenario.`,
        balances: { ...simulatedBalances },
      });
      totalSimulatedRunwayMonths = Infinity;
    } else {
      // Deficit - deplete accounts month by month
      const monthlyDeficit = Math.abs(netMonthlyCashflow);
      totalSimulatedRunwayMonths = currentSimulatedTotal / monthlyDeficit;

      let simulatedMonth = 1;
      let workingTotal = currentSimulatedTotal;
      const maxMonths = 36; // Limit simulation horizon to 36 months

      while (workingTotal > 0 && simulatedMonth <= maxMonths) {
        let remainingDeficit = monthlyDeficit;

        for (const account of sortedAccounts) {
          const bal = simulatedBalances[account.id] ?? 0;
          if (bal > 0) {
            const deduction = Math.min(bal, remainingDeficit);
            simulatedBalances[account.id] = bal - deduction;
            remainingDeficit -= deduction;

            if (simulatedBalances[account.id] <= 0 && !driedUpAccounts.has(account.id)) {
              driedUpAccounts.add(account.id);
              timelineEvents.push({
                month: simulatedMonth,
                type: "depletion",
                title: `Account Depleted: ${account.name}`,
                description: `${account.name} (${account.accountType}) has been drained to Rp 0.`,
                balances: { ...simulatedBalances },
              });
            }

            if (remainingDeficit <= 0) break;
          }
        }

        workingTotal = sortedAccounts.reduce(
          (sum, acc) => sum + Math.max(0, simulatedBalances[acc.id] ?? 0),
          0
        );

        if (workingTotal <= 0) {
          // Exhausted in this month
          timelineEvents.push({
            month: simulatedMonth,
            type: "insolvent",
            title: "Total System Depletion",
            description: `All financial reserves exhausted at simulated Month ${simulatedMonth}.`,
            balances: { ...simulatedBalances },
          });
          break;
        }

        simulatedMonth++;
      }

      if (workingTotal > 0 && simulatedMonth > maxMonths) {
        timelineEvents.push({
          month: maxMonths,
          type: "info",
          title: "Simulation Horizon Reached",
          description: `Runway extends past ${maxMonths} months. Remaining simulated reserve: ${formatCurrency(workingTotal)}.`,
          balances: { ...simulatedBalances },
        });
      }
    }

    return {
      timelineEvents,
      simulatedIncome,
      simulatedExpense,
      netMonthlyCashflow,
      totalInitialBalance,
      currentSimulatedTotal: Math.max(0, currentSimulatedTotal),
      totalSimulatedRunwayMonths,
      driedUpAccountsCount: driedUpAccounts.size,
    };
  }, [accounts, accountBalances, averageMonthlyBurn, monthlyIncome, parsedShockAmount, jobLossActive]);

  // Determine system health status based on runway
  const runwayStatus = useMemo(() => {
    const months = simulation.totalSimulatedRunwayMonths;
    if (months === null) {
      return {
        label: "INSUFFICIENT DATA",
        description:
          "No measured burn rate yet. This stress test needs recorded spending first.",
        tone: "neutral" as const,
        bgClass: "border-white/20 bg-white/5 text-slate-200",
      };
    }
    if (months === Infinity) {
      return {
        label: "OPTIMAL SHIELD",
        description: "Cashflow is self-sustaining. Capital growth is active.",
        tone: "lime" as const,
        bgClass: "border-lime-300/30 bg-lime-300/5 text-lime-200",
      };
    } else if (months >= 6) {
      return {
        label: "STABLE DRIFT",
        description: "Healthy runway reserves. Low short-term vulnerability.",
        tone: "cyan" as const,
        bgClass: "border-cyan-300/30 bg-cyan-300/5 text-cyan-200",
      };
    } else if (months >= 3) {
      return {
        label: "MODERATE RISK",
        description: "Buffer is tightening. Consider optimization actions.",
        tone: "amber" as const,
        bgClass: "border-amber-300/30 bg-amber-300/5 text-amber-200",
      };
    } else {
      return {
        label: "CRITICAL BREACH",
        description: "Depletion imminent. Execute survival protocol immediately.",
        tone: "rose" as const,
        bgClass: "border-rose-300/30 bg-rose-300/5 text-rose-200",
      };
    }
  }, [simulation.totalSimulatedRunwayMonths]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-6" id="survival-matrix">
      <TerminalPanel className="signature-console neo-panel overflow-hidden !p-0">
        <div className="grid lg:grid-cols-[1fr_1.2fr]">
          {/* Controls Side */}
          <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="rose">Diagnostics</StatusChip>
              <StatusChip tone={isBalanceHidden ? "neutral" : runwayStatus.tone}>
                Survival Matrix
              </StatusChip>
            </div>
            
            <h2 className="neo-title mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Stress-Test Cockpit
            </h2>
            
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Simulate high-impact emergencies to test your reserve durability. See which accounts dry up first under stress. Trading accounts are excluded: a broker balance is not the cash that covers daily bills.
            </p>

            <div className="mt-6 space-y-6">
              {/* Job Loss Simulation Control */}
              <div className="border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Simulate Job Loss
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Sets monthly income to Rp 0
                    </p>
                  </div>
                  <button
                    onClick={() => setJobLossActive(!jobLossActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      jobLossActive ? "bg-rose-500" : "bg-zinc-700"
                    }`}
                    role="switch"
                    aria-checked={jobLossActive}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        jobLossActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sudden Cash Shock Control */}
              <div className="border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Simulate Sudden Shock
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Deduct a flat sum from liquid accounts immediately
                </p>

                <div className="mt-3">
                  <SharpInput
                    inputMode="numeric"
                    placeholder={
                      isBalanceHidden
                        ? "Shock amount hidden"
                        : "Enter shock amount (e.g. 15000000)"
                    }
                    type={isBalanceHidden ? "password" : "number"}
                    value={shockInput}
                    min="0"
                    onChange={(e) => setShockInput(e.target.value)}
                  />
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {presets.map((val) => (
                    <SharpButton
                      key={val}
                      type="button"
                      className="px-2 py-1.5 text-xs font-mono"
                      onClick={() => setShockInput(String(val))}
                    >
                      +{val / 1000000}M
                    </SharpButton>
                  ))}
                  <SharpButton
                    type="button"
                    className="px-2 py-1.5 text-xs font-mono"
                    variant="danger"
                    onClick={() => setShockInput("")}
                  >
                    Reset
                  </SharpButton>
                </div>
              </div>
            </div>

            {/* Simulated Parameters Summary */}
            <div className="mt-6 border-t border-white/10 pt-5 space-y-3">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>SIMULATED MONTHLY INCOME</span>
                <span className="text-lime-300 font-bold">
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(simulation.simulatedIncome)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>SIMULATED MONTHLY BURN</span>
                <span className="text-rose-300 font-bold">
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : formatCurrency(simulation.simulatedExpense)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>SIMULATED NET CASHFLOW</span>
                <span
                  className={`font-bold ${
                    !isBalanceHidden && simulation.netMonthlyCashflow < 0
                      ? "text-rose-400"
                      : "text-lime-300"
                  }`}
                >
                  {isBalanceHidden
                    ? hiddenBalanceLabel
                    : `${simulation.netMonthlyCashflow > 0 ? "+" : ""}${formatCurrency(simulation.netMonthlyCashflow)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline & Diagnostics Side */}
          <div className="p-5 sm:p-6 flex flex-col justify-between">
            {/* Top diagnostic panel reading */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  SYSTEM READOUT: SURVIVAL RUNWAY
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isBalanceHidden
                      ? "bg-slate-400"
                      : runwayStatus.tone === "rose"
                        ? "bg-rose-400"
                        : runwayStatus.tone === "amber"
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    isBalanceHidden
                      ? "bg-slate-500"
                      : runwayStatus.tone === "rose"
                        ? "bg-rose-500"
                        : runwayStatus.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-cyan-500"
                  }`}></span>
                </span>
              </div>

              <div
                className={`border p-4 mb-5 ${
                  isBalanceHidden
                    ? "border-white/10 bg-white/[0.03] text-slate-300"
                    : runwayStatus.bgClass
                }`}
              >
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <span className="text-2xl font-black tracking-wider font-mono">
                    {isBalanceHidden ? "PRIVACY ACTIVE" : runwayStatus.label}
                  </span>
                  <span className="text-3xl font-black font-mono">
                    {isBalanceHidden
                      ? hiddenBalanceLabel
                      : simulation.totalSimulatedRunwayMonths === null
                        ? "— MON"
                        : simulation.totalSimulatedRunwayMonths === Infinity
                          ? "∞ MON"
                          : `${simulation.totalSimulatedRunwayMonths.toFixed(1)} MON`}
                  </span>
                </div>
                <p className="text-xs mt-2 opacity-90 leading-relaxed">
                  {isBalanceHidden
                    ? "Runway status and financial narrative hidden while privacy mode is active."
                    : runwayStatus.description}
                </p>
              </div>

              {/* simulated timeline */}
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                DEPLETION LOG TIMELINE
              </h3>

              <div className="border border-white/10 bg-black/40 p-4 font-mono text-xs text-slate-300 space-y-4 max-h-[300px] overflow-y-auto rb-scrollbar">
                {isBalanceHidden ? (
                  <div className="flex gap-3">
                    <span className="shrink-0 select-none text-slate-500">
                      [M •••]
                    </span>
                    <div>
                      <span className="font-bold text-slate-300">
                        Simulation timeline hidden
                      </span>
                      <p className="mt-0.5 text-slate-500">
                        Event timing, account balances, and risk narrative are
                        hidden while privacy mode is active.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Initial state event if no other events exist */}
                    <div className="flex gap-3">
                      <span className="text-cyan-400 shrink-0 select-none">[M 0.0]</span>
                      <div>
                        <span className="text-white font-bold">Diagnostics Initiated</span>
                        <p className="text-slate-500 mt-0.5">
                          Starting capital reserve: {formatCurrency(simulation.totalInitialBalance)}
                        </p>
                      </div>
                    </div>

                    {simulation.timelineEvents.map((evt, idx) => (
                      <div key={idx} className="flex gap-3 border-t border-white/5 pt-2.5">
                        <span className={`shrink-0 select-none ${
                          evt.type === "insolvent"
                            ? "text-rose-400 font-bold"
                            : evt.type === "shock"
                              ? "text-amber-400"
                              : evt.type === "stabilized"
                                ? "text-lime-400 font-bold"
                                : "text-cyan-400"
                        }`}>
                          [M {evt.month.toFixed(1)}]
                        </span>
                        <div>
                          <span className={`font-bold ${
                            evt.type === "insolvent"
                              ? "text-rose-200"
                              : evt.type === "stabilized"
                                ? "text-lime-300"
                                : "text-white"
                          }`}>
                            {evt.title}
                          </span>
                          <p className="text-slate-400 mt-0.5">{evt.description}</p>

                          {/* Show remaining balances under this event */}
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-500">
                            {accounts.filter(a => !a.isArchived).map((acc) => {
                              const bal = evt.balances[acc.id] ?? 0;
                              return (
                                <div key={acc.id} className="flex justify-between">
                                  <span className="truncate max-w-[100px]">{acc.name}</span>
                                  <span className={bal <= 0 ? "text-rose-400 font-semibold" : "text-slate-400"}>
                                    {formatCurrency(bal)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Bottom status alert warning */}
            {!isBalanceHidden &&
            simulation.totalSimulatedRunwayMonths !== null &&
            simulation.totalSimulatedRunwayMonths !== Infinity &&
            simulation.totalSimulatedRunwayMonths < 3 ? (
              <SystemReading className="mt-5 border-rose-500/30 bg-rose-500/5">
                <div className="flex items-start gap-3">
                  <span className="text-rose-400 font-bold text-sm shrink-0">⚠️ SYSTEM BREACH WARNING:</span>
                  <p className="text-rose-200 text-xs leading-normal">
                    Reserve duration is critical under current simulated parameters. Depletion of cash accounts will occur in less than 90 days. Immediately reduce burn rate or secure alternative funding paths.
                  </p>
                </div>
              </SystemReading>
            ) : null}
          </div>
        </div>
      </TerminalPanel>
    </section>
  );
}
