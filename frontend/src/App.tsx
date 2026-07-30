import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/useAuth";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ChildDashboard } from "./pages/child/ChildDashboard";
import { ParentDashboard } from "./pages/parent/ParentDashboard";
import { ChildDetail } from "./pages/parent/ChildDetail";
import { QuickActionPage } from "./pages/parent/QuickActionPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { SettingsPage } from "./pages/SettingsPage";

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "parent" ? "/parent" : "/child"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/child"
        element={
          <ProtectedRoute role="child">
            <ChildDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parent"
        element={
          <ProtectedRoute role="parent">
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/children/:childId"
        element={
          <ProtectedRoute role="parent">
            <ChildDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/quick-action/:action"
        element={
          <ProtectedRoute role="parent">
            <QuickActionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute role="parent" requireAdmin>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
