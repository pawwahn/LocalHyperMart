import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';

type Props = {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
};

const NAV = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/towns', label: 'Towns' },
  { to: '/hubs', label: 'Hubs' },
  { to: '/orders', label: 'Orders' },
  { to: '/claims', label: 'Claims' },
  { to: '/customers', label: 'Customers' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/vendor-billing', label: 'Billing' },
  { to: '/agents', label: 'Agents' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/store-listings', label: 'Listings' },
  { to: '/settlements', label: 'Payouts' },
  { to: '/settings', label: 'Settings' },
];

export function PortalShell({ title, children, onRefresh }: Props) {
  const { session, logout } = useAuth();
  const location = useLocation();

  return (
    <div style={styles.page}>
      <style>{shellCss}</style>
      <header className="sa-shell-header" style={styles.header}>
        <div style={styles.topRow}>
          <div style={styles.brandBlock}>
            <p style={styles.brand}>HyperLocalMart · Super Admin</p>
            <div style={styles.titleRow}>
              <h1 style={styles.title}>{title}</h1>
              {session?.phone ? (
                <span className="sa-shell-phone" style={styles.phone}>
                  {session.phone}
                </span>
              ) : null}
            </div>
          </div>
          <div style={styles.headerActions}>
            <ThemePicker />
            {onRefresh ? (
              <HeaderIconButton label="Refresh" onClick={onRefresh}>
                ↻
              </HeaderIconButton>
            ) : null}
            <HeaderIconButton label="Sign out" onClick={logout}>
              ⎋
            </HeaderIconButton>
          </div>
        </div>
        <nav className="sa-shell-nav" style={styles.nav} aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} current={location.pathname}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

function NavLink({
  to,
  current,
  children,
}: {
  to: string;
  current: string;
  children: ReactNode;
}) {
  const active = current === to || (to !== '/dashboard' && current.startsWith(to));
  return (
    <Link to={to} className="sa-shell-nav-link" style={active ? styles.navActive : styles.navLink}>
      {children}
    </Link>
  );
}

const shellCss = `
  .sa-shell-nav {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .sa-shell-nav::-webkit-scrollbar {
    display: none;
  }
  @media (max-width: 720px) {
    .sa-shell-header {
      padding: 0.7rem 0.8rem 0.65rem !important;
      border-radius: 14px !important;
    }
    .sa-shell-phone {
      display: none !important;
    }
    .sa-shell-nav-link {
      font-size: 0.8rem !important;
      padding: 0.32rem 0.65rem !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '0.85rem 0.85rem 2.5rem',
    display: 'grid',
    gap: '0.85rem',
  },
  header: {
    display: 'grid',
    gap: '0.55rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '0.85rem 1rem 0.75rem',
    boxShadow: 'var(--shadow-card)',
    position: 'relative',
    zIndex: 30,
    overflow: 'hidden',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.65rem',
    alignItems: 'flex-start',
  },
  brandBlock: { display: 'grid', gap: '0.1rem', flex: 1, minWidth: 0 },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '0.01em',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.55rem',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.2rem, 3.5vw, 1.55rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  phone: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    gap: '0.3rem',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    overflowY: 'hidden',
    margin: '0 -0.15rem',
    padding: '0.1rem 0.15rem 0.15rem',
  },
  navLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.84rem',
    padding: '0.38rem 0.72rem',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.84rem',
    padding: '0.38rem 0.72rem',
    borderRadius: '999px',
    background: 'var(--accent-soft)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '0.3rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  main: { display: 'grid', gap: '0.9rem' },
};
