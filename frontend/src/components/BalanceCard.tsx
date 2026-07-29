import type { Currency } from "../types/api";
import { formatCurrency } from "../lib/format";

export function BalanceCard({
  label,
  balance,
  currency,
  subtitle,
}: {
  label: string;
  balance: string;
  currency: Currency;
  subtitle?: string;
}) {
  const isNegative = Number.parseFloat(balance) < 0;
  return (
    <div className="rounded-xl border border-ink-200 bg-gradient-to-br from-ink-900 to-ink-800 p-6 text-white shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-2 break-words font-mono text-3xl font-semibold tabular sm:text-4xl ${isNegative ? "text-red-400" : "text-white"}`}>
        {formatCurrency(balance, currency)}
      </p>
      {subtitle && <p className="mt-2 text-xs text-ink-400">{subtitle}</p>}
    </div>
  );
}
