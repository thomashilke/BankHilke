import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { PrimaryButton, Label, inputClass, ErrorAlert } from "../components/ui";

export function LoginPage() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/bankhilke-logo-large-cropped.png"
            alt="BankHilke — Virtual Banking"
            className="w-56 sm:w-64"
          />
          <div className="mt-2 h-px w-16 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-ink-200 bg-paper p-6 shadow-sm shadow-ink-900/[0.02]">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">{t("login.heading")}</h2>

          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} />
            </div>
          )}

          <div className="mb-4">
            <Label>{t("common.username")}</Label>
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
            <Label>{t("common.password")}</Label>
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
            {submitting ? t("login.submitting") : t("login.submit")}
          </PrimaryButton>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">{t("login.footnote")}</p>
      </div>
    </div>
  );
}
