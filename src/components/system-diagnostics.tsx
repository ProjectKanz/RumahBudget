"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  TerminalPanel,
  SharpButton,
  StatusChip,
  NumberValue,
  SystemReading,
} from "./cockpit-ui";
import { formatCurrency } from "@/src/lib/format";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Expense } from "@/src/types/expense";

type SystemDiagnosticsProps = {
  accounts: MoneyAccount[];
  accountBalances: Record<string, number>;
  expenses: Expense[];
  isBalanceHidden: boolean;
  autoStartScanTrigger?: number;
};

type FlaggedSubscription = {
  name: string;
  averageAmount: number;
  occurrences: number;
  lastPaid: number;
  accountIds: string[];
  category: string;
  expenses: Expense[];
};

const GENERIC_CATEGORIES = [
  "food",
  "transport",
  "shopping",
  "other",
  "groceries",
  "dining out",
];

const FEE_KEYWORDS = ["fee", "admin", "biaya transfer", "transfer fee"];

function isCurrentMonthTimestamp(createdAt: number) {
  if (!createdAt) return false;
  const date = new Date(createdAt);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function areNotesSimilar(n1: string, n2: string) {
  const clean1 = n1.trim().toLowerCase();
  const clean2 = n2.trim().toLowerCase();
  if (!clean1 && !clean2) return true;
  if (!clean1 || !clean2) return false;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const words1 = clean1.split(/\s+/).filter((w) => w.length >= 3);
  const words2 = clean2.split(/\s+/).filter((w) => w.length >= 3);
  return words1.some((w) => words2.includes(w));
}

function areExpensesSimilar(e1: Expense, e2: Expense) {
  const cat1 = e1.category.toLowerCase().trim();
  const cat2 = e2.category.toLowerCase().trim();

  const catMatches = cat1 === cat2;
  const notesSimilar = areNotesSimilar(e1.note, e2.note);

  // If categories are generic, they MUST have similar non-empty notes to be considered similar
  const isGeneric = GENERIC_CATEGORIES.includes(cat1);
  if (catMatches && isGeneric) {
    return e1.note.trim() !== "" && e2.note.trim() !== "" && notesSimilar;
  }

  return catMatches || notesSimilar;
}

export default function SystemDiagnostics({
  accounts,
  accountBalances,
  expenses,
  isBalanceHidden,
  autoStartScanTrigger = 0,
}: SystemDiagnosticsProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"idle" | "friction" | "ghost">("idle");
  const [expandedSubscription, setExpandedSubscription] = useState<number | null>(null);

  // --- 1. Idle Capital Scanner ---
  const { totalAssets, idleCapital, idleRatio, isIdleCapitalWarning, idleAccounts } =
    useMemo(() => {
      const activeAccounts = accounts.filter((acc) => !acc.isArchived);
      let total = 0;
      let idle = 0;
      const idleAccList: Array<{ name: string; balance: number; percentage: number }> = [];

      activeAccounts.forEach((acc) => {
        const bal = accountBalances[acc.id] ?? acc.initialBalance;
        const validBal = Math.max(0, bal);
        total += validBal;
        if (acc.accountType === "Cash" || acc.accountType === "E-Wallet") {
          idle += validBal;
        }
      });

      activeAccounts.forEach((acc) => {
        const bal = accountBalances[acc.id] ?? acc.initialBalance;
        const validBal = Math.max(0, bal);
        if (acc.accountType === "Cash" || acc.accountType === "E-Wallet") {
          idleAccList.push({
            name: acc.name,
            balance: validBal,
            percentage: total > 0 ? (validBal / total) * 100 : 0,
          });
        }
      });

      const ratio = total > 0 ? idle / total : 0;
      return {
        totalAssets: total,
        idleCapital: idle,
        idleRatio: ratio,
        isIdleCapitalWarning: ratio > 0.5,
        idleAccounts: idleAccList.sort((a, b) => b.balance - a.balance),
      };
    }, [accounts, accountBalances]);

  // --- 2. Friction Fee Auditor ---
  const { frictionExpenses, totalFrictionFees } = useMemo(() => {
    const monthlyExpenses = expenses.filter((e) => isCurrentMonthTimestamp(e.createdAt));
    const flagged = monthlyExpenses.filter((e) => {
      const note = (e.note || "").toLowerCase();
      const category = (e.category || "").toLowerCase();
      return FEE_KEYWORDS.some((kw) => note.includes(kw) || category.includes(kw));
    });
    const total = flagged.reduce((sum, e) => sum + e.amount, 0);
    return {
      frictionExpenses: flagged.sort((a, b) => b.createdAt - a.createdAt),
      totalFrictionFees: total,
    };
  }, [expenses]);

  // --- 3. Ghost Subscription Radar ---
  const subscriptions = useMemo<FlaggedSubscription[]>(() => {
    const sortedExpenses = [...expenses].sort((a, b) => a.createdAt - b.createdAt);
    const n = sortedExpenses.length;
    if (n === 0) return [];

    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number {
      let root = i;
      while (root !== parent[root]) {
        root = parent[root];
      }
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    }
    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootI] = rootJ;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const e1 = sortedExpenses[i];
        const e2 = sortedExpenses[j];

        const diffMs = e2.createdAt - e1.createdAt;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays > 33) {
          break; // too far, any subsequent will be further
        }

        if (diffDays >= 27) {
          const maxAmt = Math.max(e1.amount, e2.amount);
          if (maxAmt > 0 && Math.abs(e1.amount - e2.amount) / maxAmt <= 0.02) {
            if (areExpensesSimilar(e1, e2)) {
              union(i, j);
            }
          }
        }
      }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(i);
    }

    return Array.from(groups.values())
      .filter((indices) => indices.length >= 2)
      .map((indices) => {
        const groupExpenses = indices.map((idx) => sortedExpenses[idx]);
        const nonEmtpyNotes = groupExpenses.map((e) => e.note.trim()).filter(Boolean);
        const name = nonEmtpyNotes.length > 0 ? nonEmtpyNotes[0] : groupExpenses[0].category;
        const averageAmount =
          groupExpenses.reduce((sum, e) => sum + e.amount, 0) / groupExpenses.length;
        const lastPaid = groupExpenses[groupExpenses.length - 1].createdAt;
        const accountIds = Array.from(new Set(groupExpenses.map((e) => e.accountId)));

        return {
          name,
          averageAmount,
          occurrences: groupExpenses.length,
          lastPaid,
          accountIds,
          category: groupExpenses[0].category,
          expenses: groupExpenses.reverse(), // latest first inside display
        };
      })
      .sort((a, b) => b.lastPaid - a.lastPaid);
  }, [expenses]);

  const accountNamesById = useMemo(() => {
    return accounts.reduce<Record<string, string>>((acc, curr) => {
      acc[curr.id] = curr.name;
      return acc;
    }, {});
  }, [accounts]);

  // Run the diagnostic scan simulation
  const startScan = useCallback(() => {
    setIsScanning(true);
    setHasScanned(false);
    setScanProgress(0);
    setScanLogs([]);

    const logMessages = [
      "[INFO] Initializing Core Security & Leakage Diagnostics...",
      "[INFO] Connecting to ledger database protocols...",
      `[OK] Secure link established. Loaded ${accounts.filter(a => !a.isArchived).length} active money accounts.`,
      "[SCAN] Executing Idle Capital Scanner...",
      "[SCAN] Mapping liquidity ratios & risk thresholds...",
      `[OK] Idle Capital Scanner complete. Ratio: ${(idleRatio * 100).toFixed(1)}%`,
      "[SCAN] Running Friction Fee Auditor...",
      "[SCAN] Searching category clusters and note patterns for micro-leaks...",
      `[OK] Friction Fee Auditor complete. Identified: ${frictionExpenses.length} monthly fee transactions.`,
      "[SCAN] Initiating Ghost Subscription Radar...",
      "[SCAN] Scanning time-series intervals for consecutive 27-33 day recurring cycles...",
      `[OK] Ghost Subscription Radar complete. Potential active subscriptions: ${subscriptions.length}`,
      "[INFO] Compiling final diagnostics readouts...",
      "[SUCCESS] COMPILATION SECURE. LEAKAGE REPORT READY.",
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < logMessages.length) {
        setScanLogs((prev) => [...prev, logMessages[currentLogIndex]]);
        setScanProgress(Math.min(100, Math.floor(((currentLogIndex + 1) / logMessages.length) * 100)));
        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsScanning(false);
        setHasScanned(true);
      }
    }, 200);
  }, [accounts, idleRatio, frictionExpenses.length, subscriptions.length]);

  useEffect(() => {
    if (autoStartScanTrigger > 0) {
      const timer = setTimeout(() => {
        startScan();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [autoStartScanTrigger, startScan]);

  const isAnyLeakage = isIdleCapitalWarning || totalFrictionFees > 0 || subscriptions.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-6" id="system-diagnostics">
      <TerminalPanel className="signature-console neo-panel overflow-hidden !p-0">
        <div className="grid lg:grid-cols-[1fr_1.8fr]">
          {/* Diagnostic Controls */}
          <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="fuchsia">System Diagnostics</StatusChip>
                {hasScanned && (
                  <StatusChip tone={isAnyLeakage ? "rose" : "lime"}>
                    {isAnyLeakage ? "Leakage Detected" : "Clear State"}
                  </StatusChip>
                )}
              </div>

              <h2 className="neo-title mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Leakage Console
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Audit cash drag, trace transaction friction fees, and uncover forgotten monthly
                subscriptions buried in your transaction history.
              </p>
            </div>

            {/* Scan State Triggers */}
            <div className="mt-6 space-y-4">
              {!isScanning && !hasScanned && (
                <div className="border border-white/10 bg-white/[0.02] p-4 text-center">
                  <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider">
                    Scanner Status: Offline
                  </p>
                  <SharpButton
                    type="button"
                    variant="primary"
                    className="w-full font-mono text-xs uppercase"
                    onClick={startScan}
                  >
                    Run Diagnostic Scan
                  </SharpButton>
                </div>
              )}

              {isScanning && (
                <div className="border border-cyan-300/25 bg-cyan-950/20 p-4">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-cyan-300 animate-pulse uppercase">Scanning System Assets...</span>
                    <span className="text-cyan-200">{scanProgress}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-200"
                      style={{ width: `${scanProgress}%` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  </div>
                  <div className="mt-3 text-[10px] font-mono text-slate-500 line-clamp-1 truncate">
                    {scanLogs[scanLogs.length - 1]}
                  </div>
                </div>
              )}

              {hasScanned && (
                <div className="border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>IDLE ASSETS DRAG:</span>
                    <span className={isIdleCapitalWarning ? "text-amber-300" : "text-lime-300"}>
                      {(idleRatio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>MONTHLY FRICTION LEAK:</span>
                    <span className={totalFrictionFees > 0 ? "text-rose-300" : "text-lime-300"}>
                      {formatCurrency(totalFrictionFees)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>GHOST SUBSCRIPTIONS:</span>
                    <span className={subscriptions.length > 0 ? "text-fuchsia-300" : "text-lime-300"}>
                      {subscriptions.length} active
                    </span>
                  </div>

                  <SharpButton
                    type="button"
                    className="w-full font-mono text-xs uppercase mt-1 border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/10"
                    onClick={startScan}
                  >
                    Re-run Diagnostics
                  </SharpButton>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic Outputs */}
          <div className="p-5 sm:p-6 flex flex-col justify-between min-h-[420px]">
            {!isScanning && !hasScanned && (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-cyan-300/10 bg-cyan-300/[0.01] p-8 text-center">
                <span className="text-3xl mb-3">📡</span>
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Diagnostics Terminal Offline
                </span>
                <p className="text-xs text-slate-500 mt-2 max-w-sm">
                  Initialize a scan to query balances and transactions for leaks and optimization recommendations.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="flex flex-col h-full justify-between">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-3 pb-2 border-b border-white/5">
                  <span>TERMINAL LOG PROTOCOL</span>
                  <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </div>
                <div className="flex-1 bg-black/50 p-4 border border-white/5 font-mono text-[11px] leading-relaxed text-cyan-200 overflow-y-auto max-h-[300px] space-y-1.5 scrollbar-thin select-none">
                  {scanLogs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasScanned && (
              <div className="flex flex-col h-full justify-between">
                {/* Tabs */}
                <div>
                  <div className="flex border-b border-white/10 mb-5">
                    <button
                      className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
                        activeTab === "idle"
                          ? "border-cyan-300 text-white"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                      onClick={() => setActiveTab("idle")}
                    >
                      Idle Capital
                    </button>
                    <button
                      className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
                        activeTab === "friction"
                          ? "border-cyan-300 text-white"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                      onClick={() => setActiveTab("friction")}
                    >
                      Friction Fees
                    </button>
                    <button
                      className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
                        activeTab === "ghost"
                          ? "border-cyan-300 text-white"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                      onClick={() => setActiveTab("ghost")}
                    >
                      Ghost Radar
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="flex-1">
                    {/* 1. Idle Capital Scanner Readout */}
                    {activeTab === "idle" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                            Cash / E-Wallet Exposure
                          </h3>
                          <span
                            className={`text-xs font-mono px-2 py-0.5 border ${
                              isIdleCapitalWarning
                                ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                                : "border-lime-300/30 bg-lime-300/10 text-lime-200"
                            }`}
                          >
                            {isIdleCapitalWarning ? "WARNING TRIGGER" : "OPTIMAL LEVEL"}
                          </span>
                        </div>

                        {/* Breakdown meters */}
                        <div className="space-y-3">
                          <SystemReading className="border-white/10 bg-white/[0.02] p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-slate-400">Idle Cash / E-Wallets:</span>
                              <span className="text-white font-bold">
                                {isBalanceHidden ? "••••••" : formatCurrency(idleCapital)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-slate-400">Total Assets:</span>
                              <span className="text-white font-bold">
                                {isBalanceHidden ? "••••••" : formatCurrency(totalAssets)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 mt-1 relative overflow-hidden">
                              <div
                                className={`h-full ${
                                  isIdleCapitalWarning ? "bg-amber-400" : "bg-cyan-400"
                                }`}
                                style={{ width: `${Math.min(100, idleRatio * 100)}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Current idle ratio is {(idleRatio * 100).toFixed(1)}% of assets.
                            </p>
                          </SystemReading>

                          {isIdleCapitalWarning ? (
                            <div className="border border-amber-300/30 bg-amber-300/5 p-4 text-xs leading-relaxed text-amber-200">
                              <p className="font-bold mb-1">⚠️ ALLOCATION WARNING:</p>
                              Your liquid cash and e-wallet accounts contain more than 50% of your
                              total reserves. Excess cash stored in non-interest E-Wallets loses value
                              to inflation and yields zero returns. Consider transferring a portion
                              to high-yield savings (e.g. Bank) or investment portfolios.
                            </div>
                          ) : (
                            <div className="border border-lime-300/30 bg-lime-300/5 p-4 text-xs leading-relaxed text-lime-200">
                              <p className="font-bold mb-1">✓ ALLOCATION OPTIMAL:</p>
                              Your idle cash reserve is well-balanced. It represents less than 50% of
                              your assets, meaning your capital is properly deployed in high-yield
                              bank accounts or investments.
                            </div>
                          )}

                          {/* List of idle accounts */}
                          {idleAccounts.length > 0 && (
                            <div>
                              <p className="text-[11px] font-black uppercase text-slate-500 mb-2">
                                Idle Assets Details
                              </p>
                              <div className="space-y-1.5 font-mono text-xs max-h-[140px] overflow-y-auto">
                                {idleAccounts.map((acc, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between p-2 border border-white/5 bg-white/[0.01]"
                                  >
                                    <span className="text-slate-300 truncate max-w-[180px]">
                                      {acc.name}
                                    </span>
                                    <div className="space-x-3 text-right">
                                      <span className="text-slate-500">
                                        {acc.percentage.toFixed(0)}%
                                      </span>
                                      <span className="text-white font-semibold">
                                        {isBalanceHidden ? "••••••" : formatCurrency(acc.balance)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Friction Fee Auditor Readout */}
                    {activeTab === "friction" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                            Micro-Leakage Summary
                          </h3>
                          <span
                            className={`text-xs font-mono px-2 py-0.5 border ${
                              totalFrictionFees > 0
                                ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
                                : "border-lime-300/30 bg-lime-300/10 text-lime-200"
                            }`}
                          >
                            {totalFrictionFees > 0 ? "LEAK DETECTED" : "ZERO LEAKAGE"}
                          </span>
                        </div>

                        <SystemReading className="border-white/10 bg-white/[0.02] p-4 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-slate-400">Monthly Leakage:</span>
                            <span className="text-rose-300 font-bold text-base">
                              <NumberValue>{formatCurrency(totalFrictionFees)}</NumberValue>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Based on transactions matching keywords (fee, admin, transfer, biaya).
                          </p>
                        </SystemReading>

                        {totalFrictionFees > 0 ? (
                          <div className="border border-rose-300/35 bg-rose-500/5 p-4 text-xs leading-relaxed text-rose-200">
                            <p className="font-bold mb-1">💸 EFFICIENCY RECOMMENDATION:</p>
                            We detected Rp {totalFrictionFees.toLocaleString("en-US")} leaked to admin
                            fees this month. To reduce this friction, consider:
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                              <li>Consolidating transfers into single large payments instead of small ones.</li>
                              <li>Using bank accounts with free inter-bank transfers.</li>
                              <li>Funding digital wallets through free withdrawal/transfer methods.</li>
                            </ul>
                          </div>
                        ) : (
                          <div className="border border-lime-300/30 bg-lime-300/5 p-4 text-xs leading-relaxed text-lime-200">
                            <p className="font-bold mb-1">✓ LEAKAGE SHIELD ACTIVE:</p>
                            {"No micro-transaction friction or transfer fees detected in this month's ledger. Your movement of funds is operating at 100% efficiency."}
                          </div>
                        )}

                        {/* List of fee transactions */}
                        {frictionExpenses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-black uppercase text-slate-500 mb-2">
                              Flagged Monthly Friction Fees
                            </p>
                            <div className="space-y-1.5 font-mono text-xs max-h-[140px] overflow-y-auto">
                              {frictionExpenses.map((e, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between p-2 border border-white/5 bg-white/[0.01] hover:border-white/10"
                                >
                                  <div className="flex flex-col truncate max-w-[200px]">
                                    <span className="text-white truncate">
                                      {e.note || "Transfer Fee"}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {accountNamesById[e.accountId] || "Account"} • {e.category}
                                    </span>
                                  </div>
                                  <span className="text-rose-300 font-semibold shrink-0">
                                    {formatCurrency(e.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Ghost Subscription Radar Readout */}
                    {activeTab === "ghost" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                            Ghost Subscription Risk
                          </h3>
                          <span
                            className={`text-xs font-mono px-2 py-0.5 border ${
                              subscriptions.length > 0
                                ? "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200"
                                : "border-lime-300/30 bg-lime-300/10 text-lime-200"
                            }`}
                          >
                            {subscriptions.length > 0 ? "REVIEW RECOMMENDED" : "SECURE STATUS"}
                          </span>
                        </div>

                        {subscriptions.length === 0 ? (
                          <div className="border border-lime-300/30 bg-lime-300/5 p-4 text-xs leading-relaxed text-lime-200">
                            <p className="font-bold mb-1">✓ RADAR CLEAR:</p>
                            No matching periodic transaction cycles (27-33 days separation) detected in
                            your ledger histories. Ghost subscription risk is low.
                          </div>
                        ) : (
                          <div className="border border-fuchsia-300/30 bg-fuchsia-500/5 p-4 text-xs leading-relaxed text-fuchsia-200">
                            <p className="font-bold mb-1">📡 RADAR INTERCEPT:</p>
                            Flagged {subscriptions.length} potential subscription cycle(s). These are
                            repeating payments occurring approximately every 30 days. Inspect if any
                            of these are unused accounts that can be cancelled.
                          </div>
                        )}

                        {/* List of subscriptions */}
                        {subscriptions.length > 0 && (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {subscriptions.map((sub, idx) => {
                              const isExpanded = expandedSubscription === idx;
                              return (
                                <div
                                  key={idx}
                                  className="border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20"
                                >
                                  <div className="flex justify-between items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-black text-white truncate">
                                        {sub.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        {sub.occurrences} consecutive months • Paid via{" "}
                                        {sub.accountIds
                                          .map((id) => accountNamesById[id] || "Account")
                                          .join(", ")}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-xs font-bold text-fuchsia-300 font-mono">
                                        {formatCurrency(sub.averageAmount)} / mo
                                      </p>
                                      <button
                                        onClick={() =>
                                          setExpandedSubscription(isExpanded ? null : idx)
                                        }
                                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono mt-1"
                                      >
                                        {isExpanded ? "Hide Details" : "View Dates"}
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1">
                                      <p className="text-[10px] uppercase font-bold text-slate-500">
                                        Detected payments timeline:
                                      </p>
                                      <div className="grid grid-cols-1 gap-1 text-[10px] font-mono text-slate-400">
                                        {sub.expenses.map((exp, eIdx) => (
                                          <div
                                            key={eIdx}
                                            className="flex justify-between p-1 bg-black/20"
                                          >
                                            <span>
                                              {new Date(exp.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                              })}
                                            </span>
                                            <span className="text-white">
                                              {formatCurrency(exp.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </TerminalPanel>
    </section>
  );
}
