import type { Currency, Language } from "../types/api";
import i18n from "../i18n";

// Amounts and dates never change value across locales (display-only, no
// conversion ever happens) -- only the Intl formatter used to render them
// varies with the active UI language, so cache one formatter per
// (locale, currency) pair and re-derive the locale from `i18n.language` on
// every call rather than baking it in at module load.
const LOCALE_MAP: Record<Language, string> = { en: "en-US", fr: "fr-FR", de: "de-DE" };

function resolveLocale(): string {
  return LOCALE_MAP[i18n.language as Language] ?? LOCALE_MAP.en;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: Currency): Intl.NumberFormat {
  const locale = resolveLocale();
  const key = `${locale}:${currency}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateOnlyFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(): Intl.DateTimeFormat {
  const locale = resolveLocale();
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

function getDateOnlyFormatter(): Intl.DateTimeFormat {
  const locale = resolveLocale();
  let formatter = dateOnlyFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    dateOnlyFormatters.set(locale, formatter);
  }
  return formatter;
}

export const CURRENCY_OPTIONS: Currency[] = ["USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD"];

export function formatCurrency(value: string | number, currency: Currency = "USD"): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return getCurrencyFormatter(currency).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(iso: string): string {
  return getDateTimeFormatter().format(new Date(iso));
}

export function formatDate(iso: string): string {
  return getDateOnlyFormatter().format(new Date(iso));
}

// Stable, locale-independent keys (also matches the translation namespace
// `weekday.*`) paired with the backend's 0=Monday..6=Sunday convention.
export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Renders a duration between `now` and `target` as "3d 4h 12m" (or the
 * localized "due now"). `t` is the `useTranslation()` translate function of
 * the calling component. */
export function formatCountdown(target: Date, now: Date, t: (key: string) => string): string {
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return t("countdown.dueNow");

  const totalMinutes = Math.floor(totalMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${t("countdown.day")}`);
  if (days > 0 || hours > 0) parts.push(`${hours}${t("countdown.hour")}`);
  parts.push(`${minutes}${t("countdown.minute")}`);
  return parts.join(" ");
}
