import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { TownsPage } from '@/features/towns/pages/TownsPage';
import { VendorsPage } from '@/features/vendors/pages/VendorsPage';
import { CatalogPage } from '@/features/catalog/pages/CatalogPage';
import { StoreListingsPage } from '@/features/store-listings/pages/StoreListingsPage';
import { SettlementsPage } from '@/features/settlements/pages/SettlementsPage';
import { AgentsPage } from '@/features/agents/pages/AgentsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';

export function AppRouter() {
  return (
    <ThemeProvider storageKey="hlm.superadmin.theme" defaultAccent="amber">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/towns" element={<TownsPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/store-listings" element={<StoreListingsPage />} />
              <Route path="/settlements" element={<SettlementsPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
