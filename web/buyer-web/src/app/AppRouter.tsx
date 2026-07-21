import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ShopPage } from '@/features/shop/pages/ShopPage';
import { CartPage } from '@/features/shop/pages/CartPage';
import { OrdersPage } from '@/features/shop/pages/OrdersPage';
import { OrderDetailPage } from '@/features/shop/pages/OrderDetailPage';

export function AppRouter() {
  return (
    <ThemeProvider storageKey="hlm.buyer.theme" defaultAccent="forest">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/cart" element={<CartPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/shop" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
