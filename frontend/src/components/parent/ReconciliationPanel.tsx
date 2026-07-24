import type { ReconciliationRow } from "../../types/api";
import { formatCurrency } from "../../lib/format";
import { Card, CardHeader, EmptyState } from "../ui";

const SHARE_COLORS = ["bg-brand-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];

export function ReconciliationPanel({ rows }: { rows: ReconciliationRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Guardian contributions" />
        <EmptyState>No transactions posted yet.</EmptyState>
      </Card>
    );
  }

  if (rows.length === 1) {
    return (
      <Card>
        <CardHeader title="Guardian contributions" subtitle="You are the sole guardian for this child" />
        <EmptyState>Shared-guardianship reconciliation appears once a second guardian is linked.</EmptyState>
      </Card>
    );
  }

  const totalGiven = rows.reduce((sum, row) => sum + row.total_given, 0) || 1;

  return (
    <Card>
      <CardHeader
        title="Guardian contributions"
        subtitle="Repartition of deposits, allowance, and interest funding across guardians"
      />
      <div className="px-5 py-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
          {rows.map((row, index) => (
            <div
              key={row.parent_id}
              className={SHARE_COLORS[index % SHARE_COLORS.length]}
              style={{ width: `${(row.total_given / totalGiven) * 100}%` }}
              title={`${row.parent_username}: ${formatCurrency(row.total_given)}`}
            />
          ))}
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 font-medium">Guardian</th>
              <th className="py-2 text-right font-medium">Given</th>
              <th className="py-2 text-right font-medium">Withdrawn</th>
              <th className="py-2 text-right font-medium">Net</th>
              <th className="py-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row, index) => (
              <tr key={row.parent_id}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${SHARE_COLORS[index % SHARE_COLORS.length]}`} />
                    {row.parent_username}
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono tabular text-emerald-600">
                  {formatCurrency(row.total_given)}
                </td>
                <td className="py-2.5 text-right font-mono tabular text-red-600">
                  {formatCurrency(row.total_taken)}
                </td>
                <td className="py-2.5 text-right font-mono tabular font-medium text-ink-900">
                  {formatCurrency(row.net_contribution)}
                </td>
                <td className="py-2.5 text-right text-ink-500">
                  {((row.total_given / totalGiven) * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
