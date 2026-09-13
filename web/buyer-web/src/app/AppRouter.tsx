import { routerBasename } from '../../../shared/routerBasename';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { TownProvider } from '@/shared/town/TownContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { LocalWelcomePage } from '@/features/auth/pages/LocalWelcomePage';
import { ShopPage } from '@/features/shop/pages/ShopPage';
import { CartPage } from '@/features/shop/pages/CartPage';
import { OrdersPage } from '@/features/shop/pages/OrdersPage';
import { OrderDetailPage } from '@/features/shop/pages/OrderDetailPage';
import { WalletPage } from '@/features/shop/pages/WalletPage';
import { SpendReportPage } from '@/features/shop/pages/SpendReportPage';
import { MembershipPage } from '@/features/shop/pages/MembershipPage';
import { AlertsPage } from '@/features/shop/pages/AlertsPage';
import { MorePage } from '@/features/shop/pages/MorePage';
import { AddressesPage } from '@/features/shop/pages/AddressesPage';
import { WalletProvider } from '@/features/shop/hooks/useWallet';
import { ShopProvider } from '@/features/shop/hooks/useShop';
import { ScratchCardHost } from '@/features/shop/components/ScratchCardHost';
import { LegalDocumentPage } from '@hlm-legal';
import type { ReactNode } from 'react';

/** Shared default theme until login; then personal preference from this browser. */
function AuthBoundTheme({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider
      storageKey="hlm.buyer.theme.v2"
      defaultAccent="ocean"
      defaultMode="dark"
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
        <TownProvider>
          <WalletProvider>
            <ShopProvider>
              <BrowserRouter basename={routerBasename()}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/legal/:doc" element={<LegalDocumentPage homeTo="/login" />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/categories" element={<ShopPage browseOnly />} />
                  <Route path="/more" element={<MorePage />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/welcome" element={<LocalWelcomePage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/addresses" element={<AddressesPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/spend" element={<SpendReportPage />} />
                    <Route path="/membership" element={<MembershipPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/shop" replace />} />
                </Routes>
                <ScratchCardHost />
              </BrowserRouter>
            </ShopProvider>
          </WalletProvider>
        </TownProvider>
      </AuthBoundTheme>
    </AuthProvider>
  );
}
