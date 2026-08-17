"use client";

import { NumberValue, SharpButton } from "@/src/components/cockpit-ui";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { DailyAllowanceResult } from "@/src/lib/daily-allowance";
import type { MoneyAccount } from "@/src/types/money-account";

type DailyAllowanceCardProps = {
  accounts: MoneyAccount[];
  isBalanceHidden: boolean;
  isPreferenceLoading: boolean;
  isPreferenceUnsynced: boolean;
  isSandboxMode: boolean;
  onOpenCommitments: () => void;
  onSelectionChange: (accountIds: string[]) => void | Promise<void>;
  result: DailyAllowanceResult;
  selectedAccountIds: string[];
};

function formatMoney(value: number, hidden: boolean) {
  return hidden ? hiddenBalanceLabel : formatCurrency(value);
}

export default function DailyAllowanceCard({
  accounts,
  isBalanceHidden,
  isPreferenceLoading,
  isPreferenceUnsynced,
  isSandboxMode,
  onOpenCommitments,
  onSelectionChange,
  result,
  selectedAccountIds,
}: DailyAllowanceCardProps) {
  function toggleAccount(accountId: string) {
    const nextIds = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter((id) => id !== accountId)
      : [...selectedAccountIds, accountId];
    void onSelectionChange(nextIds);
  }

  const hasValues =
    result.status === "ready" || result.status === "no-disposable-balance";

  return (
    <section
      aria-labelledby="daily-allowance-title"
      className="ledger-check border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ledger-label">Batas pengeluaran harian</p>
          <h2 className="mt-1 text-base font-black text-white" id="daily-allowance-title">
            Sampai gajian tanggal 25
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSandboxMode ? (
            <span className="ledger-state-tag ledger-state-tag--warning">
              Tidak termasuk simulasi
            </span>
          ) : null}
          {isPreferenceUnsynced ? (
            <span className="ledger-state-tag ledger-state-tag--warning">
              Pilihan belum tersinkron
            </span>
          ) : null}
        </div>
      </div>

      {isPreferenceLoading ? (
        <p className="mt-4 text-sm text-slate-400">Memuat pilihan akun…</p>
      ) : result.status === "setup-required" ? (
        <div className="mt-4">
          <p className="text-sm leading-6 text-slate-300">{result.reason}</p>
        </div>
      ) : result.status === "review-required" ? (
        <div className="ledger-notice ledger-notice--warning mt-4 border px-4 py-3">
          <p className="text-sm font-bold text-amber-200">
            Perhitungan perlu ditinjau
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{result.reason}</p>
        </div>
      ) : hasValues ? (
        <>
          <div className="mt-4">
            <p className="ledger-money text-3xl font-black text-lime-200">
              <NumberValue>
                {formatMoney(result.dailyAllowance, isBalanceHidden)}
              </NumberValue>
            </p>
            <p className="mt-1 text-sm text-slate-300">boleh dipakai hari ini</p>
          </div>

          {result.status === "no-disposable-balance" ? (
            <p className="ledger-notice ledger-notice--warning mt-4 border px-3 py-2 text-sm">
              Saldo bebas habis atau seluruhnya sudah disiapkan untuk tagihan.
            </p>
          ) : null}

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Saldo akun hidup</dt>
              <dd className="mt-1 font-bold text-white">
                {formatMoney(result.livingBalance, isBalanceHidden)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Disiapkan untuk tagihan</dt>
              <dd className="mt-1 font-bold text-white">
                {formatMoney(result.reservedCommitments, isBalanceHidden)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Saldo bebas</dt>
              <dd className="mt-1 font-bold text-white">
                {formatMoney(result.disposableBalance, isBalanceHidden)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Sisa periode</dt>
              <dd className="mt-1 font-bold text-white">
                {result.remainingSpendableDays} hari · {result.selectedAccountCount} akun
              </dd>
            </div>
          </dl>
        </>
      ) : null}

      <details className="mt-4 border-t border-white/10 pt-4">
        <summary className="cursor-pointer text-sm font-bold text-lime-200">
          Atur akun kebutuhan hidup
        </summary>
        <div className="mt-3 grid gap-2">
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada akun aktif.</p>
          ) : (
            accounts.map((account) => (
              <label
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border border-white/10 px-3 py-2 text-sm text-slate-200"
                key={account.id}
              >
                <span>
                  <span className="block font-bold">{account.name}</span>
                  <span className="text-xs text-slate-500">{account.accountType}</span>
                </span>
                <input
                  checked={selectedAccountIds.includes(account.id)}
                  disabled={isPreferenceLoading}
                  type="checkbox"
                  onChange={() => toggleAccount(account.id)}
                />
              </label>
            ))
          )}
        </div>
      </details>

      <div className="mt-4">
        <SharpButton className="w-full" type="button" onClick={onOpenCommitments}>
          Lihat komitmen
        </SharpButton>
      </div>
    </section>
  );
}
