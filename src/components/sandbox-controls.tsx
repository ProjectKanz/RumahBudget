"use client";

import {
  EmptyState,
  Notice,
  NumberValue,
  SectionHeader,
  SharpButton,
  SharpInput,
  SharpSelect,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { SandboxTransaction } from "@/src/types/sandbox";
import { FormEvent, useCallback, useState, useMemo } from "react";

type SandboxControlsProps = {
  sandboxTransactions: SandboxTransaction[];
  onAddSandboxTransaction: (tx: SandboxTransaction) => void;
  onDeleteSandboxTransaction: (id: string) => void;
  actualTotalBalance: number;
  actualMonthlyIncome: number;
  actualMonthlyExpense: number;
  isBalanceHidden: boolean;
  isSandboxMode: boolean;
  onToggleSandboxMode: (value: boolean) => void;
  onCreateShareUrl: () => string;
  importNotice?: string;
};

const labelClassName = "text-sm font-medium text-slate-300";

// Helper to calculate the next 12 months from current date
function getNext12Months() {
  const months = [];
  const today = new Date();
  for (let i = 1; i <= 12; i++) {
    const nextDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = nextDate.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    months.push(label);
  }
  return months;
}

export default function SandboxControls({
  sandboxTransactions,
  onAddSandboxTransaction,
  onDeleteSandboxTransaction,
  actualTotalBalance,
  actualMonthlyIncome,
  actualMonthlyExpense,
  isBalanceHidden,
  isSandboxMode,
  onToggleSandboxMode,
  onCreateShareUrl,
  importNotice,
}: SandboxControlsProps) {
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [timing, setTiming] = useState<"recurring" | "one-time">("recurring");
  const [monthOffset, setMonthOffset] = useState("1");
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const monthsList = useMemo(() => getNext12Months(), []);

  // Calculate 12-month projections
  const projectionData = useMemo(() => {
    const monthlyNet = actualMonthlyIncome - actualMonthlyExpense;
    const data = [];

    // Month 0 (Now)
    data.push({
      monthIndex: 0,
      label: "Now",
      balance: actualTotalBalance,
      isNegative: actualTotalBalance < 0,
    });

    let currentBalance = actualTotalBalance;
    for (let m = 1; m <= 12; m++) {
      const sandboxNet = sandboxTransactions.reduce((sum, tx) => {
        if (tx.timing === "recurring" || tx.monthOffset === m) {
          if (tx.type === "income") return sum + tx.amount;
          if (tx.type === "expense") return sum - tx.amount;
        }
        return sum;
      }, 0);

      currentBalance = currentBalance + monthlyNet + sandboxNet;
      data.push({
        monthIndex: m,
        label: monthsList[m - 1],
        balance: currentBalance,
        isNegative: currentBalance < 0,
      });
    }
    return data;
  }, [actualTotalBalance, actualMonthlyIncome, actualMonthlyExpense, sandboxTransactions, monthsList]);

  // Find scale bounds for chart SVG
  const { yMin, yMax } = useMemo(() => {
    const balances = projectionData.map((d) => d.balance);
    const maxVal = Math.max(...balances, actualTotalBalance, 1);
    const minVal = Math.min(...balances, actualTotalBalance, 0);
    const valRange = maxVal - minVal;
    const padding = valRange * 0.1 || 1000;
    return {
      maxVal,
      minVal,
      yMin: minVal - padding,
      yMax: maxVal + padding,
    };
  }, [projectionData, actualTotalBalance]);

  // SVG Chart Config
  const width = 700;
  const height = 280;
  const paddingLeft = 85;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = useCallback((index: number) => paddingLeft + (index * chartWidth) / 12, [chartWidth]);
  const getY = useCallback((val: number) => {
    const range = yMax - yMin;
    if (range === 0) return paddingTop + chartHeight / 2;
    return paddingTop + chartHeight - ((val - yMin) / range) * chartHeight;
  }, [chartHeight, yMax, yMin]);

  const pathD = useMemo(() => {
    return projectionData
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.balance)}`)
      .join(" ");
  }, [getX, getY, projectionData]);

  const areaD = useMemo(() => {
    if (!pathD) return "";
    return `${pathD} L ${getX(12)} ${getY(yMin)} L ${getX(0)} ${getY(yMin)} Z`;
  }, [getX, getY, pathD, yMin]);

  const zeroY = useMemo(() => {
    if (yMin < 0 && yMax > 0) {
      return getY(0);
    }
    return null;
  }, [getY, yMin, yMax]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      setError("Please enter a label for the simulation transaction.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter an amount greater than 0.");
      return;
    }

    const tx: SandboxTransaction = {
      id: crypto.randomUUID(),
      type,
      label: trimmedLabel,
      amount: numericAmount,
      timing,
      monthOffset: timing === "one-time" ? Number(monthOffset) : undefined,
    };

    onAddSandboxTransaction(tx);
    setLabel("");
    setAmount("");
  }

  async function handleShareSimulation() {
    setShareMessage("");
    setError("");

    const shareUrl = onCreateShareUrl();
    if (!shareUrl) {
      setShareMessage("Add at least one scenario branch before sharing a simulation.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Share link copied to clipboard.");
    } catch {
      setShareMessage("Unable to copy automatically. Select and copy the generated URL from your browser console.");
      console.info("RumahBudget sandbox share URL:", shareUrl);
    }
  }

  // Count negative months
  const negativeMonthsCount = projectionData.filter((d) => d.isNegative).length;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-5 sm:px-6" id="sandbox-workspace">
      {!isSandboxMode && (
        <Notice tone="amber" className="mb-6 animate-pulse">
          ⚠️ Simulation Mode is currently <span className="font-bold underline text-white">DEACTIVATED</span>. Scenario branches configured below are isolated and will not affect the overview cockpit metrics or spend signal gauges.
          <button
            onClick={() => onToggleSandboxMode(true)}
            className="ml-2 underline font-black text-amber-300 hover:text-white cursor-pointer"
          >
            [ACTIVATE SIMULATION PROTOCOL]
          </button>
        </Notice>
      )}

      {importNotice ? (
        <Notice tone={importNotice.startsWith("Loaded") ? "lime" : "amber"} className="mb-6">
          {importNotice}
        </Notice>
      ) : null}

      {/* 12-Month Projections Header & Chart */}
      <TerminalPanel className="mb-8 border-amber-500/20 bg-black/40">
        <SectionHeader
          eyebrow="Financial Branching projection"
          title="12-Month Balance Projection"
          tone="amber"
          description={
            <>
              Model how changes propagate over time. The projection starts from your current actual balance (
              <span className="text-white font-semibold">
                {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(actualTotalBalance)}
              </span>
              ) and simulates monthly cashflow of{" "}
              <span
                className={
                  actualMonthlyIncome - actualMonthlyExpense < 0 ? "text-rose-300 font-semibold" : "text-lime-300 font-semibold"
                }
              >
                {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(actualMonthlyIncome - actualMonthlyExpense)}
              </span>{" "}
              each month, modified by active sandbox scenarios.
            </>
          }
        />

        <div className="mt-5 flex flex-col gap-3 border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-400">
              Blueprint sharing
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Export the current scenario branches as a reloadable sandbox link.
            </p>
          </div>
          <SharpButton
            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 focus:ring-amber-500/20"
            disabled={sandboxTransactions.length === 0}
            onClick={handleShareSimulation}
            type="button"
            variant="ghost"
          >
            Share Simulation
          </SharpButton>
        </div>

        {shareMessage ? (
          <Notice className="mt-4" tone={shareMessage.startsWith("Share link") ? "lime" : "amber"}>
            {shareMessage}
          </Notice>
        ) : null}

        {/* Projection Status readout */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="border border-amber-500/25 bg-amber-500/5 p-4">
            <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-500 block">
              12-Month End Balance
            </span>
            <span
              className={`text-xl font-black font-mono block mt-1 ${
                projectionData[12].isNegative ? "text-rose-400" : "text-white"
              }`}
            >
              {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(projectionData[12].balance)}
            </span>
          </div>

          <div className="border border-amber-500/25 bg-amber-500/5 p-4">
            <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-500 block">
              Net Change Over 12M
            </span>
            <span
              className={`text-xl font-black font-mono block mt-1 ${
                projectionData[12].balance - actualTotalBalance < 0 ? "text-rose-400" : "text-lime-400"
              }`}
            >
              {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(projectionData[12].balance - actualTotalBalance)}
            </span>
          </div>

          <div className="border border-amber-500/25 bg-amber-500/5 p-4 sm:col-span-2 md:col-span-1">
            <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-500 block">
              Critical Runway Alert
            </span>
            {negativeMonthsCount > 0 ? (
              <span className="text-xl font-black text-rose-400 block mt-1 animate-pulse">
                {negativeMonthsCount} / 12 Months Negative!
              </span>
            ) : (
              <span className="text-xl font-black text-lime-400 block mt-1">
                0 / 12 Months Negative (Clear)
              </span>
            )}
          </div>
        </div>

        {/* SVG Projection Chart */}
        <div className="mt-6 border border-white/10 bg-black/70 p-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
              {/* Definitions for Gradients */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={width - paddingRight}
                y2={paddingTop}
                className="stroke-white/5"
                strokeWidth={1}
              />
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight / 2}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight / 2}
                className="stroke-white/5"
                strokeWidth={1}
              />
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight}
                className="stroke-white/10"
                strokeWidth={1.5}
              />

              {/* Zero Threshold Indicator Line */}
              {zeroY !== null && zeroY >= paddingTop && zeroY <= paddingTop + chartHeight && (
                <g>
                  <line
                    x1={paddingLeft}
                    y1={zeroY}
                    x2={width - paddingRight}
                    y2={zeroY}
                    className="stroke-rose-500/50"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={zeroY + 3}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-rose-400 font-bold"
                  >
                    0.00 (Threshold)
                  </text>
                </g>
              )}

              {/* Chart Area */}
              <path d={areaD} fill="url(#areaGradient)" />

              {/* Chart Line */}
              <path
                d={pathD}
                fill="none"
                className="stroke-amber-500"
                strokeWidth={2.5}
                style={{ filter: "drop-shadow(0 0 4px rgba(245,158,11,0.5))" }}
              />

              {/* Points / Circles */}
              {projectionData.map((d, i) => {
                const cx = getX(i);
                const cy = getY(d.balance);
                return (
                  <g key={i} className="group cursor-pointer">
                    {/* Ring for critical balances */}
                    {d.isNegative && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7.5}
                        className="fill-none stroke-rose-500/80 animate-pulse"
                        strokeWidth={1.5}
                      />
                    )}
                    {/* Pulsing ring for hover effect */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9}
                      className="fill-transparent group-hover:fill-amber-500/10 stroke-none transition-colors duration-200"
                    />
                    {/* Point dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      className={`stroke-black stroke-1.5 transition-transform duration-200 group-hover:scale-130 ${
                        d.isNegative ? "fill-rose-500" : "fill-amber-500"
                      }`}
                    />
                    {/* Value readout above the dot (only for odd/now/end or hovered) */}
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      className={`text-[9px] font-mono font-bold select-none pointer-events-none transition-opacity duration-200 ${
                        d.isNegative ? "fill-rose-300" : "fill-amber-300"
                      } ${i === 0 || i === 12 || i % 2 === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      {isBalanceHidden ? "***" : formatCurrency(d.balance).replace("Rp ", "").replace("Rp", "")}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {projectionData.map((d, i) => (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 18}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-black fill-slate-400"
                >
                  {d.label}
                </text>
              ))}

              {/* Y Axis Grid Label (Max) */}
              <text
                x={paddingLeft - 8}
                y={paddingTop + 4}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-500 font-bold"
              >
                {isBalanceHidden ? "***" : formatCurrency(yMax)}
              </text>

              {/* Y Axis Grid Label (Min) */}
              <text
                x={paddingLeft - 8}
                y={paddingTop + chartHeight}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-500 font-bold"
              >
                {isBalanceHidden ? "***" : formatCurrency(yMin)}
              </text>
            </svg>
          </div>
        </div>
      </TerminalPanel>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Simulator controls form */}
        <TerminalPanel className="border-amber-500/20 bg-black/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-500">
              Simulation Console
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-white">
              Inject Mock Transaction
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Configure temporary scenario changes to observe their impact on the runway.
            </p>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className={labelClassName}>
              Transaction Type
              <SharpSelect
                value={type}
                onChange={(event) => setType(event.target.value as "income" | "expense" | "transfer")}
              >
                <option value="expense">Expense (Outflow)</option>
                <option value="income">Income (Inflow)</option>
                <option value="transfer">Transfer (Internal movement)</option>
              </SharpSelect>
            </label>

            <label className={labelClassName}>
              Label / Scenario name
              <SharpInput
                type="text"
                placeholder="Example: Rent Raise, Side Gig, Car Purchase"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              Amount (Rp)
              <SharpInput
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Rp 0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label className={labelClassName}>
              Timing Protocol
              <SharpSelect
                value={timing}
                onChange={(event) => setTiming(event.target.value as "recurring" | "one-time")}
              >
                <option value="recurring">Recurring Monthly</option>
                <option value="one-time">One-time occurrence</option>
              </SharpSelect>
            </label>

            {timing === "one-time" ? (
              <label className={`${labelClassName} sm:col-span-2`}>
                Select Future Month Target
                <SharpSelect value={monthOffset} onChange={(event) => setMonthOffset(event.target.value)}>
                  {monthsList.map((monthLabel, index) => (
                    <option key={index} value={String(index + 1)}>
                      Month {index + 1} ({monthLabel})
                    </option>
                  ))}
                </SharpSelect>
              </label>
            ) : null}

            {type === "transfer" ? (
              <Notice tone="amber" className="sm:col-span-2 text-xs">
                ⚠️ Notice: Sandbox Transfers model moving assets internally, which has a net change of zero (Rp 0) on the projected Total Account Balance.
              </Notice>
            ) : null}

            {error ? (
              <Notice className="sm:col-span-2" tone="rose">
                {error}
              </Notice>
            ) : null}

            <div className="sm:col-span-2 mt-2">
              <SharpButton className="w-full border-amber-500/40 text-amber-200 hover:bg-amber-500/10 focus:ring-amber-500/20" variant="ghost" type="submit">
                Inject Scenario Branch
              </SharpButton>
            </div>
          </form>
        </TerminalPanel>

        {/* Active Sandbox Scenario branches */}
        <TerminalPanel className="border-amber-500/20 bg-black/40">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-500">
              Active Scenarios
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-white">
              Simulation Branches
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Memory-held parameters currently affecting simulation. These are not written to Supabase.
            </p>
          </div>

          <div className="space-y-3">
            {sandboxTransactions.length === 0 ? (
              <EmptyState className="border-amber-500/20 bg-amber-500/5 text-slate-400">
                No active simulation branches. Use the form on the left to inject mock transactions and model outcomes.
              </EmptyState>
            ) : (
              sandboxTransactions.map((tx) => (
                <article
                  key={tx.id}
                  className="cockpit-card flex items-center justify-between border-amber-500/15 bg-black/30 p-4 hover:border-amber-500/35 transition"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm truncate">{tx.label}</p>
                      <StatusChip
                        tone={tx.type === "income" ? "lime" : tx.type === "expense" ? "rose" : "cyan"}
                        className="!px-1.5 !py-0.5 !text-[0.55rem] tracking-[0.1em]"
                      >
                        {tx.type}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 font-mono">
                      {tx.timing === "recurring" ? (
                        "Recurring Monthly"
                      ) : (
                        `One-time in Month ${tx.monthOffset} (${monthsList[(tx.monthOffset ?? 1) - 1]})`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-mono text-sm font-black ${
                        tx.type === "income" ? "text-lime-400" : tx.type === "expense" ? "text-rose-400" : "text-cyan-400"
                      }`}
                    >
                      <NumberValue>
                        {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                        {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(tx.amount)}
                      </NumberValue>
                    </span>
                    <button
                      onClick={() => onDeleteSandboxTransaction(tx.id)}
                      type="button"
                      className="border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 px-2 py-1 text-xs transition font-black font-mono shrink-0 cursor-pointer"
                      title="Prune branch"
                    >
                      PRUNE
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </TerminalPanel>
      </div>
    </section>
  );
}
