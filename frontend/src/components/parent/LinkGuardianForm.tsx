import { useState, type FormEvent } from "react";
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
      setError(apiErrorMessage(err, "Could not link that guardian."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="Link a guardian"
        subtitle="Grants an existing parent account shared guardianship of this child, so their contributions can be reconciled"
      />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <Label>Parent's username</Label>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. dad"
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <SecondaryButton onClick={onCancel} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving || !username}>
            {saving ? "Linking\u2026" : "Link guardian"}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
