import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Account, User } from "../../types/api";
import { formatCurrency } from "../../lib/format";
import { Card } from "../ui";

export function ChildCard({ child, account }: { child: User; account: Account | null }) {
  const { t } = useTranslation();
  const displayName = child.first_name ? `${child.first_name} ${child.last_name}`.trim() : child.username;

  const detailPath = `/parent/children/${child.id}`;

  return (
    <Card className="p-5 transition hover:border-brand-300 hover:shadow-md">
      <Link to={detailPath} className="block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700">
              {displayName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">{displayName}</p>
              <p className="text-xs text-ink-400">@{child.username}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-ink-400">{t("childCard.balanceLabel")}</span>
          <span className="font-mono text-lg font-semibold tabular text-ink-900">
            {account ? formatCurrency(account.balance, account.currency) : "\u2014"}
          </span>
        </div>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`${detailPath}?action=deposit`}
          className="inline-flex items-center justify-center rounded-md bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          {t("childCard.depositAction")}
        </Link>
        <Link
          to={`${detailPath}?action=withdraw`}
          className="inline-flex items-center justify-center rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          {t("childCard.withdrawAction")}
        </Link>
      </div>
    </Card>
  );
}
