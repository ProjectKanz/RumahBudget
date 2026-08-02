import { NumberValue, SharpButton, SharpInput } from "@/src/components/cockpit-ui";
import DashboardCharts from "@/src/components/dashboard-charts";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import type { Expense } from "@/src/types/expense";
import type { MoneyAccount } from "@/src/types/money-account";

export type OverviewRecentActivity = {
  id: string;
  accountLabel: string;
  amount: number;
  createdAt: number;
  title: string;
  tone: "income" | "expense" | "transfer";
};

type MonthlyStatus = {
  label: "Safe" | "Warning" | "Critical" | "No income recorded";
  explanation: string;
  className: string;
};

type SignalCheckState = "clear" | "critical" | "watch";

type DecisionCheck = {
  detail: string;
  label: string;
  state: SignalCheckState;
  value: string;
};

type SpendSignal = {
  label: string;
  tone: string;
  description: string;
};

type AppView =
  | "overview"
  | "accounts"
  | "add"
  | "transactions"
  | "reports"
  | "allocation"
  | "sandbox"
  | "settings";

type OverviewDashboardProps = {
  accountBalances: Record<string, number>;
  actionProtocol: string;
  averageMonthlyBurn: number;
  balanceAfterPlannedSpend: number;
  chartHighlightClassName?: string;
  decisionChecks: DecisionCheck[];
  expenses: Expense[];
  highlightClassName?: string;
  isBalanceHidden: boolean;
  isSandboxMode: boolean;
  monthlyStatus: MonthlyStatus;
  moneyAccounts: MoneyAccount[];
  netHourlyWage: number;
  onOpenQuickAdd: (tab: "income" | "expense" | "transfer") => void;
  onOpenView: (view: AppView) => void;
  onToggleBalanceVisibility: () => void;
  plannedSpend: string;
  projectedMonthlyExpenses: number;
  projectedNetCashflow: number;
  projectedRunwayDays: number | null;
  recentActivity: OverviewRecentActivity[];
  remainingBalance: number;
  safePlannedSpendAmount: number;
  setPlannedSpend: (value: string) => void;
  spendGaugePercent: number;
  spendSignal: SpendSignal;
  survivalRunwayMonths: number;
  totalBalance: number;
  totalExpense: number;
  totalIncome: number;
};

const activityDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusClasses: Record<MonthlyStatus["label"], string> = {
  Critical: "ledger-state-tag ledger-state-tag--danger",
  Safe: "ledger-state-tag ledger-state-tag--positive",
  Warning: "ledger-state-tag ledger-state-tag--warning",
  "No income recorded": "ledger-state-tag",
};

const checkClasses: Record<SignalCheckState, string> = {
  clear: "ledger-state-tag ledger-state-tag--positive",
  critical: "ledger-state-tag ledger-state-tag--danger",
  watch: "ledger-state-tag ledger-state-tag--warning",
};

function formatMoney(value: number, hidden: boolean) {
  return hidden ? hiddenBalanceLabel : formatCurrency(value);
}

function formatRunway(months: number) {
  if (!Number.isFinite(months) || months === Infinity) {
    return "Tanpa batas";
  }

  return `${months.toFixed(1)} bulan`;
}

function getActivityLabel(tone: OverviewRecentActivity["tone"]) {
  if (tone === "income") {
    return "Pemasukan";
  }

  if (tone === "expense") {
    return "Pengeluaran";
  }

  return "Transfer";
}

