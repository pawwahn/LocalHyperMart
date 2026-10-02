import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { resolvePortalRole, type PortalRole } from '@/shared/auth/session';

export function RequireAuth({ role }: { role?: PortalRole }) {
  const { isAuthenticated, session, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const portalRole = resolvePortalRole(session);

  if (!portalRole) {
    return (
      <div style={styles.block}>
        <p style={styles.title}>This account cannot use the delivery portal</p>
        <p style={styles.body}>Sign in as hub admin (9876500100) or delivery agent (9876500200).</p>
        <button type="button" style={styles.btn} onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  if (role && portalRole !== role) {
    const home = portalRole === 'HUB_ADMIN' ? '/hub' : '/agent';
    if (location.pathname !== home && !location.pathname.startsWith(`${home}/`)) {
      return <Navigate to={home} replace />;
    }
    return (
      <div style={styles.block}>
        <p style={styles.title}>Wrong workspace for this page</p>
        <p style={styles.body}>
          {portalRole === 'HUB_ADMIN'
            ? 'Hub admins use Desk and COD under Hub. Open /hub or sign in as an agent.'
            : 'Agents use Home, To home, and COD. Open /agent or sign in as hub admin.'}
        </p>
        <button type="button" style={styles.btn} onClick={() => window.location.assign(home)}>
          Go to {portalRole === 'HUB_ADMIN' ? 'hub' : 'agent'} home
        </button>
      </div>
    );
  }

  return <Outlet />;
}

const styles: Record<string, CSSProperties> = {
  block: {
    maxWidth: 420,
    margin: '2rem auto',
    padding: '1.25rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    display: 'grid',
    gap: '0.65rem',
  },
  title: { margin: 0, fontWeight: 800, fontSize: '1.05rem' },
  body: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.45 },
  btn: {
    justifySelf: 'start',
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.85rem',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
