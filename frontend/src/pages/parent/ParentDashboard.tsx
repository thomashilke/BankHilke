import { useCallback, useEffect, useState } from "react";
import { accountsApi, usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { ChildCard } from "../../components/parent/ChildCard";
import { AddChildForm } from "../../components/parent/AddChildForm";
import { ErrorAlert, EmptyState, PrimaryButton, Spinner } from "../../components/ui";

export function ParentDashboard() {
  const [children, setChildren] = useState<User[]>([]);
  const [accountsByOwner, setAccountsByOwner] = useState<Map<number, Account>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, accounts] = await Promise.all([usersApi.list(), accountsApi.list()]);
      setChildren(users.filter((u) => u.role === "child"));
      setAccountsByOwner(new Map(accounts.map((a) => [a.owner, a])));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load your children."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">Children under your guardianship</h1>
            <p className="mt-1 text-sm text-ink-500">
              Deposit or withdraw funds, manage allowance and interest schedules, and review guardian contributions.
            </p>
          </div>
          {!showAddChild && <PrimaryButton onClick={() => setShowAddChild(true)}>+ Add child</PrimaryButton>}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

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
          <Spinner label="Loading children" />
        ) : children.length === 0 ? (
          <EmptyState>No children are linked to your account yet.</EmptyState>
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
