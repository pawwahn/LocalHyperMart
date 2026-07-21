import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { OrderAlertProvider } from '@/features/orders/OrderAlertContext';

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <OrderAlertProvider>
      <Outlet />
    </OrderAlertProvider>
  );
}
