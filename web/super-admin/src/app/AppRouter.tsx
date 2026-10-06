import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routerBasename } from '../../../shared/routerBasename';
import { PlatformBrandProvider } from '@hlm-brand';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { LegalDocumentPage } from '@hlm-legal';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const MembershipsPage = lazy(() =>
  import('@/features/memberships/pages/MembershipsPage').then((m) => ({ default: m.MembershipsPage })),
);
const TownsPage = lazy(() =>
  import('@/features/towns/pages/TownsPage').then((m) => ({ default: m.TownsPage })),
);
const ScratchGiftReportPage = lazy(() =>
  import('@/features/scratch/pages/ScratchGiftReportPage').then((m) => ({ default: m.ScratchGiftReportPage })),
);
const AdsPage = lazy(() => import('@/features/ads/pages/AdsPage').then((m) => ({ default: m.AdsPage })));
const OrdersPage = lazy(() =>
  import('@/features/orders/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import('@/features/orders/pages/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })),
);
const ClaimsPage = lazy(() =>
  import('@/features/claims/pages/ClaimsPage').then((m) => ({ default: m.ClaimsPage })),
);
const CustomersPage = lazy(() =>
  import('@/features/customers/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const VendorsPage = lazy(() =>
  import('@/features/vendors/pages/VendorsPage').then((m) => ({ default: m.VendorsPage })),
);
const VendorBillingPage = lazy(() =>
  import('@/features/vendors/pages/VendorBillingPage').then((m) => ({ default: m.VendorBillingPage })),
);
const CatalogPage = lazy(() =>
  import('@/features/catalog/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })),
);
const RecipesPage = lazy(() =>
  import('@/features/recipes/pages/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);
const StoreListingsPage = lazy(() =>
  import('@/features/store-listings/pages/StoreListingsPage').then((m) => ({ default: m.StoreListingsPage })),
);
const SettlementsPage = lazy(() =>
  import('@/features/settlements/pages/SettlementsPage').then((m) => ({ default: m.SettlementsPage })),
);
const FinanceLedgerPage = lazy(() =>
  import('@/features/finance/pages/FinanceLedgerPage').then((m) => ({ default: m.FinanceLedgerPage })),
);
const HubsPage = lazy(() => import('@/features/hubs/pages/HubsPage').then((m) => ({ default: m.HubsPage })));
const AgentsPage = lazy(() =>
  import('@/features/agents/pages/AgentsPage').then((m) => ({ default: m.AgentsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return <p style={{ margin: '1rem', color: 'var(--text-muted)' }}>Loading…</p>;
}

export function AppRouter() {
  return (
    <ThemeProvider storageKey="hlm.koyakart.superadmin.theme" defaultAccent="forest">
      <PlatformBrandProvider>
      <AuthProvider>
        <BrowserRouter basename={routerBasename()}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/legal/:doc" element={<LegalDocumentPage homeTo="/login" />} />
              <Route element={<RequireAuth />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/memberships" element={<MembershipsPage />} />
                <Route path="/towns" element={<TownsPage />} />
                <Route path="/scratch-cards" element={<ScratchGiftReportPage />} />
                <Route path="/ads" element={<AdsPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route path="/claims" element={<ClaimsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/vendor-billing" element={<VendorBillingPage />} />
                <Route path="/catalog" element={<CatalogPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
                <Route path="/store-listings" element={<StoreListingsPage />} />
                <Route path="/settlements" element={<SettlementsPage />} />
                <Route path="/finance-ledger" element={<FinanceLedgerPage />} />
                <Route path="/hubs" element={<HubsPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </PlatformBrandProvider>
    </ThemeProvider>
  );
}
