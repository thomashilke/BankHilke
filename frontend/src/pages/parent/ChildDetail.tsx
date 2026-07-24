import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import {
  accountsApi,
  allowanceRulesApi,
  guardianshipsApi,
  interestRulesApi,
  usersApi,
} from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, AllowanceRule, Guardianship, InterestRule, ReconciliationRow, Transaction, User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { BalanceCard } from "../../components/BalanceCard";
import { TransactionTable } from "../../components/TransactionTable";
import { DepositWithdrawForm } from "../../components/parent/DepositWithdrawForm";
import { AllowanceRuleEditor } from "../../components/parent/AllowanceRuleEditor";
import { InterestRuleEditor } from "../../components/parent/InterestRuleEditor";
import { ReconciliationPanel } from "../../components/parent/ReconciliationPanel";
import { LinkGuardianForm } from "../../components/parent/LinkGuardianForm";
import { ErrorAlert, PrimaryButton, Spinner } from "../../components/ui";

interface ChildState {
  child: User;
  account: Account;
  transactions: Transaction[];
  reconciliation: ReconciliationRow[];
  guardians: Guardianship[];
  allowanceRule: AllowanceRule | null;
  interestRule: InterestRule | null;
}

export function ChildDetail() {
  const { childId: childIdParam } = useParams<{ childId: string }>();
  const childId = Number(childIdParam);
  const { user } = useAuth();
  const [state, setState] = useState<ChildState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinkGuardian, setShowLinkGuardian] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [child, accounts, allowanceRules, interestRules] = await Promise.all([
        usersApi.me(childId),
        accountsApi.list(),
        allowanceRulesApi.list(),
        interestRulesApi.list(),
      ]);
      const account = accounts.find((a) => a.owner === childId);
      if (!account) throw new Error("No account found for this child.");

      const [transactions, reconciliation, guardians] = await Promise.all([
        accountsApi.history(account.id),
        accountsApi.reconciliation(account.id),
        guardianshipsApi.listForChild(childId),
      ]);

      setState({
        child,
        account,
        transactions,
        reconciliation,
        guardians,
        allowanceRule: allowanceRules.find((r) => r.child === childId) ?? null,
        interestRule: interestRules.find((r) => r.child === childId) ?? null,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load this child's account."));
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/parent" className="mb-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          &larr; All children
        </Link>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading || !state ? (
          <Spinner label="Loading account" />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-ink-900">
                  {state.child.first_name ? `${state.child.first_name} ${state.child.last_name}`.trim() : state.child.username}
                </h1>
                <p className="text-sm text-ink-500">@{state.child.username}</p>
              </div>
              {!showLinkGuardian && (
                <PrimaryButton onClick={() => setShowLinkGuardian(true)}>+ Link guardian</PrimaryButton>
              )}
            </div>

            {showLinkGuardian && (
              <LinkGuardianForm
                childId={childId}
                onLinked={() => {
                  setShowLinkGuardian(false);
                  load();
                }}
                onCancel={() => setShowLinkGuardian(false)}
              />
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-1">
                <BalanceCard label="Current balance" balance={state.account.balance} />
                <DepositWithdrawForm
                  accountId={state.account.id}
                  onPosted={() => load()}
                />
              </div>

              <div className="space-y-6 lg:col-span-2">
                <ReconciliationPanel rows={state.reconciliation} guardians={state.guardians} />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <AllowanceRuleEditor
                    childId={childId}
                    currentParentId={user!.id}
                    guardians={state.reconciliation}
                    rule={state.allowanceRule}
                    onSaved={(rule) => setState((prev) => (prev ? { ...prev, allowanceRule: rule } : prev))}
                  />
                  <InterestRuleEditor
                    childId={childId}
                    currentParentId={user!.id}
                    guardians={state.reconciliation}
                    rule={state.interestRule}
                    onSaved={(rule) => setState((prev) => (prev ? { ...prev, interestRule: rule } : prev))}
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <TransactionTable transactions={state.transactions} perspectiveAccountId={state.account.id} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
