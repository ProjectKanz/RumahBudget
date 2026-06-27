"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MoneyAccount } from "@/src/types/money-account";
import type { Expense } from "@/src/types/expense";
import type { Income } from "@/src/types/income";

const CATEGORIES = ["Groceries", "Transportation", "Bills", "Education", "Health", "Other"];

type AppView = "overview" | "accounts" | "add" | "transactions" | "reports" | "allocation" | "sandbox" | "settings";

type CommandKProps = {
  accounts: MoneyAccount[];
  addExpense: (expense: Expense) => Promise<boolean>;
  addIncome: (income: Income) => Promise<boolean>;
  addTransfer: (transfer: {
    amount: number;
    fromAccountId: string;
    note: string;
    toAccountId: string;
  }) => Promise<boolean>;
  setActiveView: (view: AppView) => void;
  isSandboxMode: boolean;
  handleSetSandboxMode: (value: boolean) => void;
  isBalanceHidden: boolean;
  setIsBalanceHidden: (value: boolean) => void;
  onScan?: () => void;
};

const COMMANDS = [
  { name: "/view", description: "Switch views (overview, accounts, add, transactions, reports, allocation, sandbox, settings)", usage: "/view <tab>" },
  { name: "/expense", description: "Quick insert expense with amount, category, and optional note", usage: "/expense <amount> <category> [note]" },
  { name: "/income", description: "Quick insert income with amount, source, and optional note", usage: "/income <amount> <source> [note]" },
  { name: "/sandbox", description: "Toggle Scenario Branching Sandbox mode", usage: "/sandbox" },
  { name: "/scan", description: "Execute system diagnostics & leakage scan", usage: "/scan" },
  { name: "/hide", description: "Toggle balance privacy & hide financial numbers", usage: "/hide" },
];

// Helper functions defined outside the component to avoid react-hooks/purity warnings
function getTimestamp(): number {
  return Date.now();
}

function getUUID(): string {
  return crypto.randomUUID();
}

