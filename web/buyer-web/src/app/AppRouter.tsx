import { routerBasename } from '../../../shared/routerBasename';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TownServicesIntroHost } from '@/features/towns/components/TownServicesIntroHost';
import { PlatformBrandProvider } from '@hlm-brand';
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
import { InviteFriendsPage } from '@/features/shop/pages/InviteFriendsPage';
import { AlertsPage } from '@/features/shop/pages/AlertsPage';
import { MorePage } from '@/features/shop/pages/MorePage';
import { AddressesPage } from '@/features/shop/pages/AddressesPage';
import { LaundryPage } from '@/features/laundry/pages/LaundryPage';
import { LaundryOrderPage } from '@/features/laundry/pages/LaundryOrderPage';
import { BeautyPage } from '@/features/beauty/pages/BeautyPage';
import { BeautyOrderPage } from '@/features/beauty/pages/BeautyOrderPage';
import { DiagnosticsPage } from '@/features/diagnostics/pages/DiagnosticsPage';
import { FoodPage } from '@/features/food/pages/FoodPage';
import { FoodHotelPage } from '@/features/food/pages/FoodHotelPage';
import { DiagnosticsOrderPage } from '@/features/diagnostics/pages/DiagnosticsOrderPage';
import { WalletProvider } from '@/features/shop/hooks/useWallet';
import { ShopProvider } from '@/features/shop/hooks/useShop';
import { BuyerAlertsProvider } from '@/features/shop/hooks/useBuyerAlerts';
import { ScratchCardHost } from '@/features/shop/components/ScratchCardHost';
import { NativeAppBridge } from '@hlm-native';

const BUYER_TAB_ROOTS = ['/shop', '/categories', '/cart', '/wallet', '/more'] as const;
import { CookieNotice, LegalDocumentPage, OpenSourceNoticesPage } from '@hlm-legal';
import { PrivacyDataPage } from '@/features/shop/pages/PrivacyDataPage';
import type { ReactNode } from 'react';

/** Shared default theme until login; then personal preference from this browser. */
function AuthBoundTheme({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider
      storageKey="hlm.koyakart.buyer.theme"
      defaultAccent="forest"
      defaultMode="light"
      personalized={isAuthenticated}
    >
      {children}
    </ThemeProvider>
  );
}

export function AppRouter() {
  return (
    <AuthProvider>
      <PlatformBrandProvider>
      <AuthBoundTheme>
        <TownProvider>
          <WalletProvider>
            <BuyerAlertsProvider>
              <BrowserRouter basename={routerBasename()}>
                <ShopProvider>
                  <NativeAppBridge tabRoots={BUYER_TAB_ROOTS} />
                  <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/legal/oss" element={<OpenSourceNoticesPage homeTo="/shop" />} />
                  <Route path="/legal/:doc" element={<LegalDocumentPage homeTo="/login" />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/categories" element={<ShopPage browseOnly />} />
                  <Route path="/more" element={<MorePage />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/welcome" element={<LocalWelcomePage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/addresses" element={<AddressesPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/laundry/orders/:orderId" element={<LaundryOrderPage />} />
                    <Route path="/laundry" element={<LaundryPage />} />
                    <Route path="/beauty/orders/:orderId" element={<BeautyOrderPage />} />
                    <Route path="/beauty" element={<BeautyPage />} />
                    <Route path="/diagnostics/orders/:orderId" element={<DiagnosticsOrderPage />} />
                    <Route path="/diagnostics" element={<DiagnosticsPage />} />
                    <Route path="/food" element={<FoodPage />} />
                    <Route path="/food/:vendorId" element={<FoodHotelPage />} />
                    <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/spend" element={<SpendReportPage />} />
                    <Route path="/membership" element={<MembershipPage />} />
                    <Route path="/invite" element={<InviteFriendsPage />} />
                    <Route path="/privacy" element={<PrivacyDataPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/shop" replace />} />
                  </Routes>
                  <ScratchCardHost />
                  <TownServicesIntroHost />
                  <CookieNotice privacyTo="/legal/privacy" />
                </ShopProvider>
              </BrowserRouter>
            </BuyerAlertsProvider>
          </WalletProvider>
        </TownProvider>
      </AuthBoundTheme>
      </PlatformBrandProvider>
    </AuthProvider>
  );
}
