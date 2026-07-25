import { useTranslation } from "react-i18next";
import type { User } from "../../types/api";
import { Card, CardHeader, EmptyState } from "../ui";

/** Full user directory, rendered on the standalone admin page -- reachable
 * only by parents with administrative rights (`is_staff`); see
 * pages/admin/AdminUsersPage.tsx and apps.users.views.UserViewSet.all. */
export function AdminUserList({ users }: { users: User[] }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t("adminUsers.title")} subtitle={t("adminUsers.subtitle")} />
      {users.length === 0 ? (
        <EmptyState>{t("adminUsers.empty")}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2.5 font-medium">{t("adminUsers.usernameCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("adminUsers.nameCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("adminUsers.roleCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("adminUsers.emailCol")}</th>
                <th className="px-5 py-2.5 font-medium">{t("adminUsers.adminCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/60">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-ink-900">{u.username}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "\u2014"}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{t(`role.${u.role}`)}</td>
                  <td className="px-5 py-3 text-ink-600">{u.email || "\u2014"}</td>
                  <td className="px-5 py-3 text-ink-600">{u.is_staff ? t("adminUsers.yes") : t("adminUsers.no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
