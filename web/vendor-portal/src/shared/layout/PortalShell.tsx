import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
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

const NAV = [
  { to: '/dashboard', label: 'Home', icon: '🏠', end: true },
  { to: '/listings', label: 'Listings', icon: '🛒', end: false },
  { to: '/reports', label: 'Reports', icon: '📊', end: false },
  { to: '/payouts', label: 'Payouts', icon: '💵', end: false },
  { to: '/sellers', label: 'Sellers', icon: '🏆', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
] as const;

export function PortalShell({ title, children, onRefresh, shopPause }: Props) {
  const { session, logout } = useAuth();
  const { hub, townName: shopTownName } = useVendorShop();
  const location = useLocation();
  const navigate = useNavigate();
  const { alertMessage, pendingCount, clearAlert } = useOrderAlert();
  const narrow = useIsNarrow(767);
  const shopName = session?.shopName ?? 'Vendor shop';
  const phone = session?.phone;
  const townName = shopTownName ?? session?.townName ?? null;

  return (
    <div
      style={{
        ...styles.page,
        paddingBottom: narrow
          ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 1.25rem)'
          : '2rem',
      }}
    >
      <header style={{ ...styles.header, ...(narrow ? styles.headerNarrow : null) }}>
        <div style={styles.brandBlock}>
          <div style={styles.topRow}>
            <p style={styles.brand}>HyperLocalMart</p>
            <span style={styles.dot} aria-hidden="true">
              ·
            </span>
            <p style={{ ...styles.shop, ...(narrow ? styles.shopNarrow : null) }}>
              <span style={styles.shopStrong}>{shopName}</span>
              {townName ? (
                <>
                  <span style={styles.shopSep} aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                  <span style={styles.shopTown}>{townName}</span>
                </>
              ) : null}
              {phone ? (
                <>
                  <span style={styles.shopSep} aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                  <span style={styles.shopStrong}>{phone}</span>
                </>
              ) : null}
            </p>
          </div>
          <h1 style={styles.title}>{title}</h1>
          {!narrow ? (
            <nav style={styles.nav} aria-label="Vendor sections">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={
                    isNavActive(location.pathname, item.to, item.end)
                      ? styles.navActive
                      : styles.navLink
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
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
      {hub.hubPhone ? (
        <footer style={styles.footer}>
          Need help with pickup or payout? Call hub {hub.hubName || 'hub'}:{' '}
          <a href={`tel:${hub.hubPhone}`} style={styles.footerLink}>
            {hub.hubPhone}
          </a>
          {hub.hubHours ? ` (${hub.hubHours})` : null}
        </footer>
      ) : null}

      {narrow ? (
        <nav style={styles.tabbar} aria-label="Vendor sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
            >
              <span style={styles.tabIcon} aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function isNavActive(pathname: string, to: string, end: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 'var(--shell-max, 1120px)',
    width: '100%',
    margin: '0 auto',
    padding: '0.75rem 0.75rem 2rem',
    display: 'grid',
    gap: '0.85rem',
    boxSizing: 'border-box',
    overflowX: 'hidden',
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
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  shopStrong: {
    color: 'var(--text)',
    fontWeight: 800,
    letterSpacing: '-0.015em',
  },
  shopTown: {
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  shopSep: {
    color: 'var(--text-muted)',
    fontWeight: 500,
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
    padding: '0.45rem 0.7rem',
    minHeight: 'var(--touch-min)',
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    boxSizing: 'border-box',
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.82rem',
    padding: '0.45rem 0.7rem',
    minHeight: 'var(--touch-min)',
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
    boxSizing: 'border-box',
  },
  headerActions: {
    display: 'flex',
    gap: '0.35rem',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'wrap',
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
    padding: '0.45rem 0.25rem',
    minHeight: 'var(--touch-min)',
  },
  main: { display: 'grid', gap: '0.85rem', minWidth: 0 },
  footer: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingTop: '0.25rem',
  },
  footerLink: { color: 'var(--accent-hover)', fontWeight: 800, textDecoration: 'none' },
  tabbar: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 0,
    width: '100%',
    maxWidth: 'var(--shell-max)',
    height: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    background: 'var(--bg-elevated)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    boxSizing: 'border-box',
  },
  tab: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.62rem',
    fontWeight: 700,
    padding: '0.35rem 0.1rem',
    minHeight: 'var(--touch-min)',
    textAlign: 'center',
  },
  tabActive: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--accent)',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.35rem 0.1rem',
    minHeight: 'var(--touch-min)',
    textAlign: 'center',
  },
  tabIcon: { fontSize: '1.15rem', lineHeight: 1 },
};
