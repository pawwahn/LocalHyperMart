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
  { to: '/vendors', label: 'Vendors' },
  { to: '/agents', label: 'Agents' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/store-listings', label: 'Store listings' },
  { to: '/settlements', label: 'Vendor payouts' },
  { to: '/settings', label: 'Settings' },
];

export function PortalShell({ title, children, onRefresh }: Props) {
  const { session, logout } = useAuth();
  const location = useLocation();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brandBlock}>
          <p style={styles.brand}>HyperLocalMart · Super Admin</p>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.sub}>Signed in as {session?.phone}</p>
          <nav style={styles.nav}>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} current={location.pathname}>
                {item.label}
              </NavLink>
            ))}
          </nav>
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
    <Link to={to} style={active ? styles.navActive : styles.navLink}>
      {children}
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '1.25rem 1.15rem 3rem',
    display: 'grid',
    gap: '1.15rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '1rem 1.15rem',
    boxShadow: 'var(--shadow-card)',
    position: 'relative',
    zIndex: 30,
    overflow: 'visible',
  },
  brandBlock: { display: 'grid', gap: '0.2rem', flex: 1, minWidth: 0 },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  title: {
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.45rem, 3vw, 1.9rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sub: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  nav: { display: 'flex', gap: '0.35rem', marginTop: '0.75rem', flexWrap: 'wrap' },
  navLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9rem',
    padding: '0.4rem 0.8rem',
    borderRadius: 'var(--radius-full)',
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.9rem',
    padding: '0.4rem 0.8rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
  },
  headerActions: {
    display: 'flex',
    gap: '0.35rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  main: { display: 'grid', gap: '1.15rem' },
};
