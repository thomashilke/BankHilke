import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

export function AddParentForm({
  onCreated,
  onCancel,
}: {
  onCreated: (parent: User) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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
      const parent = await usersApi.registerParent({
        username,
        password,
        email: email || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      onCreated(parent);
    } catch (err) {
      setError(apiErrorMessage(err, t("addParent.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title={t("addParent.title")} subtitle={t("addParent.subtitle")} />
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
            placeholder={t("addParent.usernamePlaceholder")}
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

        <div className="flex gap-3 pt-1">
          <PrimaryButton type="submit" className="flex-1" disabled={saving || !username || !password}>
            {saving ? t("addParent.submitting") : t("addParent.submit")}
          </PrimaryButton>
          <SecondaryButton type="button" className="flex-1" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
