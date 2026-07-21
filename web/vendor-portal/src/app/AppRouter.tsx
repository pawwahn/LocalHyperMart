import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/orders/pages/DashboardPage';
import { ListingsPage } from '@/features/listings/pages/ListingsPage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { PayoutsPage } from '@/features/payouts/pages/PayoutsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';

function AuthBoundTheme({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider
      storageKey="hlm.vendor.theme"
      defaultAccent="forest"
      personalized={isAuthenticated}
    >
      {children}
    </ThemeProvider>
  );
}

export function AppRouter() {
  return (
    <AuthProvider>
      <AuthBoundTheme>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/payouts" element={<PayoutsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthBoundTheme>
    </AuthProvider>
  );
}
