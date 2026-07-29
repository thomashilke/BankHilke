import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { transactionsApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Currency, Transaction } from "../../types/api";
import type { Action } from "../../lib/action";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

/** id targeted by callers (e.g. ChildDetail) to scroll this card into view. */
export const DEPOSIT_WITHDRAW_FORM_ID = "deposit-withdraw-form";

export function DepositWithdrawForm({
  accountId,
  currency,
  onPosted,
  initialAction = null,
}: {
  accountId: number;
  currency: Currency;
  onPosted: (transaction: Transaction) => void;
  /** Set when arriving via a deposit/withdraw shortcut: scrolls the form into
   * view, focuses the amount field, and briefly highlights the matching
   * action button so the intent carries through without extra taps. */
  initialAction?: Action | null;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Action | null>(initialAction);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialAction) return;
    document.getElementById(DEPOSIT_WITHDRAW_FORM_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
    amountInputRef.current?.focus();
    const timeout = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(timeout);
    // Only ever run once, on mount -- `initialAction` is a one-shot cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent, action: Action) {
    event.preventDefault();
    setError(null);
    setPending(action);
    try {
      const fn = action === "deposit" ? transactionsApi.deposit : transactionsApi.withdraw;
      const transaction = await fn({ child_account: accountId, amount, description });
      onPosted(transaction);
      setAmount("");
      setDescription("");
    } catch (err) {
      setError(apiErrorMessage(err, t(action === "deposit" ? "deposit.depositError" : "deposit.withdrawError")));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <Card id={DEPOSIT_WITHDRAW_FORM_ID} className={highlight ? "ring-2 ring-offset-2 ring-brand-400 transition" : ""}>
      <CardHeader title={t("deposit.title")} subtitle={t("deposit.subtitle")} />
      <form className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div>
          <Label>{t("deposit.amountLabel", { currency })}</Label>
          <input
            ref={amountInputRef}
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setHighlight(null);
            }}
            className={inputClass}
            placeholder="0.00"
            disabled={busy}
          />
        </div>

        <div>
          <Label>{t("common.descriptionOptional")}</Label>
          <input
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder={t("deposit.descriptionPlaceholder")}
            disabled={busy}
          />
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <PrimaryButton
            type="submit"
            className={`flex-1 ${highlight === "deposit" ? "ring-2 ring-offset-2 ring-brand-400" : ""}`}
            disabled={busy || !amount}
            onClick={(e) => submit(e, "deposit")}
          >
            {pending === "deposit" ? t("deposit.depositing") : t("deposit.depositAction")}
          </PrimaryButton>
          <SecondaryButton
            type="submit"
            className={`flex-1 ${highlight === "withdraw" ? "ring-2 ring-offset-2 ring-amber-400" : ""}`}
            disabled={busy || !amount}
            onClick={(e) => submit(e, "withdraw")}
          >
            {pending === "withdraw" ? t("deposit.withdrawing") : t("deposit.withdrawAction")}
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
