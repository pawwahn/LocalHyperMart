import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { TownsPage } from '@/features/towns/pages/TownsPage';
import { VendorsPage } from '@/features/vendors/pages/VendorsPage';
import { VendorBillingPage } from '@/features/vendors/pages/VendorBillingPage';
import { CatalogPage } from '@/features/catalog/pages/CatalogPage';
import { StoreListingsPage } from '@/features/store-listings/pages/StoreListingsPage';
import { SettlementsPage } from '@/features/settlements/pages/SettlementsPage';
import { AgentsPage } from '@/features/agents/pages/AgentsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { OrdersPage } from '@/features/orders/pages/OrdersPage';
import { OrderDetailPage } from '@/features/orders/pages/OrderDetailPage';
import { ClaimsPage } from '@/features/claims/pages/ClaimsPage';
import { CustomersPage } from '@/features/customers/pages/CustomersPage';

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
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/claims" element={<ClaimsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="/vendor-billing" element={<VendorBillingPage />} />
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
