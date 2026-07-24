import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "../i18n";
import type { Language } from "../types/api";

/** Lets the signed-in user change their UI language at any time. Switches
 * the interface immediately and, when authenticated, persists the choice to
 * the user's account so it's applied again on their next sign-in. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { updateLanguage } = useAuth();

  return (
    <select
      aria-label={t("nav.language")}
      value={i18n.language}
      onChange={(event) => {
        updateLanguage(event.target.value as Language).catch(() => {
          // Best-effort persistence -- the UI has already switched language;
          // a failed PATCH just means the preference isn't saved server-side.
        });
      }}
      className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm font-medium text-ink-600 shadow-sm outline-none transition hover:border-ink-300 hover:bg-ink-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
