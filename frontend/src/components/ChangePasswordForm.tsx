import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { usersApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "./ui";

/** Self-service password change, available to any signed-in user (parent or
 * child). Requires the current password so a left-open session can't be
 * used to lock the real owner out; never touches another account. */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      await usersApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(apiErrorMessage(err, t("changePassword.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title={t("changePassword.title")} subtitle={t("changePassword.subtitle")} />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t("changePassword.success")}
          </div>
        )}
        <div>
          <Label>{t("changePassword.currentPassword")}</Label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
            disabled={saving}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("changePassword.newPassword")}</Label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={t("common.passwordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </div>
          <div>
            <Label>{t("common.confirmPassword")}</Label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <SecondaryButton type="button" onClick={onDone} disabled={saving}>
            {t("common.cancel")}
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving || !currentPassword || !newPassword}>
            {saving ? t("common.saving") : t("common.saveChanges")}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
