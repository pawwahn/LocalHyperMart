import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import type { PortalRole } from '@/shared/auth/session';

export function RequireAuth({ role }: { role?: PortalRole }) {
  const { isAuthenticated, session } = useAuth();
  if (!isAuthenticated || !session) {
    return <Navigate to="/login" replace />;
  }
  if (role && session.portalRole !== role) {
    return <Navigate to={session.portalRole === 'HUB_ADMIN' ? '/hub' : '/agent'} replace />;
  }
  return <Outlet />;
}
