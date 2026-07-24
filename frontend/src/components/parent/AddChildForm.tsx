import { useState, type FormEvent } from "react";
import { usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, SecondaryButton, inputClass } from "../ui";

export function AddChildForm({
  onCreated,
  onCancel,
}: {
  onCreated: (child: User) => void;
  onCancel: () => void;
}) {
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
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
      });
      onCreated(child);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create child account."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title="Add a child" subtitle="Creates a login for your child and links them to your guardianship" />
      <form onSubmit={submit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>First name</Label>
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
            <Label>Last name</Label>
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
          <Label>Username</Label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
            placeholder="e.g. alice"
            disabled={saving}
          />
        </div>

        <div>
          <Label>Email (optional)</Label>
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
            <Label>Password</Label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
              disabled={saving}
            />
          </div>
          <div>
            <Label>Confirm password</Label>
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
            {saving ? "Creating\u2026" : "Create child account"}
          </PrimaryButton>
          <SecondaryButton type="button" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
