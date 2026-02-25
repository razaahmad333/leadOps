import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { TodayPage } from './pages/TodayPage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { RoleRoute } from './components/RoleRoute.tsx';
import { Toast } from './components/Toast.tsx';

export default function App(): React.JSX.Element {
  return (
    <>
      <Toast />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes — requires valid JWT */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/owner/dashboard"
            element={
              <RoleRoute role="OWNER">
                <DashboardPage />
              </RoleRoute>
            }
          />
          <Route path="/staff/today" element={<TodayPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
