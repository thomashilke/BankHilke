import type { Guardianship, ReconciliationRow } from "../../types/api";
import { formatCurrency } from "../../lib/format";
import { Card, CardHeader, EmptyState } from "../ui";

const SHARE_COLORS = ["bg-brand-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];

function guardianSubtitle(guardians: Guardianship[]) {
  if (guardians.length === 0) return undefined;
  if (guardians.length === 1) return `Sole guardian: ${guardians[0].parent_username}`;
  return `Guardians: ${guardians.map((g) => g.parent_username).join(", ")}`;
}

export function ReconciliationPanel({ rows, guardians }: { rows: ReconciliationRow[]; guardians: Guardianship[] }) {
  const subtitle = guardianSubtitle(guardians);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Guardian contributions" subtitle={subtitle} />
        <EmptyState>No transactions posted yet.</EmptyState>
      </Card>
    );
  }

  if (guardians.length <= 1) {
    return (
      <Card>
        <CardHeader title="Guardian contributions" subtitle={subtitle ?? "You are the sole guardian for this child"} />
        <EmptyState>Shared-guardianship reconciliation appears once a second guardian is linked.</EmptyState>
      </Card>
    );
  }

  const totalGiven = rows.reduce((sum, row) => sum + row.total_given, 0) || 1;

  return (
    <Card>
      <CardHeader
        title="Guardian contributions"
        subtitle={`${subtitle} \u2014 repartition of deposits, allowance, and interest funding`}
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
