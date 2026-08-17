"use client";

import {
  MetricCell,
  Notice,
  SectionHeader,
  SharpButton,
  SharpInput,
  SharpSelect,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { TradingSummary } from "@/src/lib/trading-calculations";
import { toLocalDateInputValue } from "@/src/lib/transaction-entry";
import type { MoneyAccount } from "@/src/types/money-account";
import { useState, type FormEvent } from "react";

type TradingResultDraft = {
  accountId: string;
  transactionDate: string;
  netAmount: number;
  note: string;
};

type TradingDashboardProps = {
  accounts: MoneyAccount[];
  error: string;
  isBalanceHidden: boolean;
  isLoading: boolean;
  onAddResult: (draft: TradingResultDraft) => Promise<boolean>;
  onDeleteResult: (id: string) => Promise<void> | void;
  periodLabel: string;
  summary: TradingSummary;
};

const activityDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
});

const activityLabels = {
  profit: "Profit",
  loss: "Loss",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
} as const;

function formatMoney(value: number, hidden: boolean) {
  return hidden ? hiddenBalanceLabel : formatCurrency(value);
}

export default function TradingDashboard({
  accounts,
  error,
  isBalanceHidden,
  isLoading,
  onAddResult,
  onDeleteResult,
  periodLabel,
  summary,
}: TradingDashboardProps) {
  const tradingAccounts = accounts.filter(
    (account) => account.purpose === "trading" && !account.isArchived,
  );
  const [accountId, setAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState(() =>
    toLocalDateInputValue(),
  );
  const [netAmount, setNetAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedAccountId =
    accountId || (tradingAccounts.length === 1 ? tradingAccounts[0].id : "");
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(netAmount);
    if (!selectedAccountId || !Number.isFinite(numericAmount) || numericAmount === 0) {
      setFormError("Pilih akun dan isi hasil bersih selain nol.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    const saved = await onAddResult({
      accountId: selectedAccountId,
      transactionDate,
      netAmount: numericAmount,
      note,
    });
    setIsSaving(false);

    if (saved) {
      setNetAmount("");
      setNote("");
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6">
      <SectionHeader
        description="Pisahkan performa trading dari pemasukan dan pengeluaran rumah tangga. Deposit dan withdrawal tetap berasal dari transfer akun."
        eyebrow="Trading ledger"
        title="Trading"
        tone="lime"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCell
          label="Saldo trading saat ini"
          value={formatMoney(summary.currentBalance, isBalanceHidden)}
          description="Saldo akun trading setelah transfer dan hasil sesi."
        />
        <MetricCell
          label={`Net P/L — ${periodLabel}`}
          tone={summary.periodNetResult < 0 ? "rose" : "lime"}
          value={formatMoney(summary.periodNetResult, isBalanceHidden)}
          description="Tidak masuk ke pemasukan atau pengeluaran rumah tangga."
        />
        <MetricCell
          label={`Deposit — ${periodLabel}`}
          value={formatMoney(summary.periodDeposits, isBalanceHidden)}
          description="Diturunkan dari transfer masuk ke akun trading."
        />
        <MetricCell
          label={`Withdrawal — ${periodLabel}`}
          value={formatMoney(summary.periodWithdrawals, isBalanceHidden)}
          description="Diturunkan dari transfer keluar akun trading."
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <TerminalPanel className="!p-5 sm:!p-6">
          <SectionHeader
            description="Masukkan hasil bersih satu hari atau sesi. Angka positif = profit, angka negatif = loss."
            eyebrow="Session result"
            title="Catat hasil sesi"
            tone="amber"
          />

          {tradingAccounts.length === 0 ? (
            <Notice className="mt-5" tone="amber">
              Belum ada akun aktif dengan tujuan Trading. Jalankan migrasi Exness
              sebelum mencatat hasil sesi.
            </Notice>
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <label className="ledger-field-label">
                Akun trading
                <SharpSelect
                  disabled={isLoading || isSaving}
                  value={selectedAccountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {tradingAccounts.length > 1 ? (
                    <option value="">Pilih akun</option>
                  ) : null}
                  {tradingAccounts.map((account, index) => (
                    <option key={account.id} value={account.id}>
                      {isBalanceHidden ? `Akun trading ${index + 1}` : account.name}
                    </option>
                  ))}
                </SharpSelect>
              </label>

              <label className="ledger-field-label">
                Tanggal sesi
                <SharpInput
                  disabled={isLoading || isSaving}
                  required
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                />
              </label>

              <label className="ledger-field-label">
                Hasil bersih
                <SharpInput
                  disabled={isLoading || isSaving}
                  inputMode="decimal"
                  placeholder={isBalanceHidden ? "Nominal disembunyikan" : "Contoh: 250000 atau -100000"}
                  required
                  type={isBalanceHidden ? "password" : "number"}
                  value={netAmount}
                  onChange={(event) => setNetAmount(event.target.value)}
                />
              </label>

              <label className="ledger-field-label">
                Catatan opsional
                <textarea
                  className="ledger-input mt-2 min-h-24 w-full resize-y px-4 py-3 text-sm text-white outline-none"
                  disabled={isLoading || isSaving}
                  maxLength={500}
                  placeholder={isBalanceHidden ? "Catatan disembunyikan" : "Konteks sesi singkat"}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              {formError ? <Notice tone="amber">{formError}</Notice> : null}
              {error ? <Notice tone="rose">{error}</Notice> : null}

              <SharpButton
                disabled={isLoading || isSaving}
                type="submit"
                variant="primary"
              >
                {isSaving ? "Menyimpan..." : "Simpan hasil sesi"}
              </SharpButton>
            </form>
          )}
        </TerminalPanel>

        <TerminalPanel className="!p-0">
          <div className="p-5 sm:p-6">
            <SectionHeader
              description={`Aktivitas Trading pada ${periodLabel}. Transfer hanya ditampilkan, tidak dihitung ulang.`}
              eyebrow="Trading history"
              title="Riwayat Trading"
            />
          </div>

          {isLoading ? (
            <div className="ledger-empty mx-5 mb-5">Memuat aktivitas Trading...</div>
          ) : summary.activities.length === 0 ? (
            <div className="ledger-empty mx-5 mb-5">
              Belum ada hasil sesi, deposit, atau withdrawal pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Jenis</th>
                    <th scope="col">Akun</th>
                    <th scope="col">Catatan</th>
                    <th scope="col">Nominal</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.activities.map((activity) => {
                    const isLossLike =
                      activity.type === "loss" || activity.type === "withdrawal";
                    return (
                      <tr key={activity.id}>
                        <td>{activityDateFormatter.format(new Date(activity.createdAt))}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <StatusChip tone={isLossLike ? "rose" : "lime"}>
                              {activityLabels[activity.type]}
                            </StatusChip>
                            {activity.isMigrated ? (
                              <StatusChip tone="neutral">Migrated from income</StatusChip>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {isBalanceHidden
                            ? "Akun disembunyikan"
                            : accountNames.get(activity.accountId) ?? "Akun trading"}
                        </td>
                        <td>
                          {isBalanceHidden
                            ? "Detail disembunyikan"
                            : activity.note || "—"}
                        </td>
                        <td className={`ledger-table__amount ledger-table__amount--${isLossLike ? "expense" : "income"}`}>
                          {isLossLike ? "-" : "+"}
                          {formatMoney(activity.amount, isBalanceHidden)}
                        </td>
                        <td>
                          {(activity.type === "profit" || activity.type === "loss") &&
                          !activity.isMigrated ? (
                            <SharpButton
                              disabled={isLoading}
                              type="button"
                              variant="danger"
                              onClick={() => onDeleteResult(activity.sourceRecordId)}
                            >
                              Hapus
                            </SharpButton>
                          ) : (
                            <span className="text-xs text-slate-500">Terkunci</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TerminalPanel>
      </div>
    </section>
  );
}
