import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { transactionsApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Currency, Transaction } from "../../types/api";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

type Action = "deposit" | "withdraw";

export function DepositWithdrawForm({
  accountId,
  currency,
  onPosted,
}: {
  accountId: number;
  currency: Currency;
  onPosted: (transaction: Transaction) => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <Card>
      <CardHeader title={t("deposit.title")} subtitle={t("deposit.subtitle")} />
      <form className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div>
          <Label>{t("deposit.amountLabel", { currency })}</Label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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

        <div className="flex gap-3 pt-1">
          <PrimaryButton
            type="submit"
            className="flex-1"
            disabled={busy || !amount}
            onClick={(e) => submit(e, "deposit")}
          >
            {pending === "deposit" ? t("deposit.depositing") : t("deposit.depositAction")}
          </PrimaryButton>
          <SecondaryButton
            type="submit"
            className="flex-1"
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
