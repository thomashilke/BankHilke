import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import fr from "./locales/fr";
import de from "./locales/de";
import type { Language } from "../types/api";

export const SUPPORTED_LANGUAGES: Language[] = ["en", "fr", "de"];

// Each language's own name, in that language -- a switcher always shows
// these untranslated so a user can find their language regardless of
// whichever one is currently active.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "Fran\u00e7ais",
  de: "Deutsch",
};

const STORAGE_KEY = "hilkebank.language";

function isSupportedLanguage(value: string | null): value is Language {
  return value !== null && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;
  const browserLanguage = navigator.language.slice(0, 2);
  if (isSupportedLanguage(browserLanguage)) return browserLanguage;
  return "en";
}

export function persistLanguage(language: Language) {
  localStorage.setItem(STORAGE_KEY, language);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: detectInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
