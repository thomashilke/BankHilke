import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import { accountsApi, allowanceRulesApi, interestRulesApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Account, AllowanceRule, Currency, InterestRule, Transaction } from "../../types/api";
import { CURRENCY_OPTIONS } from "../../lib/format";
import { NavBar } from "../../components/NavBar";
import { BalanceCard } from "../../components/BalanceCard";
import { TransactionTable } from "../../components/TransactionTable";
import { UpcomingEvents } from "../../components/UpcomingEvents";
import { ErrorAlert, Spinner } from "../../components/ui";

export function ChildDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allowanceRule, setAllowanceRule] = useState<AllowanceRule | null>(null);
  const [interestRule, setInterestRule] = useState<InterestRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencySaving, setCurrencySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const accounts = await accountsApi.list();
        const own = accounts.find((a) => a.owner === user?.id) ?? accounts[0] ?? null;
        if (!own) throw new Error(t("child.noAccount"));

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
        if (!cancelled) setError(apiErrorMessage(err, t("child.loadError")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, t]);

  async function handleCurrencyChange(next: Currency) {
    if (!account || next === account.currency) return;
    setCurrencySaving(true);
    try {
      const updated = await accountsApi.updateCurrency(account.id, next);
      setAccount(updated);
    } catch (err) {
      setError(apiErrorMessage(err, t("child.currencyUpdateError")));
    } finally {
      setCurrencySaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-6 text-xl font-semibold text-ink-900">
          {t("child.welcome", { name: user?.first_name || user?.username })}
        </h1>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading ? (
          <Spinner label={t("child.loadingAccount")} />
        ) : account ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-3">
              <BalanceCard
                label={t("common.currentBalance")}
                balance={account.balance}
                currency={account.currency}
                subtitle={t("child.balanceSubtitle")}
              />
              <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-paper px-4 py-3">
                <label htmlFor="child-currency" className="text-xs font-medium text-ink-500">
                  {t("common.currency")}
                </label>
                <select
                  id="child-currency"
                  value={account.currency}
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
            </div>
            <div className="lg:col-span-2">
              <UpcomingEvents
                allowanceRule={allowanceRule}
                interestRule={interestRule}
                currentBalance={Number.parseFloat(account.balance)}
                currency={account.currency}
              />
            </div>
            <div className="lg:col-span-3">
              <TransactionTable
                transactions={transactions}
                perspectiveAccountId={account.id}
                currency={account.currency}
                subtitle={t("child.transactionsSubtitle")}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
