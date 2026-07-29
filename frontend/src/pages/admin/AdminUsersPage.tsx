import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usersApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";
import { NavBar } from "../../components/NavBar";
import { AdminUserList } from "../../components/parent/AdminUserList";
import { ErrorAlert, Spinner } from "../../components/ui";

/** Administrative directory of every account on the platform. A distinct
 * page (not part of ParentDashboard) so the "am I this child's guardian"
 * view and the "every account on the system" view never get mixed up --
 * reachable only by parents with `is_staff` (see ProtectedRoute
 * `requireAdmin` and the backend's `GET /users/all/`). */
export function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .listAll()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, t("adminUsers.loadError")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="min-h-screen bg-ink-50">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/parent" className="mb-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("adminUsers.backLink")}
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-900">{t("adminUsers.pageTitle")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("adminUsers.pageSubtitle")}</p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading ? <Spinner label={t("adminUsers.loading")} /> : <AdminUserList users={users} />}
      </main>
    </div>
  );
}
