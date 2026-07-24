import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PrimaryButton, Label, inputClass, ErrorAlert } from "../components/ui";

export function LoginPage() {
  const { user, status, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    return <Navigate to={user.role === "parent" ? "/parent" : "/child"} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 font-mono text-lg font-semibold text-white">
            BH
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-ink-900">BankHilke</h1>
            <p className="text-sm text-ink-400">Family allowance banking</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm shadow-ink-900/[0.02]">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Sign in to your account</h2>

          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} />
            </div>
          )}

          <div className="mb-4">
            <Label>Username</Label>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="mb-6">
            <Label>Password</Label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <PrimaryButton type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in\u2026" : "Sign in"}
          </PrimaryButton>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          Parent and child accounts share this sign-in page &mdash; access is scoped by role.
        </p>
      </div>
    </div>
  );
}
