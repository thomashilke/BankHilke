import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Currency, User } from "../../types/api";
import { CURRENCY_OPTIONS } from "../../lib/format";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

export function AddChildForm({
  onCreated,
  onCancel,
}: {
  onCreated: (child: User) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      const child = await usersApi.registerChild({
        username,
        password,
        email: email || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        currency,
      });
      onCreated(child);
    } catch (err) {
      setError(apiErrorMessage(err, t("addChild.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title={t("addChild.title")} subtitle={t("addChild.subtitle")} />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("common.firstName")}</Label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              disabled={saving}
              autoFocus
            />
          </div>
          <div>
            <Label>{t("common.lastName")}</Label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </div>
        </div>

        <div>
          <Label>{t("common.username")}</Label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
            placeholder={t("addChild.usernamePlaceholder")}
            disabled={saving}
          />
        </div>

        <div>
          <Label>{t("common.emailOptional")}</Label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={saving}
          />
        </div>

        <div>
          <Label>{t("common.currency")}</Label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className={inputClass}
            disabled={saving}
          >
            {CURRENCY_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {`${code} \u2014 ${t(`currencyName.${code}`)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("common.password")}</Label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={t("common.passwordPlaceholder")}
              disabled={saving}
            />
          </div>
          <div>
            <Label>{t("common.confirmPassword")}</Label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <PrimaryButton type="submit" className="flex-1" disabled={saving || !username || !password}>
            {saving ? t("addChild.submitting") : t("addChild.submit")}
          </PrimaryButton>
          <SecondaryButton type="button" className="flex-1" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
