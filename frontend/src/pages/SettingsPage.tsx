import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { guardianshipsApi, usersApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import type { Guardianship } from "../types/api";
import { NavBar } from "../components/NavBar";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { AddChildForm } from "../components/parent/AddChildForm";
import { Card, CardHeader, ErrorAlert, PrimaryButton, SecondaryButton } from "../components/ui";

/** Regroups every account-level control (language, creating a new child,
 * change password, sign out, the admin user directory) plus the destructive
 * operations this app exposes: self-service parent account deletion, and
 * (parent-only) deleting or unlinking from a child's account. Children can
 * never delete any account -- see the parent-only guards below and
 * CanDeleteAccount on the backend. Reachable via the "Settings" entry in
 * NavBar's account menu. */
export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [guardianships, setGuardianships] = useState<Guardianship[]>([]);
  const [actingGuardianshipId, setActingGuardianshipId] = useState<number | null>(null);
  const [childActionError, setChildActionError] = useState<string | null>(null);

  const isParent = user?.role === "parent";

  useEffect(() => {
    if (!isParent) return;
    let cancelled = false;
    guardianshipsApi
      .list()
      .then((rows) => {
        if (!cancelled) setGuardianships(rows);
      })
      .catch(() => {
        // Non-critical for the rest of the page; the danger zone simply
        // shows no children if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [isParent]);

  if (!user) return null;

  const homePath = user.role === "parent" ? "/parent" : "/child";

  async function handleDeleteAccount() {
    if (!user || deleting) return;
    if (!window.confirm(t("settings.deleteAccountConfirm"))) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.deleteAccount(user.id);
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteError(apiErrorMessage(err, t("settings.deleteAccountError")));
      setDeleting(false);
    }
  }

  async function handleDeleteChild(guardianship: Guardianship) {
    if (actingGuardianshipId) return;
    if (!window.confirm(t("settings.deleteChildConfirm", { name: guardianship.child_username }))) return;
    setActingGuardianshipId(guardianship.id);
    setChildActionError(null);
    try {
      await usersApi.deleteAccount(guardianship.child);
      setGuardianships((prev) => prev.filter((row) => row.id !== guardianship.id));
    } catch (err) {
      setChildActionError(apiErrorMessage(err, t("settings.deleteChildError")));
    } finally {
      setActingGuardianshipId(null);
    }
  }

  async function handleRemoveGuardianship(guardianship: Guardianship) {
    if (actingGuardianshipId) return;
    if (!window.confirm(t("settings.removeGuardianConfirm", { name: guardianship.child_username }))) return;
    setActingGuardianshipId(guardianship.id);
    setChildActionError(null);
    try {
      await guardianshipsApi.remove(guardianship.id);
      setGuardianships((prev) => prev.filter((row) => row.id !== guardianship.id));
    } catch (err) {
      setChildActionError(apiErrorMessage(err, t("settings.removeGuardianError")));
    } finally {
      setActingGuardianshipId(null);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to={homePath} className="mb-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("settings.backLink")}
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-900">{t("settings.pageTitle")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("settings.pageSubtitle")}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("nav.language")} subtitle={t("settings.languageSubtitle")} />
            <div className="px-5 py-4">
              <LanguageSwitcher />
            </div>
          </Card>

          {user.role === "parent" &&
            (showAddChild ? (
              <AddChildForm
                onCreated={() => {
                  setShowAddChild(false);
                  navigate(homePath);
                }}
                onCancel={() => setShowAddChild(false)}
              />
            ) : (
              <Card>
                <CardHeader title={t("settings.addChildTitle")} subtitle={t("settings.addChildSubtitle")} />
                <div className="px-5 py-4">
                  <PrimaryButton onClick={() => setShowAddChild(true)}>{t("parent.addChildButton")}</PrimaryButton>
                </div>
              </Card>
            ))}

          {user.is_staff && (
            <Card>
              <CardHeader title={t("nav.manageUsers")} subtitle={t("settings.manageUsersSubtitle")} />
              <div className="px-5 py-4">
                <Link
                  to="/admin/users"
                  className="inline-flex items-center justify-center rounded-md border border-ink-200 px-3.5 py-2 text-sm font-medium text-ink-700 transition hover:border-ink-300 hover:bg-ink-50"
                >
                  {t("settings.manageUsersLink")}
                </Link>
              </div>
            </Card>
          )}

          {user.has_usable_password &&
            (showChangePassword ? (
              <ChangePasswordForm onDone={() => setShowChangePassword(false)} />
            ) : (
              <Card>
                <CardHeader title={t("nav.changePassword")} subtitle={t("changePassword.subtitle")} />
                <div className="px-5 py-4">
                  <SecondaryButton onClick={() => setShowChangePassword(true)}>
                    {t("nav.changePassword")}
                  </SecondaryButton>
                </div>
              </Card>
            ))}

          {isParent && (
            <Card className="border-red-200">
              <CardHeader title={t("settings.dangerTitle")} subtitle={t("settings.dangerSubtitle")} />
              <div className="space-y-3 px-5 py-4">
                {deleteError && <ErrorAlert message={deleteError} />}
                <PrimaryButton
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? t("settings.deletingAccount") : t("settings.deleteAccountButton")}
                </PrimaryButton>
              </div>

              {guardianships.length > 0 && (
                <div className="space-y-3 border-t border-red-100 px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">{t("settings.childAccountsTitle")}</h3>
                    <p className="mt-0.5 text-xs text-ink-500">{t("settings.childAccountsSubtitle")}</p>
                  </div>
                  {childActionError && <ErrorAlert message={childActionError} />}
                  <ul className="space-y-2">
                    {guardianships.map((guardianship) => {
                      const acting = actingGuardianshipId === guardianship.id;
                      return (
                        <li
                          key={guardianship.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-red-100 bg-red-50/40 px-3 py-2"
                        >
                          <span className="text-sm font-medium text-ink-800">{guardianship.child_username}</span>
                          {guardianship.is_creator ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteChild(guardianship)}
                              disabled={acting}
                              className="inline-flex shrink-0 items-center justify-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {acting ? t("settings.deletingAccount") : t("settings.deleteChildButton")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveGuardianship(guardianship)}
                              disabled={acting}
                              className="inline-flex shrink-0 items-center justify-center rounded-md border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {acting ? t("settings.removingGuardian") : t("settings.removeGuardianButton")}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
