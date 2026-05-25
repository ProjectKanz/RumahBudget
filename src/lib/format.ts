const currencyNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export const hiddenBalanceLabel = "••••••";

export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `Rp ${currencyNumberFormatter.format(safeValue)}`;
}
