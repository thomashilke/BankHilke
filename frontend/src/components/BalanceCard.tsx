import { formatCurrency } from "../lib/format";

export function BalanceCard({
  label,
  balance,
  subtitle,
}: {
  label: string;
  balance: string;
  subtitle?: string;
}) {
  const isNegative = Number.parseFloat(balance) < 0;
  return (
    <div className="rounded-xl border border-ink-200 bg-gradient-to-br from-ink-900 to-ink-800 p-6 text-white shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-2 font-mono text-4xl font-semibold tabular ${isNegative ? "text-red-400" : "text-white"}`}>
        {formatCurrency(balance)}
      </p>
      {subtitle && <p className="mt-2 text-xs text-ink-400">{subtitle}</p>}
    </div>
  );
}
