import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { PILOT_SHOP_NAME_BY_PHONE } from '@/features/auth/api/authApi';
import { PILOT_HUB_HELP } from '@/features/shop/hooks/useVendorShop';
import { useOrderAlert } from '@/features/orders/OrderAlertContext';
import { Banner } from '@/shared/ui';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';

type ShopPauseControl = {
  acceptingOrders: boolean;
  busy?: boolean;
  onToggle: () => void;
};

type Props = {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  /** Shown in header icon row (Pause / Resume shop). */
  shopPause?: ShopPauseControl;
};

export function PortalShell({ title, children, onRefresh, shopPause }: Props) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { alertMessage, pendingCount, clearAlert } = useOrderAlert();
  const narrow = useIsNarrow();
  const shopName =
    session?.shopName ??
    (session?.phone ? PILOT_SHOP_NAME_BY_PHONE[session.phone] : undefined) ??
    'Vendor shop';

  return (
    <div style={styles.page}>
      <header style={{ ...styles.header, ...(narrow ? styles.headerNarrow : null) }}>
        <div style={styles.brandBlock}>
          <div style={styles.topRow}>
            <p style={styles.brand}>HyperLocalMart</p>
            <span style={styles.dot} aria-hidden="true">
              ·
            </span>
            <p style={{ ...styles.shop, ...(narrow ? styles.shopNarrow : null) }}>
              {shopName} · {session?.phone}
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
          {onRefresh ? (
            <HeaderIconButton label="Refresh" onClick={onRefresh}>
              ↻
            </HeaderIconButton>
          ) : null}
          {pendingCount > 0 ? (
            <HeaderIconButton
              label={`${pendingCount} new orders`}
              tone="accent"
              onClick={() => {
                if (location.pathname !== '/dashboard') navigate('/dashboard');
              }}
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </HeaderIconButton>
          ) : null}
          {shopPause ? (
            <HeaderIconButton
              label={shopPause.acceptingOrders ? 'Pause shop' : 'Resume shop'}
              tone={shopPause.acceptingOrders ? 'neutral' : 'accent'}
              disabled={shopPause.busy}
              onClick={shopPause.onToggle}
            >
              {shopPause.busy ? '…' : shopPause.acceptingOrders ? '⏸' : '▶'}
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton label="Sign out" onClick={logout}>
            ⎋
          </HeaderIconButton>
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
    padding: '0.75rem 0.75rem 2rem',
    display: 'grid',
    gap: '0.85rem',
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
    position: 'relative',
    zIndex: 30,
    overflow: 'visible',
  },
  headerNarrow: {
    flexDirection: 'column',
    padding: '0.65rem 0.75rem',
    gap: '0.55rem',
  },
  brandBlock: { display: 'grid', gap: '0.35rem', minWidth: 0, flex: 1 },
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
  shopNarrow: {
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'unset',
    lineHeight: 1.35,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.15rem, 4vw, 1.45rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  nav: { display: 'flex', gap: '0.2rem', flexWrap: 'wrap' },
  navLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.82rem',
    padding: '0.3rem 0.55rem',
    borderRadius: 'var(--radius-full)',
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.82rem',
    padding: '0.3rem 0.55rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
  },
  headerActions: {
    display: 'flex',
    gap: '0.35rem',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  alertBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  alertText: { fontWeight: 700, flex: '1 1 12rem' },
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
  main: { display: 'grid', gap: '0.85rem', minWidth: 0 },
  footer: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingTop: '0.25rem',
  },
  footerLink: { color: 'var(--accent-hover)', fontWeight: 800, textDecoration: 'none' },
};
