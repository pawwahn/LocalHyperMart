import { routerBasename } from '../../../shared/routerBasename';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { VendorChromeLayout } from '@/shared/layout/VendorChromeLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { LegalDocumentPage } from '@hlm-legal';
import { PayoutsPage } from '@/features/payouts/pages/PayoutsPage';
import { SellersPage } from '@/features/sellers/pages/SellersPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { DeliveryAgentsPage } from '@/features/delivery/pages/DeliveryAgentsPage';
import { VendorCodHandoverPage } from '@/features/cod/pages/VendorCodHandoverPage';

function AuthBoundTheme({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider
      storageKey="hlm.koyakart.vendor.theme"
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
        <BrowserRouter basename={routerBasename()}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/legal/:doc" element={<LegalDocumentPage homeTo="/login" />} />
            <Route element={<RequireAuth />}>
              <Route element={<VendorChromeLayout />}>
                <Route path="/dashboard" element={<KeepAliveRoute />} />
                <Route path="/listings" element={<KeepAliveRoute />} />
                <Route path="/reports" element={<KeepAliveRoute />} />
                <Route path="/payouts" element={<PayoutsPage />} />
                <Route path="/sellers" element={<SellersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/delivery-agents" element={<DeliveryAgentsPage />} />
                <Route path="/cod-handover" element={<VendorCodHandoverPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthBoundTheme>
    </AuthProvider>
  );
}
