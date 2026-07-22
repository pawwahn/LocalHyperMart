import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { VendorChromeLayout } from '@/shared/layout/VendorChromeLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
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

/** Placeholder route so keep-alive screens stay matched in the router. */
function KeepAliveRoute() {
  return null;
}

export function AppRouter() {
  return (
    <AuthProvider>
      <AuthBoundTheme>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<VendorChromeLayout />}>
                <Route path="/dashboard" element={<KeepAliveRoute />} />
                <Route path="/listings" element={<KeepAliveRoute />} />
                <Route path="/reports" element={<KeepAliveRoute />} />
                <Route path="/payouts" element={<PayoutsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthBoundTheme>
    </AuthProvider>
  );
}
