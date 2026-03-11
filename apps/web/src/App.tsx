import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PermissionRoute } from './components/PermissionRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { useAuth } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { LoginPage } from './pages/LoginPage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { PermissionsCatalogPage } from './pages/settings/PermissionsCatalogPage';
import { RolesPage } from './pages/settings/RolesPage';
import { TeamPage } from './pages/settings/TeamPage';
import { IntakeConfigPage } from './pages/settings/IntakeConfigPage';
import { TodayPage } from './pages/TodayPage';

function HomeRedirect(): React.JSX.Element {
  const { user, defaultRoute } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={defaultRoute} replace />;
}

export default function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/owner/dashboard"
            element={
              <PermissionRoute permission="dashboard.view">
                <DashboardPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/staff/today"
            element={
              <PermissionRoute permission="followups.view">
                <TodayPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <PermissionRoute permission="enquiries.view">
                <LeadsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PermissionRoute permission="settings.view">
                <SettingsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/settings/team"
            element={
              <PermissionRoute permission="users.manage">
                <TeamPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/settings/roles"
            element={
              <PermissionRoute permission="roles.manage">
                <RolesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/settings/permissions"
            element={
              <PermissionRoute permission="permissions.view">
                <PermissionsCatalogPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/settings/intake"
            element={
              <PermissionRoute permission="settings.view">
                <IntakeConfigPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/platform/admin"
            element={
              <SuperAdminRoute>
                <PlatformAdminPage />
              </SuperAdminRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
