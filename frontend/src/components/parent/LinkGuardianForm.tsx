import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { guardianshipsApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Guardianship } from "../../types/api";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

export function LinkGuardianForm({
  childId,
  onLinked,
  onCancel,
}: {
  childId: number;
  onLinked: (guardianship: Guardianship) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const guardianship = await guardianshipsApi.create({ child: childId, username });
      onLinked(guardianship);
    } catch (err) {
      setError(apiErrorMessage(err, t("linkGuardian.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title={t("linkGuardian.title")} subtitle={t("linkGuardian.subtitle")} />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <Label>{t("linkGuardian.usernameLabel")}</Label>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("linkGuardian.usernamePlaceholder")}
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <SecondaryButton onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving || !username}>
            {saving ? t("linkGuardian.linking") : t("linkGuardian.submit")}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
