import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { accountsApi, usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, User } from "../../types/api";
import { isAction } from "../../lib/action";
import { NavBar } from "../../components/NavBar";
import { formatCurrency } from "../../lib/format";
import { Card, EmptyState, ErrorAlert, Spinner } from "../../components/ui";

/** Landing target for the PWA's "Deposit"/"Withdraw" home-screen shortcuts
 * (see public/site.webmanifest `shortcuts`) and any other deposit/withdraw
 * entry point that doesn't already know which child to act on. With a
 * single child it jumps straight to that child's pre-focused deposit or
 * withdraw form; with several it asks which child first. */
export function QuickActionPage() {
  const { t } = useTranslation();
  const { action: actionParam } = useParams<{ action: string }>();
  const [children, setChildren] = useState<User[]>([]);
  const [accountsByOwner, setAccountsByOwner] = useState<Map<number, Account>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, accounts] = await Promise.all([usersApi.list(), accountsApi.list()]);
      setChildren(users.filter((u) => u.role === "child"));
      setAccountsByOwner(new Map(accounts.map((a) => [a.owner, a])));
    } catch (err) {
      setError(apiErrorMessage(err, t("parent.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const actionValue = actionParam ?? null;
  if (!isAction(actionValue)) {
    return <Navigate to="/parent" replace />;
  }
  const action = actionValue;

  if (!loading && children.length === 1) {
    return <Navigate to={`/parent/children/${children[0].id}?action=${action}`} replace />;
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/parent" className="mb-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("childDetail.backLink")}
        </Link>

        <h1 className="mb-1 text-xl font-semibold text-ink-900">
          {t(action === "deposit" ? "quickAction.depositTitle" : "quickAction.withdrawTitle")}
        </h1>
        <p className="mb-6 text-sm text-ink-500">{t("quickAction.subtitle")}</p>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading ? (
          <Spinner label={t("parent.loadingChildren")} />
        ) : children.length === 0 ? (
          <EmptyState>{t("parent.noChildren")}</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              const account = accountsByOwner.get(child.id) ?? null;
              const displayName = child.first_name ? `${child.first_name} ${child.last_name}`.trim() : child.username;
              return (
                <Link key={child.id} to={`/parent/children/${child.id}?action=${action}`} className="block">
                  <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-brand-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700">
                        {displayName[0]?.toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-ink-900">{displayName}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular text-ink-900">
                      {account ? formatCurrency(account.balance, account.currency) : "\u2014"}
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