export default function OverviewDashboard({
  accountBalances,
  actionProtocol,
  averageMonthlyBurn,
  balanceAfterPlannedSpend,
  chartHighlightClassName = "",
  decisionChecks,
  expenses,
  highlightClassName = "",
  isBalanceHidden,
  isSandboxMode,
  monthlyStatus,
  moneyAccounts,
  netHourlyWage,
  onOpenQuickAdd,
  onOpenView,
  onToggleBalanceVisibility,
  plannedSpend,
  projectedMonthlyExpenses,
  projectedNetCashflow,
  projectedRunwayDays,
  recentActivity,
  remainingBalance,
  safePlannedSpendAmount,
  setPlannedSpend,
  spendGaugePercent,
  spendSignal,
  survivalRunwayMonths,
  totalBalance,
  totalExpense,
  totalIncome,
}: OverviewDashboardProps) {
  const accountCount =
    Object.keys(accountBalances).length || moneyAccounts.length;
  const monthlyLifeEnergy = isBalanceHidden
    ? hiddenBalanceLabel
    : netHourlyWage > 0
      ? `${(totalExpense / netHourlyWage).toFixed(1)} jam`
      : "—";
  const runwayLabel = isBalanceHidden
    ? hiddenBalanceLabel
    : formatRunway(survivalRunwayMonths);

  return (
    <section
      aria-labelledby="overview-title"
      className={`mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 ${highlightClassName}`}
      id="overview"
    >
      <div className="rb-vault-split">
        <aside className="rb-vault-spine">
          <header className="rb-vault-spine__header">
            <p className="ledger-eyebrow">Vault spine</p>
            <h1
              className="ledger-page-title"
              id="overview-title"
              tabIndex={-1}
            >
              Ringkasan keuangan
            </h1>
          </header>

          <div className="rb-vault-spine__balance">
            <p className="ledger-label">Saldo total</p>
            <p className="ledger-money ledger-money--hero">
              <NumberValue>
                {formatMoney(totalBalance, isBalanceHidden)}
              </NumberValue>
            </p>
            <div className="rb-vault-spine__status">
              <span className={statusClasses[monthlyStatus.label]}>
                {monthlyStatus.label}
              </span>
              <p>{monthlyStatus.explanation}</p>
            </div>
          </div>

          <dl className="rb-vault-spine__metrics">
            <div>
              <dt>Arus bersih bulan ini</dt>
              <dd
                className={
                  remainingBalance < 0
                    ? "ledger-money--expense"
                    : "ledger-money--income"
                }
              >
                <NumberValue>
                  {formatMoney(remainingBalance, isBalanceHidden)}
                </NumberValue>
              </dd>
            </div>
            <div>
              <dt>Runway</dt>
              <dd>{runwayLabel}</dd>
            </div>
            <div>
              <dt>Rata-rata pengeluaran</dt>
              <dd>{formatMoney(averageMonthlyBurn, isBalanceHidden)}</dd>
            </div>
            <div>
              <dt>Energi hidup bulan ini</dt>
              <dd>{monthlyLifeEnergy}</dd>
            </div>
            <div>
              <dt>Akun aktif</dt>
              <dd>{accountCount}</dd>
            </div>
            <div>
              <dt>Privasi</dt>
              <dd>{isBalanceHidden ? "Aktif" : "Nonaktif"}</dd>
            </div>
            <div>
              <dt>Mode data</dt>
              <dd>{isSandboxMode ? "Sandbox aktif" : "Ledger asli"}</dd>
            </div>
          </dl>

          <div className="rb-vault-spine__actions">
            <button
              aria-pressed={isBalanceHidden}
              className="ledger-button ledger-button--secondary"
              type="button"
              onClick={onToggleBalanceVisibility}
            >
              {isBalanceHidden ? "Tampilkan nominal" : "Sembunyikan nominal"}
            </button>
            <button
              className="ledger-button ledger-button--primary"
              type="button"
              onClick={() => onOpenQuickAdd("expense")}
            >
              Catat transaksi
            </button>
          </div>
        </aside>

        <DashboardCharts
          accountBalances={accountBalances}
          expenses={expenses}
          highlightClassName={chartHighlightClassName}
          isBalanceHidden={isBalanceHidden}
          moneyAccounts={moneyAccounts}
          remainingBalance={remainingBalance}
          totalExpense={totalExpense}
          totalIncome={totalIncome}
        />

        <article className="rb-vault-ledger">
          <div className="ledger-panel__header rb-vault-ledger__header">
            <div>
              <p className="ledger-eyebrow">Aktivitas</p>
              <h2 className="ledger-section-title">Transaksi terbaru</h2>
            </div>
            <button
              className="ledger-link"
              type="button"
              onClick={() => onOpenView("transactions")}
            >
              Lihat semua transaksi
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="ledger-empty">
              Belum ada transaksi. Catat pemasukan, pengeluaran, atau transfer
              pertama Anda.
            </div>
          ) : (
            <>
              <div
                aria-label="Transaksi terbaru"
                className="ledger-scroll-region hidden sm:block"
                role="region"
                tabIndex={0}
              >
                <table className="ledger-table">
                  <caption className="sr-only">
                    Lima aktivitas uang terbaru
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Deskripsi</th>
                      <th scope="col">Jenis</th>
                      <th scope="col">Akun</th>
                      <th scope="col">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity) => (
                      <tr key={activity.id}>
                        <td>
                          {activityDateFormatter.format(
                            new Date(activity.createdAt),
                          )}
                        </td>
                        <td className="font-semibold text-white">
                          {activity.title}
                        </td>
                        <td>{getActivityLabel(activity.tone)}</td>
                        <td>{activity.accountLabel}</td>
                        <td
                          className={`ledger-table__amount ledger-table__amount--${activity.tone}`}
                        >
                          <NumberValue>
                            {activity.tone === "expense" ? "-" : ""}
                            {formatMoney(activity.amount, isBalanceHidden)}
                          </NumberValue>
                          {!isBalanceHidden &&
                          activity.tone === "expense" &&
                          netHourlyWage > 0 ? (
                            <small>
                              {(activity.amount / netHourlyWage).toFixed(1)} jam
                            </small>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/10 sm:hidden">
                {recentActivity.map((activity) => (
                  <article
                    className="ledger-mobile-transaction"
                    key={activity.id}
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {activity.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {getActivityLabel(activity.tone)} ·{" "}
                        {activity.accountLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {activityDateFormatter.format(
                          new Date(activity.createdAt),
                        )}
                      </p>
                    </div>
                    <p
                      className={`ledger-table__amount ledger-table__amount--${activity.tone}`}
                    >
                      <NumberValue>
                        {activity.tone === "expense" ? "-" : ""}
                        {formatMoney(activity.amount, isBalanceHidden)}
                      </NumberValue>
                      {!isBalanceHidden &&
                      activity.tone === "expense" &&
                      netHourlyWage > 0 ? (
                        <small>
                          {(activity.amount / netHourlyWage).toFixed(1)} jam
                        </small>
                      ) : null}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </article>
      </div>

      <section
        aria-labelledby="planning-workbench-title"
        className="rb-planning-workbench"
      >
        <div className="rb-planning-workbench__planner">
          <div className="ledger-panel__header">
            <div>
              <p className="ledger-eyebrow">Periksa rencana</p>
              <h2
                className="ledger-section-title"
                id="planning-workbench-title"
              >
                Apakah pengeluaran ini muat?
              </h2>
            </div>
            <span className="ledger-percentage">
              {isBalanceHidden ? "—" : `${spendGaugePercent}%`}
            </span>
          </div>

          <label className="ledger-field-label">
            Nominal rencana
            <SharpInput
              aria-label={
                isBalanceHidden
                  ? "Nominal rencana, nilai disamarkan"
                  : "Nominal rencana"
              }
              autoComplete="off"
              inputMode="numeric"
              min="0"
              placeholder={
                isBalanceHidden ? "Nominal disembunyikan" : "250000"
              }
              type={isBalanceHidden ? "password" : "number"}
              value={plannedSpend}
              onChange={(event) => setPlannedSpend(event.target.value)}
            />
          </label>

          <div className="rb-planning-workbench__presets">
            {[100000, 250000, 500000].map((amount) => (
              <SharpButton
                className="px-2 text-xs"
                key={amount}
                type="button"
                onClick={() => setPlannedSpend(String(amount))}
              >
                {formatCurrency(amount)}
              </SharpButton>
            ))}
          </div>

          <div className="ledger-projection-grid">
            <div>
              <span>Nominal rencana</span>
              <strong>
                {formatMoney(safePlannedSpendAmount, isBalanceHidden)}
              </strong>
            </div>
            <div>
              <span>Saldo setelahnya</span>
              <strong>
                {formatMoney(balanceAfterPlannedSpend, isBalanceHidden)}
              </strong>
            </div>
            <div>
              <span>Pengeluaran setelahnya</span>
              <strong>
                {formatMoney(projectedMonthlyExpenses, isBalanceHidden)}
              </strong>
            </div>
            <div>
              <span>Selisih setelahnya</span>
              <strong>
                {formatMoney(projectedNetCashflow, isBalanceHidden)}
              </strong>
            </div>
            <div>
              <span>Runway setelahnya</span>
              <strong>
                {projectedRunwayDays === null
                  ? "Tanpa pengeluaran"
                  : isBalanceHidden
                    ? hiddenBalanceLabel
                    : `${projectedRunwayDays} hari`}
              </strong>
            </div>
          </div>
        </div>

        <div className="rb-planning-workbench__signal">
          <p className="ledger-eyebrow">Sinyal pengeluaran</p>
          <h2
            className={`ledger-section-title rb-spend-signal-heading ${spendSignal.tone}`}
          >
            {spendSignal.label}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {spendSignal.description}
          </p>
          <p className="ledger-action-copy mt-3 pl-3 text-sm leading-6 text-slate-400">
            {actionProtocol}
          </p>

          <div className="rb-planning-workbench__checks">
            {decisionChecks.map((check) => (
              <div className="ledger-check" key={check.label}>
                <span className={checkClasses[check.state]}>{check.label}</span>
                <strong>
                  {isBalanceHidden ? hiddenBalanceLabel : check.value}
                </strong>
                <p>
                  {isBalanceHidden
                    ? "Detail disembunyikan saat privasi aktif."
                    : check.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rb-planning-workbench__actions">
            <button
              className="ledger-button ledger-button--primary"
              type="button"
              onClick={() => onOpenQuickAdd("expense")}
            >
              Catat pengeluaran
            </button>
            <button
              className="ledger-button ledger-button--secondary"
              type="button"
              onClick={() => onOpenQuickAdd("income")}
            >
              Catat pemasukan
            </button>
            <button
              className="ledger-button ledger-button--secondary"
              type="button"
              onClick={() => onOpenQuickAdd("transfer")}
            >
              Transfer
            </button>
            <button
              className="ledger-button ledger-button--secondary"
              type="button"
              onClick={() => onOpenView("allocation")}
            >
              Buka alokasi
            </button>
            <button
              className="ledger-button ledger-button--secondary"
              type="button"
              onClick={() => onOpenView("reports")}
            >
              Buka laporan
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
