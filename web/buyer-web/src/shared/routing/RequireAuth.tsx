import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LegalAcceptGate } from '@hlm-legal';
import { useAuth } from '@/shared/auth/AuthContext';

export function RequireAuth() {
  const { isAuthenticated, session, logout } = useAuth();
  const navigate = useNavigate();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const token = session?.accessToken ?? '';
  return (
    <LegalAcceptGate
      accessToken={token}
      portalLabel="KoyaKart"
      onSignOut={() => {
        logout();
        navigate('/login', { replace: true });
      }}
    >
      <Outlet />
    </LegalAcceptGate>
  );
}
