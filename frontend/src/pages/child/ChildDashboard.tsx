import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { accountsApi, allowanceRulesApi, interestRulesApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, AllowanceRule, InterestRule, Transaction } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { BalanceCard } from "../../components/BalanceCard";
import { TransactionTable } from "../../components/TransactionTable";
import { UpcomingEvents } from "../../components/UpcomingEvents";
import { ErrorAlert, Spinner } from "../../components/ui";

export function ChildDashboard() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allowanceRule, setAllowanceRule] = useState<AllowanceRule | null>(null);
  const [interestRule, setInterestRule] = useState<InterestRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const accounts = await accountsApi.list();
        const own = accounts.find((a) => a.owner === user?.id) ?? accounts[0] ?? null;
        if (!own) throw new Error("No account found for this user.");

        const [history, allowanceRules, interestRules] = await Promise.all([
          accountsApi.history(own.id),
          allowanceRulesApi.list(),
          interestRulesApi.list(),
        ]);

        if (cancelled) return;
        setAccount(own);
        setTransactions(history);
        setAllowanceRule(allowanceRules[0] ?? null);
        setInterestRule(interestRules[0] ?? null);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, "Could not load your account."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-ink-900">
          Welcome back, {user?.first_name || user?.username}
        </h1>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading ? (
          <Spinner label="Loading your account" />
        ) : account ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <BalanceCard
                label="Current balance"
                balance={account.balance}
                subtitle="Money you can save or spend"
              />
            </div>
            <div className="lg:col-span-2">
              <UpcomingEvents
                allowanceRule={allowanceRule}
                interestRule={interestRule}
                currentBalance={Number.parseFloat(account.balance)}
              />
            </div>
            <div className="lg:col-span-3">
              <TransactionTable
                transactions={transactions}
                perspectiveAccountId={account.id}
                subtitle="Everything credited or debited to your account"
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
