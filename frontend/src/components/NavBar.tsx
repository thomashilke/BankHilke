import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { SecondaryButton } from "./ui";

export function NavBar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  if (!user) return null;

  const initials = (user.first_name?.[0] ?? user.username[0]).toUpperCase();

  return (
    <header className="border-b border-ink-200 bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/bankhilke-logo-small-cropped.png" alt="" className="h-9 w-auto sm:h-10" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink-900">BankHilke</p>
              <p className="hidden text-xs text-ink-400 sm:block">{t("common.tagline")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="hidden rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-500 sm:inline-block">
              {t(`role.${user.role}`)}
            </span>
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-ink-700 sm:inline">
                {user.first_name || user.username}
              </span>
            </div>
            {user.is_staff && (
              <Link
                to="/admin/users"
                className="inline-flex items-center justify-center rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 sm:px-3.5 sm:py-2 sm:text-sm"
              >
                {t("nav.manageUsers")}
              </Link>
            )}
            <SecondaryButton
              className="px-2.5 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm"
              onClick={() => setShowChangePassword((shown) => !shown)}
            >
              {t("nav.changePassword")}
            </SecondaryButton>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>

        {showChangePassword && (
          <div className="mt-4">
            <ChangePasswordForm onDone={() => setShowChangePassword(false)} />
          </div>
        )}
      </div>
    </header>
  );
}
