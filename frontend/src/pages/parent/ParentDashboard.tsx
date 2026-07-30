import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { accountsApi, usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { ChildCard } from "../../components/parent/ChildCard";
import { ErrorAlert, EmptyState, Spinner } from "../../components/ui";

export function ParentDashboard() {
  const { t } = useTranslation();
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

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-900">{t("parent.dashboardTitle")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("parent.dashboardSubtitle")}</p>
        </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} account={accountsByOwner.get(child.id) ?? null} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
