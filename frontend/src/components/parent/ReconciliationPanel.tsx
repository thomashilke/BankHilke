import { useTranslation } from "react-i18next";
import type { Currency, Guardianship, ReconciliationRow } from "../../types/api";
import { formatCurrency } from "../../lib/format";
import { Card, CardHeader, EmptyState } from "../ui";

const SHARE_COLORS = ["bg-brand-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];

export function ReconciliationPanel({
  rows,
  guardians,
  currency,
}: {
  rows: ReconciliationRow[];
  guardians: Guardianship[];
  currency: Currency;
}) {
  const { t } = useTranslation();

  const subtitle =
    guardians.length === 0
      ? undefined
      : guardians.length === 1
        ? t("reconciliation.soleGuardian", { name: guardians[0].parent_username })
        : t("reconciliation.guardiansList", { names: guardians.map((g) => g.parent_username).join(", ") });

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title={t("reconciliation.title")} subtitle={subtitle} />
        <EmptyState>{t("reconciliation.noTransactions")}</EmptyState>
      </Card>
    );
  }

  if (guardians.length <= 1) {
    return (
      <Card>
        <CardHeader title={t("reconciliation.title")} subtitle={subtitle ?? t("reconciliation.soleGuardianFallback")} />
        <EmptyState>{t("reconciliation.sharedAppearsNote")}</EmptyState>
      </Card>
    );
  }

  const totalGiven = rows.reduce((sum, row) => sum + row.total_given, 0) || 1;

  return (
    <Card>
      <CardHeader
        title={t("reconciliation.title")}
        subtitle={t("reconciliation.repartitionSubtitle", { subtitle })}
      />
      <div className="px-5 py-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
          {rows.map((row, index) => (
            <div
              key={row.parent_id}
              className={SHARE_COLORS[index % SHARE_COLORS.length]}
              style={{ width: `${(row.total_given / totalGiven) * 100}%` }}
              title={t("reconciliation.segmentTitle", { name: row.parent_username, amount: formatCurrency(row.total_given, currency) })}
            />
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">{t("reconciliation.guardianCol")}</th>
                <th className="whitespace-nowrap py-2 pl-4 text-right font-medium">{t("reconciliation.givenCol")}</th>
                <th className="whitespace-nowrap py-2 pl-4 text-right font-medium">{t("reconciliation.withdrawnCol")}</th>
                <th className="whitespace-nowrap py-2 pl-4 text-right font-medium">{t("reconciliation.netCol")}</th>
                <th className="whitespace-nowrap py-2 pl-4 text-right font-medium">{t("reconciliation.shareCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row, index) => (
                <tr key={row.parent_id}>
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${SHARE_COLORS[index % SHARE_COLORS.length]}`} />
                      {row.parent_username}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right font-mono tabular text-emerald-600">
                    {formatCurrency(row.total_given, currency)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right font-mono tabular text-red-600">
                    {formatCurrency(row.total_taken, currency)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right font-mono tabular font-medium text-ink-900">
                    {formatCurrency(row.net_contribution, currency)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right text-ink-500">
                    {((row.total_given / totalGiven) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
