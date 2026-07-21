import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { PILOT_SHOP_NAME_BY_PHONE } from '@/features/auth/api/authApi';
import { PILOT_HUB_HELP } from '@/features/shop/hooks/useVendorShop';
import { useOrderAlert } from '@/features/orders/OrderAlertContext';
import { Banner, Button } from '@/shared/ui';

type ShopPauseControl = {
  acceptingOrders: boolean;
  busy?: boolean;
  onToggle: () => void;
};

type Props = {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  /** Shown under Refresh on Home (Pause / Resume shop). */
  shopPause?: ShopPauseControl;
};

export function PortalShell({ title, children, onRefresh, shopPause }: Props) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const { alertMessage, pendingCount, clearAlert } = useOrderAlert();
  const shopName =
    session?.shopName ??
    (session?.phone ? PILOT_SHOP_NAME_BY_PHONE[session.phone] : undefined) ??
    'Vendor shop';

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brandBlock}>
          <div style={styles.topRow}>
            <p style={styles.brand}>HyperLocalMart</p>
            <span style={styles.dot} aria-hidden="true">
              ·
            </span>
            <p style={styles.shop}>
              {shopName} · {session?.phone}
              {pendingCount > 0 ? (
                <span style={styles.pendingBadge} title="Orders waiting to pack">
                  {' '}
                  · {pendingCount} new
                </span>
              ) : null}
            </p>
          </div>
          <h1 style={styles.title}>{title}</h1>
          <nav style={styles.nav} aria-label="Vendor sections">
            <NavLink to="/dashboard" current={location.pathname}>
              Home
            </NavLink>
            <NavLink to="/listings" current={location.pathname}>
              Listings
            </NavLink>
            <NavLink to="/reports" current={location.pathname}>
              Reports
            </NavLink>
            <NavLink to="/payouts" current={location.pathname}>
              Payouts
            </NavLink>
            <NavLink to="/settings" current={location.pathname}>
              Settings
            </NavLink>
          </nav>
        </div>
        <div style={styles.headerActions}>
          <ThemePicker />
          <div style={styles.refreshStack}>
            {onRefresh ? (
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
            {shopPause ? (
              <Button
                size="sm"
                variant={shopPause.acceptingOrders ? 'secondary' : 'primary'}
                disabled={shopPause.busy}
                onClick={shopPause.onToggle}
              >
                {shopPause.busy ? '…' : shopPause.acceptingOrders ? 'Pause shop' : 'Resume shop'}
              </Button>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      {alertMessage ? (
        <Banner tone="brand" style={styles.alertBanner}>
          <span style={styles.alertText}>{alertMessage}</span>
          <span style={styles.alertActions}>
            {location.pathname !== '/dashboard' ? (
              <Link to="/dashboard" style={styles.alertLink}>
                Open orders
              </Link>
            ) : null}
            <button type="button" style={styles.alertDismiss} onClick={clearAlert}>
              Dismiss
            </button>
          </span>
        </Banner>
      ) : null}

      <main style={styles.main}>{children}</main>
      <footer style={styles.footer}>
        Need help with pickup or payout? Call hub {PILOT_HUB_HELP.hubName}:{' '}
        <a href={`tel:${PILOT_HUB_HELP.hubPhone}`} style={styles.footerLink}>
          {PILOT_HUB_HELP.hubPhone}
        </a>{' '}
        ({PILOT_HUB_HELP.hubHours})
      </footer>
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
  const active = current === to;
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
    padding: '1rem 1rem 2.5rem',
    display: 'grid',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.85rem',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.75rem 1rem',
    boxShadow: 'var(--shadow-card)',
  },
  brandBlock: { display: 'grid', gap: '0.35rem', minWidth: 0 },
  topRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.85rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  dot: { color: 'var(--text-muted)', fontSize: '0.85rem' },
  shop: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pendingBadge: { color: 'var(--accent-hover)', fontWeight: 800 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.2rem, 2.5vw, 1.45rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  nav: { display: 'flex', gap: '0.25rem', flexWrap: 'wrap' },
  navLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.85rem',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius-full)',
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
  },
  headerActions: { display: 'flex', gap: '0.4rem', alignItems: 'flex-start' },
  refreshStack: { display: 'grid', gap: '0.35rem', justifyItems: 'stretch' },
  alertBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  alertText: { fontWeight: 700 },
  alertActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  alertLink: {
    color: 'inherit',
    fontWeight: 800,
    textDecoration: 'underline',
  },
  alertDismiss: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    opacity: 0.9,
    padding: 0,
  },
  main: { display: 'grid', gap: '1rem' },
  footer: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingTop: '0.25rem',
  },
  footerLink: { color: 'var(--accent-hover)', fontWeight: 800, textDecoration: 'none' },
};
