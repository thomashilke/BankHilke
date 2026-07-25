import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import type { Role } from "../types/api";

/** Gates a route on authentication and, optionally, a required role and/or
 * administrative rights (`is_staff`). Wrong role/rights redirects to that
 * user's own dashboard rather than the login page, since they *are*
 * authenticated -- just not authorized for this view. */
export function ProtectedRoute({
  role,
  requireAdmin,
  children,
}: {
  role?: Role;
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { user, status } = useAuth();

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 text-ink-500">
        {t("common.loadingEllipsis")}
      </div>
    );
  }

  if (status === "anonymous" || !user) {
    return <Navigate to="/login" replace />;
  }

  if ((role && user.role !== role) || (requireAdmin && !user.is_staff)) {
    return <Navigate to={user.role === "parent" ? "/parent" : "/child"} replace />;
  }

  return <>{children}</>;
}
