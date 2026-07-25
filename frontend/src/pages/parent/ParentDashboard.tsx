import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import { accountsApi, usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { ChildCard } from "../../components/parent/ChildCard";
import { AddChildForm } from "../../components/parent/AddChildForm";
import { AddParentForm } from "../../components/parent/AddParentForm";
import { AdminUserList } from "../../components/parent/AdminUserList";
import { ErrorAlert, EmptyState, PrimaryButton, SecondaryButton, Spinner } from "../../components/ui";

export function ParentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [children, setChildren] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [accountsByOwner, setAccountsByOwner] = useState<Map<number, Account>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, accounts] = await Promise.all([usersApi.list(), accountsApi.list()]);
      setAllUsers(users);
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{t("parent.dashboardTitle")}</h1>
            <p className="mt-1 text-sm text-ink-500">{t("parent.dashboardSubtitle")}</p>
          </div>
          <div className="flex gap-3">
            {user?.is_staff && !showAllUsers && (
              <SecondaryButton onClick={() => setShowAllUsers(true)}>{t("adminUsers.viewButton")}</SecondaryButton>
            )}
            {user?.is_staff && !showAddParent && (
              <SecondaryButton onClick={() => setShowAddParent(true)}>{t("parent.addParentButton")}</SecondaryButton>
            )}
            {!showAddChild && (
              <PrimaryButton onClick={() => setShowAddChild(true)}>{t("parent.addChildButton")}</PrimaryButton>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {showAddParent && (
          <AddParentForm onCreated={() => setShowAddParent(false)} onCancel={() => setShowAddParent(false)} />
        )}

        {showAllUsers && <AdminUserList users={allUsers} onClose={() => setShowAllUsers(false)} />}

        {showAddChild && (
          <AddChildForm
            onCreated={() => {
              setShowAddChild(false);
              load();
            }}
            onCancel={() => setShowAddChild(false)}
          />
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
