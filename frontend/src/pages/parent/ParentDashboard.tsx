import { useEffect, useState } from "react";
import { accountsApi, usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { ChildCard } from "../../components/parent/ChildCard";
import { ErrorAlert, EmptyState, Spinner } from "../../components/ui";

export function ParentDashboard() {
  const [children, setChildren] = useState<User[]>([]);
  const [accountsByOwner, setAccountsByOwner] = useState<Map<number, Account>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [users, accounts] = await Promise.all([usersApi.list(), accountsApi.list()]);
        if (cancelled) return;
        setChildren(users.filter((u) => u.role === "child"));
        setAccountsByOwner(new Map(accounts.map((a) => [a.owner, a])));
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, "Could not load your children."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-900">Children under your guardianship</h1>
          <p className="mt-1 text-sm text-ink-500">
            Deposit or withdraw funds, manage allowance and interest schedules, and review guardian contributions.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
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