export default function CommandK({
  accounts,
  addExpense,
  addIncome,
  setActiveView,
  isSandboxMode,
  handleSetSandboxMode,
  isBalanceHidden,
  setIsBalanceHidden,
  onScan,
}: CommandKProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Interactive prompts states (when missing arguments)
  const [promptCommand, setPromptCommand] = useState<"/expense" | "/income" | null>(null);
  const [promptAmount, setPromptAmount] = useState("");
  const [promptCategory, setPromptCategory] = useState("");
  const [promptSource, setPromptSource] = useState("");
  const [promptAccountId, setPromptAccountId] = useState("");
  const [promptNote, setPromptNote] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const activeAccounts = accounts.filter((acc) => !acc.isArchived);

  // Reset helper defined before usage to prevent TDZ error
  const resetPrompts = useCallback(() => {
    setPromptCommand(null);
    setPromptAmount("");
    setPromptCategory("");
    setPromptSource("");
    setPromptNote("");
    if (activeAccounts.length > 0) {
      setPromptAccountId(activeAccounts[0].id);
    }
  }, [activeAccounts]);

  const toggleConsole = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setErrorMsg("");
        setSuccessMsg("");
        if (activeAccounts.length > 0) {
          setPromptAccountId(activeAccounts[0].id);
        }
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      } else {
        setInputValue("");
        resetPrompts();
      }
      return next;
    });
  }, [activeAccounts, resetPrompts]);

  const handleClose = useCallback(() => {
    setInputValue("");
    resetPrompts();
    setIsOpen(false);
  }, [resetPrompts]);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleConsole();
      }
    };
    window.addEventListener("keydown", handleKeyDownGlobal);
    return () => window.removeEventListener("keydown", handleKeyDownGlobal);
  }, [toggleConsole]);

  // Helper to parse typed string on Enter
  const executeCommand = async (fullInput: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    const trimmed = fullInput.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (commandName === "/view") {
      const viewArg = (args[0] || "").toLowerCase() as AppView;
      const validViews: AppView[] = ["overview", "accounts", "add", "transactions", "reports", "allocation", "sandbox", "settings"];
      if (validViews.includes(viewArg)) {
        setActiveView(viewArg);
        showSuccess(`Switched to ${viewArg} view`);
      } else {
        setErrorMsg("Invalid view tab name. Try: overview, accounts, add, transactions, reports, allocation, sandbox, settings");
      }
      return;
    }

    if (commandName === "/sandbox") {
      handleSetSandboxMode(!isSandboxMode);
      showSuccess(`Sandbox mode toggled: ${!isSandboxMode ? "ON" : "OFF"}`);
      return;
    }

    if (commandName === "/scan") {
      if (onScan) {
        onScan();
        showSuccess("Diagnostics scan initialized.");
      } else {
        setActiveView("overview");
        setTimeout(() => {
          const el = document.getElementById("system-diagnostics");
          el?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        showSuccess("Navigated to Overview. Execute the scan there.");
      }
      return;
    }

    if (commandName === "/hide") {
      setIsBalanceHidden(!isBalanceHidden);
      showSuccess(`Balance privacy toggled: ${!isBalanceHidden ? "HIDDEN" : "VISIBLE"}`);
      return;
    }

    if (commandName === "/expense") {
      // Syntax: /expense <amount> <category> [note]
      const amountStr = args[0] || "";
      const categoryInput = args[1] || "";
      const noteInput = args.slice(2).join(" ");

      // Parse amount
      const parsedAmount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
      
      // Match category case-insensitively
      let matchedCategory = "";
      if (categoryInput) {
        const found = CATEGORIES.find(
          (c) => c.toLowerCase() === categoryInput.toLowerCase()
        );
        if (found) matchedCategory = found;
      }

      if (isNaN(parsedAmount) || !matchedCategory) {
        // Missing or invalid parameters, trigger interactive prompt
        setPromptCommand("/expense");
        if (!isNaN(parsedAmount)) setPromptAmount(String(parsedAmount));
        if (matchedCategory) setPromptCategory(matchedCategory);
        if (noteInput) setPromptNote(noteInput);
        setErrorMsg("Interactive Prompt: Please complete the missing fields below.");
        return;
      }

      // We have all details, proceed to insert
      await submitExpense(parsedAmount, matchedCategory, noteInput, promptAccountId || activeAccounts[0]?.id);
      return;
    }

    if (commandName === "/income") {
      // Syntax: /income <amount> <source> [note]
      const amountStr = args[0] || "";
      const sourceInput = args[1] || "";
      const noteInput = args.slice(2).join(" ");

      const parsedAmount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);

      if (isNaN(parsedAmount) || !sourceInput) {
        // Missing parameters, trigger interactive prompt
        setPromptCommand("/income");
        if (!isNaN(parsedAmount)) setPromptAmount(String(parsedAmount));
        if (sourceInput) setPromptSource(sourceInput);
        if (noteInput) setPromptNote(noteInput);
        setErrorMsg("Interactive Prompt: Please complete the missing fields below.");
        return;
      }

      await submitIncome(parsedAmount, sourceInput, noteInput, promptAccountId || activeAccounts[0]?.id);
      return;
    }

    // Default: command not found
    setErrorMsg(`Unknown command: ${commandName}. Type one of the listed commands.`);
  };

  const submitExpense = async (amount: number, category: string, note: string, accountId: string) => {
    if (!accountId) {
      setErrorMsg("No active money accounts. Please create one first.");
      return;
    }
    setIsSubmitting(true);
    try {
      const expenseObj: Expense = {
        id: getUUID(),
        owner: "Console",
        userId: "",
        accountId: accountId,
        createdAt: getTimestamp(),
        amount: amount,
        category: category,
        paymentMethod: "Cash",
        note: note || "Recorded via Console",
      };

      const success = await addExpense(expenseObj);
      if (success) {
        const accountName = accounts.find((a) => a.id === accountId)?.name || "account";
        showSuccess(`Success: Recorded expense of Rp ${amount.toLocaleString()} in ${accountName}.`);
        resetPrompts();
      } else {
        setErrorMsg("Failed to record expense. Please verify account/connection.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitIncome = async (amount: number, source: string, note: string, accountId: string) => {
    if (!accountId) {
      setErrorMsg("No active money accounts. Please create one first.");
      return;
    }
    setIsSubmitting(true);
    try {
      const incomeObj: Income = {
        id: getUUID(),
        owner: "Console",
        userId: "",
        accountId: accountId,
        createdAt: getTimestamp(),
        amount: amount,
        source: source,
        note: note || "Recorded via Console",
      };

      const success = await addIncome(incomeObj);
      if (success) {
        const accountName = accounts.find((a) => a.id === accountId)?.name || "account";
        showSuccess(`Success: Recorded income of Rp ${amount.toLocaleString()} in ${accountName}.`);
        resetPrompts();
      } else {
        setErrorMsg("Failed to record income. Please verify account/connection.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg("");
    setInputValue("");
    // Close modal after a brief success display delay
    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(inputValue);
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  // Filter commands shown in console
  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!inputValue) return true;
    // Match prefix or contains
    return cmd.name.startsWith(inputValue.split(" ")[0]);
  });

  if (!isOpen) return null;

  const glowColorClass = isSandboxMode
    ? "shadow-[0_0_50px_rgba(245,158,11,0.25)] border-amber-500/30"
    : "shadow-[0_0_50px_rgba(34,211,238,0.25)] border-cyan-300/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className={`relative w-full max-w-2xl glass-frosted rounded-none border overflow-hidden ${glowColorClass} flex flex-col max-h-[90vh]`}>
        
        {/* Console Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-black/40 text-xs font-mono select-none">
          <span className={`${isSandboxMode ? 'text-amber-400' : 'text-cyan-400'} font-bold flex items-center gap-1.5`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isSandboxMode ? 'bg-amber-400' : 'bg-cyan-400'} animate-pulse`} />
            RUMAHBUDGET CONSOLE CLI v1.0
          </span>
          <span className="text-slate-400">ESC to exit • Press Enter to run</span>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-3 px-5 border-b border-white/5 bg-black/20 shrink-0">
          <span className={`font-mono text-lg font-black select-none ${isSandboxMode ? 'text-amber-400' : 'text-cyan-400'}`}>
            &gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-white placeholder-slate-500 font-mono text-base outline-none py-4"
            placeholder="Type /command (e.g. /expense 50000 Groceries)..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
        </div>

        {/* Console Logs / Messages */}
        {(errorMsg || successMsg) && (
          <div className="px-5 py-3 border-b border-white/5 font-mono text-xs shrink-0 select-none">
            {errorMsg && <p className="text-rose-400 font-bold">✖ {errorMsg}</p>}
            {successMsg && <p className="text-lime-400 font-bold">✔ {successMsg}</p>}
          </div>
        )}

        {/* Interactive Prompt Panel */}
        {promptCommand && (
          <div className="p-5 border-b border-white/10 bg-black/50 overflow-y-auto shrink-0">
            <h4 className="text-xs font-black uppercase tracking-wider font-mono text-slate-300 mb-3 flex items-center gap-2">
              <span className={`inline-block w-1.5 h-3 ${isSandboxMode ? 'bg-amber-400' : 'bg-cyan-400'}`} />
              Complete {promptCommand === "/expense" ? "Expense" : "Income"} Entry
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              
              {/* Amount Field */}
              <label className="text-xs font-bold text-slate-400 font-mono">
                Amount (Rp)
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full bg-black/75 border border-white/10 px-3 py-2 text-sm text-white font-mono outline-none focus:border-cyan-300/40"
                  placeholder="Rp 0"
                  value={promptAmount}
                  onChange={(e) => setPromptAmount(e.target.value)}
                />
              </label>

              {/* Account Selector */}
              <label className="text-xs font-bold text-slate-400 font-mono">
                Source/Target Account
                <select
                  className="mt-1 w-full bg-black/75 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  value={promptAccountId}
                  onChange={(e) => setPromptAccountId(e.target.value)}
                >
                  {activeAccounts.length === 0 ? (
                    <option value="">No accounts available</option>
                  ) : (
                    activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountType})
                      </option>
                    ))
                  )}
                </select>
              </label>

              {/* Category / Source Field */}
              {promptCommand === "/expense" ? (
                <label className="text-xs font-bold text-slate-400 font-mono">
                  Category
                  <select
                    className="mt-1 w-full bg-black/75 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                    value={promptCategory}
                    onChange={(e) => setPromptCategory(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="text-xs font-bold text-slate-400 font-mono">
                  Source
                  <input
                    type="text"
                    className="mt-1 w-full bg-black/75 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                    placeholder="Salary, Business, Freelance..."
                    value={promptSource}
                    onChange={(e) => setPromptSource(e.target.value)}
                  />
                </label>
              )}

              {/* Note Field */}
              <label className="text-xs font-bold text-slate-400 font-mono">
                Note
                <input
                  type="text"
                  className="mt-1 w-full bg-black/75 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  placeholder="Optional note"
                  value={promptNote}
                  onChange={(e) => setPromptNote(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-black uppercase bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition disabled:opacity-50"
                disabled={isSubmitting || !promptAmount || (promptCommand === "/expense" ? !promptCategory : !promptSource)}
                onClick={() => {
                  const amt = parseInt(promptAmount.replace(/[^\d]/g, ""), 10);
                  if (promptCommand === "/expense") {
                    submitExpense(amt, promptCategory, promptNote, promptAccountId);
                  } else {
                    submitIncome(amt, promptSource, promptNote, promptAccountId);
                  }
                }}
              >
                {isSubmitting ? "Recording..." : "Submit Transaction"}
              </button>
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold uppercase border border-white/15 hover:bg-white/5 text-slate-300 transition"
                onClick={resetPrompts}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Command Helper List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="select-none">
            <p className="text-[10px] font-bold tracking-wider font-mono text-slate-500 uppercase">
              Available Command Shell Protocols
            </p>
          </div>
          <div className="divide-y divide-white/5 font-mono text-xs">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.name}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 hover:bg-white/[0.02] px-2 cursor-pointer transition"
                onClick={() => {
                  setInputValue(cmd.name + " ");
                  inputRef.current?.focus();
                }}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${isSandboxMode ? 'text-amber-300' : 'text-cyan-300'}`}>
                    {cmd.name}
                  </span>
                  <span className="text-slate-400 text-[11px] font-light">
                    {cmd.description}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 bg-black/30 border border-white/10 px-2 py-0.5 rounded font-bold font-mono self-start sm:self-auto">
                  {cmd.usage}
                </span>
              </div>
            ))}
            {filteredCommands.length === 0 && (
              <div className="py-4 text-center text-slate-500">
                No matching protocols found. Start with / to see options.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 bg-black/40 text-[10px] font-mono text-slate-500 flex justify-between select-none shrink-0">
          <span>CONSOLE PORTAL 9d30756b</span>
          <span>SYSTEM READY</span>
        </div>
      </div>
    </div>
  );
}
