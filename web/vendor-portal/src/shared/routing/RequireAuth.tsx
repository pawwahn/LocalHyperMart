import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LegalAcceptGate } from '@hlm-legal';
import { useAuth } from '@/shared/auth/AuthContext';
import { OrderAlertProvider } from '@/features/orders/OrderAlertContext';

export function RequireAuth() {
  const { isAuthenticated, session, logout } = useAuth();
  const navigate = useNavigate();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  const token = session?.accessToken ?? '';
  return (
    <LegalAcceptGate
      accessToken={token}
      portalLabel="Vendor workspace"
      onSignOut={() => {
        logout();
        navigate('/login', { replace: true });
      }}
    >
      <OrderAlertProvider>
        <Outlet />
      </OrderAlertProvider>
    </LegalAcceptGate>
  );
}
