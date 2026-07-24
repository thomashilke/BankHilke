import { Link } from "react-router-dom";
import type { Account, User } from "../../types/api";
import { formatCurrency } from "../../lib/format";
import { Card } from "../ui";

export function ChildCard({ child, account }: { child: User; account: Account | null }) {
  const displayName = child.first_name ? `${child.first_name} ${child.last_name}`.trim() : child.username;

  return (
    <Link to={`/parent/children/${child.id}`} className="block">
      <Card className="p-5 transition hover:border-brand-300 hover:shadow-md">
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
          <span className="text-xs uppercase tracking-wide text-ink-400">Balance</span>
          <span className="font-mono text-lg font-semibold tabular text-ink-900">
            {account ? formatCurrency(account.balance) : "\u2014"}
          </span>
        </div>
        <div className="mt-4 text-right text-xs font-medium text-brand-600">Manage account &rarr;</div>
      </Card>
    </Link>
  );
}
