import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Currency, Transaction } from "../types/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { apiErrorMessage } from "../api/client";
import { Card, CardHeader, EmptyState, SecondaryButton, TransactionTypeBadge } from "./ui";

const IS_CREDIT_TYPE: Record<string, boolean> = { allowance: true, interest: true, deposit: true, withdrawal: false };

/** Renders a signed amount from the perspective of `perspectiveAccountId`
 * (the child's account: allowance/interest/deposit credit it, withdrawal
 * debits it). */
export function TransactionTable({
  transactions,
  perspectiveAccountId,
  currency,
  title,
  subtitle,
  onReverse,
}: {
  transactions: Transaction[];
  perspectiveAccountId: number;
  currency: Currency;
  title?: string;
  subtitle?: string;
  /** Present only on parent-facing views: reverses transaction `id`
   * (posts an offsetting entry, then hides both from every listing) and
   * refreshes the caller's data. Omit to hide the action entirely. */
  onReverse?: (id: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [reversingId, setReversingId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  async function handleReverse(id: number) {
    if (!onReverse || reversingId !== null) return;
    if (!window.confirm(t("transactions.reverseConfirm"))) return;
    setReversingId(id);
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await onReverse(id);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: apiErrorMessage(err, t("transactions.reverseError")) }));
    } finally {
      setReversingId(null);
    }
  }

  return (
    <Card>
      <CardHeader title={title ?? t("transactions.defaultTitle")} subtitle={subtitle} />
      {transactions.length === 0 ? (
        <EmptyState>{t("transactions.empty")}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2.5 font-medium">{t("transactions.dateCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("transactions.typeCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("transactions.descriptionCol")}</th>
                <th className="px-5 py-2.5 text-right font-medium">{t("transactions.amountCol")}</th>
                {onReverse && <th className="px-5 py-2.5 text-right font-medium">{t("transactions.actionsCol")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {transactions.map((txn) => {
                const isCredit = IS_CREDIT_TYPE[txn.transaction_type] === (txn.child_account === perspectiveAccountId);
                return (
                  <tr key={txn.id} className="hover:bg-ink-50/60">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-500">{formatDateTime(txn.created_at)}</td>
                    <td className="px-5 py-3">
                      <TransactionTypeBadge type={txn.transaction_type} />
                    </td>
                    <td className="px-5 py-3 text-ink-600">{txn.description || "\u2014"}</td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-mono tabular font-medium ${
                        isCredit ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {isCredit ? "+" : "\u2212"}
                      {formatCurrency(txn.amount, currency)}
                    </td>
                    {onReverse && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <SecondaryButton
                          className="px-2.5 py-1 text-xs"
                          disabled={reversingId !== null}
                          onClick={() => handleReverse(txn.id)}
                        >
                          {reversingId === txn.id ? t("transactions.reversing") : t("transactions.reverseButton")}
                        </SecondaryButton>
                        {rowErrors[txn.id] && <p className="mt-1 max-w-xs text-xs text-red-600">{rowErrors[txn.id]}</p>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
