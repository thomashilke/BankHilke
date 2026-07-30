import { useCallback, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { PrimaryButton, Label, inputClass, ErrorAlert } from "../components/ui";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function LoginPage() {
  const { t } = useTranslation();
  const { user, status, login, loginWithGoogle } = useAuth();
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

        <div className="rounded-xl border border-ink-200 bg-paper p-6 shadow-sm shadow-ink-900/[0.02]">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">{t("login.heading")}</h2>

          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit}>
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

          <GoogleSignInSection
            onError={setError}
            loginWithGoogle={loginWithGoogle}
          />
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">{t("login.footnote")}</p>
      </div>
    </div>
  );
}

/** Separated so its own `submitting` state doesn't disable the password
 * form (and vice versa) -- the two sign-in methods are independent. */
function GoogleSignInSection({
  onError,
  loginWithGoogle,
}: {
  onError: (message: string | null) => void;
  loginWithGoogle: (credential: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const handleCredential = useCallback(
    async (credential: string) => {
      onError(null);
      setSubmitting(true);
      try {
        await loginWithGoogle(credential);
      } catch (err) {
        onError(err instanceof Error ? err.message : t("login.googleError"));
      } finally {
        setSubmitting(false);
      }
    },
    [loginWithGoogle, onError, t],
  );

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-100" />
        <span className="text-xs text-ink-400">{t("login.orDivider")}</span>
        <div className="h-px flex-1 bg-ink-100" />
      </div>
      <p className="mb-3 text-center text-xs text-ink-500">{t("login.googleCta")}</p>
      <div className={submitting ? "pointer-events-none opacity-50" : ""}>
        <GoogleSignInButton onCredential={handleCredential} />
      </div>
    </div>
  );
}
