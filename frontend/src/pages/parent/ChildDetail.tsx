import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import {
  accountsApi,
  allowanceRulesApi,
  guardianshipsApi,
  interestRulesApi,
  usersApi,
} from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, AllowanceRule, Currency, Guardianship, InterestRule, ReconciliationRow, Transaction, User } from "../../types/api";
import { CURRENCY_OPTIONS } from "../../lib/format";
import { NavBar } from "../../components/NavBar";
import { BalanceCard } from "../../components/BalanceCard";
import { TransactionTable } from "../../components/TransactionTable";
import { DepositWithdrawForm } from "../../components/parent/DepositWithdrawForm";
import { isAction } from "../../lib/action";
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
  const { t } = useTranslation();
  const { childId: childIdParam } = useParams<{ childId: string }>();
  const childId = Number(childIdParam);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // One-shot cue captured on mount: arriving via a deposit/withdraw
  // shortcut carries `?action=`, consumed once then scrubbed from the URL
  // below so a later refresh/share doesn't re-trigger the highlight.
  const [initialAction] = useState(() => {
    const raw = searchParams.get("action");
    return isAction(raw) ? raw : null;
  });
  const [state, setState] = useState<ChildState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinkGuardian, setShowLinkGuardian] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);

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
      if (!account) throw new Error(t("childDetail.noAccount"));

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
      setError(apiErrorMessage(err, t("childDetail.loadError")));
    } finally {
      setLoading(false);
    }
  }, [childId, t]);

  async function handleCurrencyChange(next: Currency) {
    if (!state || next === state.account.currency) return;
    setCurrencySaving(true);
    try {
      const updated = await accountsApi.updateCurrency(state.account.id, next);
      setState((prev) => (prev ? { ...prev, account: updated } : prev));
    } catch (err) {
      setError(apiErrorMessage(err, t("childDetail.currencyUpdateError")));
    } finally {
      setCurrencySaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!initialAction) return;
    navigate(`/parent/children/${childId}`, { replace: true });
    // Runs once on mount to strip the one-shot `?action=` param; `navigate`
    // and `childId` are stable for the lifetime of this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/parent" className="mb-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("childDetail.backLink")}
        </Link>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading || !state ? (
          <Spinner label={t("childDetail.loading")} />
        ) : (
          <>
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-ink-900">
                  {state.child.first_name ? `${state.child.first_name} ${state.child.last_name}`.trim() : state.child.username}
                </h1>
                <p className="text-sm text-ink-500">@{state.child.username}</p>
              </div>
              {!showLinkGuardian && (
                <PrimaryButton className="w-full sm:w-auto" onClick={() => setShowLinkGuardian(true)}>
                  {t("childDetail.linkGuardianButton")}
                </PrimaryButton>
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
                <BalanceCard
                  label={t("common.currentBalance")}
                  balance={state.account.balance}
                  currency={state.account.currency}
                />
                <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-paper px-4 py-3">
                  <label htmlFor="child-detail-currency" className="text-xs font-medium text-ink-500">
                    {t("common.currency")}
                  </label>
                  <select
                    id="child-detail-currency"
                    value={state.account.currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
                    disabled={currencySaving}
                    className="ml-auto rounded-md border border-ink-200 bg-paper px-2 py-1 text-xs font-medium text-ink-700 disabled:opacity-50"
                  >
                    {CURRENCY_OPTIONS.map((code) => (
                      <option key={code} value={code}>
                        {`${code} \u2014 ${t(`currencyName.${code}`)}`}
                      </option>
                    ))}
                  </select>
                </div>
                <DepositWithdrawForm
                  accountId={state.account.id}
                  currency={state.account.currency}
                  onPosted={() => load()}
                  initialAction={initialAction}
                />
              </div>

              <div className="space-y-6 lg:col-span-2">
                <ReconciliationPanel rows={state.reconciliation} guardians={state.guardians} currency={state.account.currency} />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <AllowanceRuleEditor
                    childId={childId}
                    currentParentId={user!.id}
                    currency={state.account.currency}
                    guardians={state.reconciliation}
                    rule={state.allowanceRule}
                    onSaved={(rule) => setState((prev) => (prev ? { ...prev, allowanceRule: rule } : prev))}
                  />
                  <InterestRuleEditor
                    childId={childId}
                    currentParentId={user!.id}
                    guardians={state.reconciliation}
                    currency={state.account.currency}
                    currentBalance={Number.parseFloat(state.account.balance)}
                    rule={state.interestRule}
                    onSaved={(rule) => setState((prev) => (prev ? { ...prev, interestRule: rule } : prev))}
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <TransactionTable transactions={state.transactions} perspectiveAccountId={state.account.id} currency={state.account.currency} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
