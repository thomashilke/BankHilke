import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";

/** Branding + account menu shown on every authenticated page. The avatar
 * opens a small dropdown with exactly two entries -- Settings and Log out --
 * everything else (language, change password, admin user directory, account
 * deletion) lives on the Settings page itself (see pages/SettingsPage.tsx). */
export function NavBar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2.5 transition hover:border-ink-200 hover:bg-ink-50"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("nav.accountMenu")}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">
                  {initials}
                </div>
                <span className="text-sm font-medium text-ink-700">{user.first_name || user.username}</span>
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-md border border-ink-200 bg-paper py-1 shadow-lg shadow-ink-900/[0.08]"
                >
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-sm text-ink-700 transition hover:bg-ink-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      className="h-4 w-4 shrink-0 text-ink-400"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    {t("nav.settings")}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink-700 transition hover:bg-ink-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      className="h-4 w-4 shrink-0 text-ink-400"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0 3.75-3.75M3 12l3.75 3.75" />
                    </svg>
                    {t("nav.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
