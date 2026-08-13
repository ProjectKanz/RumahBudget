"use client";

import {
  Notice,
  SectionHeader,
  SharpButton,
  SharpInput,
  SharpSelect,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency } from "@/src/lib/format";
import { EXPENSE_CATEGORY_OPTIONS } from "@/src/lib/expense-options";
import type { MoneyAccount } from "@/src/types/money-account";
import type { RecurringCommitment } from "@/src/types/recurring-commitment";
import { FormEvent, useState } from "react";

const commitmentTypes = [
  { label: "Subscription", value: "subscription" },
  { label: "Installment", value: "installment" },
  { label: "Paylater", value: "paylater" },
  { label: "Rent", value: "rent" },
  { label: "Other", value: "other" },
];

const labelClassName = "text-sm font-medium text-slate-300";
type CommitmentType = RecurringCommitment["commitmentType"];

type RecurringCommitmentsProps = {
  commitments: RecurringCommitment[];
  moneyAccounts: MoneyAccount[];
  accountNamesById: Record<string, string>;
  onAddCommitment: (commitment: Omit<RecurringCommitment, "id" | "userId" | "createdAt" | "lastProcessed">) => Promise<boolean>;
  onDeleteCommitment: (id: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
};

export default function RecurringCommitments({
  commitments,
  moneyAccounts,
  accountNamesById,
  onAddCommitment,
  onDeleteCommitment,
  error = "",
  isLoading = false,
}: RecurringCommitmentsProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORY_OPTIONS[0].value);
  const [accountId, setAccountId] = useState("");
  const [commitmentType, setCommitmentType] = useState<CommitmentType>("subscription");
  const [isAutoDeduct, setIsAutoDeduct] = useState(false);
  const [disableReminders, setDisableReminders] = useState(false);

  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedAccountId = moneyAccounts.some((acc) => acc.id === accountId)
    ? accountId
    : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Commitment name is required.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter an amount greater than 0.");
      return;
    }

    const day = Number(dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setFormError("Due day must be a number between 1 and 31.");
      return;
    }

    setIsSaving(true);
    try {
      const success = await onAddCommitment({
        name: name.trim(),
        amount: numericAmount,
        dueDay: day,
        category,
        accountId: selectedAccountId || null,
        commitmentType,
        isAutoDeduct,
        disableReminders,
      });

      if (success) {
        setName("");
        setAmount("");
        setDueDay("");
        setIsAutoDeduct(false);
        setDisableReminders(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add commitment");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-6 pt-5 sm:px-6" id="commitments-section">
      <TerminalPanel className="!p-5 sm:!p-6 border-fuchsia-500/25 bg-black/40">
        <SectionHeader
          description="Register your recurring bills, subscriptions, and financial obligations. Automatically log expenses or get dashboard reminders."
          eyebrow="Recurring Commitments"
          title="Commitment Ledger"
          tone="fuchsia"
        />

        {error ? (
          <Notice className="mt-4" tone="rose">
            {error}
          </Notice>
        ) : null}

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Commitment Name
            <SharpInput
              type="text"
              placeholder="e.g. Spotify Premium, Rent, Car Installment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>

          <label className={labelClassName}>
            Amount
            <SharpInput
              type="number"
              min="0"
              placeholder="Rp 0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>

          <label className={labelClassName}>
            Due Day of Month (1-31)
            <SharpInput
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 15"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>

          <label className={labelClassName}>
            Commitment Type
            <SharpSelect
              value={commitmentType}
              onChange={(e) => setCommitmentType(e.target.value as CommitmentType)}
              disabled={isLoading || isSaving}
            >
              {commitmentTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SharpSelect>
          </label>

          <label className={labelClassName}>
            Category
            <SharpSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading || isSaving}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SharpSelect>
          </label>

          <label className={labelClassName}>
            Linked Account (Optional)
            <SharpSelect
              value={selectedAccountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isLoading || isSaving || moneyAccounts.length === 0}
            >
              <option value="">No linked account (default / cash)</option>
              {moneyAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SharpSelect>
          </label>

          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2 mt-2">
            <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:border-fuchsia-500/30 transition">
              <input
                className="mt-1 h-5 w-5 accent-fuchsia-400"
                type="checkbox"
                checked={isAutoDeduct}
                onChange={(e) => setIsAutoDeduct(e.target.checked)}
                disabled={isLoading || isSaving}
              />
              <span>
                <span className="block font-semibold text-white">Auto-Deduct Execution</span>
                <span className="mt-1 block text-xs text-slate-400">
                  Automatically inserts corresponding expenses on due day without prompt.
                </span>
              </span>
            </label>

            <label className="cockpit-card flex items-start gap-4 border border-white/10 bg-white/[0.03] p-4 cursor-pointer hover:border-fuchsia-500/30 transition">
              <input
                className="mt-1 h-5 w-5 accent-fuchsia-400"
                type="checkbox"
                checked={disableReminders}
                onChange={(e) => setDisableReminders(e.target.checked)}
                disabled={isLoading || isSaving}
              />
              <span>
                <span className="block font-semibold text-white">Mute Reminders</span>
                <span className="mt-1 block text-xs text-slate-400">
                  Hides this commitment from the dashboard Approaches Commitments Radar.
                </span>
              </span>
            </label>
          </div>

          {formError ? (
            <Notice className="sm:col-span-2" tone="rose">
              {formError}
            </Notice>
          ) : null}

          <div className="sm:col-span-2 mt-2">
            <SharpButton
              variant="primary"
              type="submit"
              disabled={isLoading || isSaving}
              className="w-full sm:w-auto border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10"
            >
              {isSaving ? "Registering..." : "Register Commitment"}
            </SharpButton>
          </div>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Active commitments ({commitments.length})
          </h4>

          {commitments.length === 0 ? (
            <div className="mt-4 border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-400">
              No active commitments. Register one above to start tracking.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {commitments.map((commitment) => (
                <div
                  key={commitment.id}
                  className="cockpit-card flex flex-col gap-4 border border-white/10 bg-white/[0.02] p-4 hover:border-fuchsia-500/30 transition md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{commitment.name}</span>
                      <span className="px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider bg-white/10 text-slate-300 rounded">
                        {commitment.commitmentType}
                      </span>
                      {commitment.isAutoDeduct && (
                        <span className="px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider bg-lime-500/10 text-lime-300 border border-lime-500/20 rounded">
                          Auto-Deduct
                        </span>
                      )}
                      {commitment.disableReminders && (
                        <span className="px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded">
                          Muted
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Due: Day {commitment.dueDay} of month</span>
                      <span>Category: {commitment.category}</span>
                      <span>
                        Account:{" "}
                        {commitment.accountId
                          ? accountNamesById[commitment.accountId] ?? "Unknown Account"
                          : "Default / Cash"}
                      </span>
                      {commitment.lastProcessed && (
                        <span className="text-[0.68rem] text-slate-500 font-mono">
                          Last processed: {new Date(commitment.lastProcessed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <span className="text-lg font-black text-white font-mono">
                      {formatCurrency(commitment.amount)}
                    </span>
                    <SharpButton
                      variant="danger"
                      className="!px-3 !py-1 text-xs"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${commitment.name}? This cannot be undone.`,
                          )
                        ) {
                          void onDeleteCommitment(commitment.id);
                        }
                      }}
                    >
                      Delete
                    </SharpButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TerminalPanel>
    </section>
  );
}
