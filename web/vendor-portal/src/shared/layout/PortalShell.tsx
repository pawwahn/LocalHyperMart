import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@hlm-brand';
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
  { to: '/delivery-agents', label: 'Agents', icon: '🛵', end: false },
  { to: '/cod-handover', label: 'COD cash', icon: '💰', end: false },
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
  const { alertMessage, pendingCount, agentAssignPendingCount, clearAlert, soundReady, enableSound } =
    useOrderAlert();
  const narrow = useIsNarrow(767);
  const shopName = session?.shopName ?? 'Vendor shop';
  const phone = session?.phone;
  const townName = shopTownName ?? session?.townName ?? null;
  const metaLine = [townName, phone].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        ...styles.page,
        ...(narrow ? styles.pageNarrow : null),
        paddingBottom: narrow
          ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
          : '1.5rem',
      }}
    >
      <header style={{ ...styles.header, ...(narrow ? styles.headerSticky : null) }}>
        <div style={styles.headerGrid}>
          <div style={styles.headerLead}>
            <div style={styles.identityRow}>
              <BrandMark variant="compact" fallbackName="KoyaKart" />
              <span style={styles.shopChip} title={shopName}>
                {shopName}
              </span>
              {metaLine ? (
                <span style={styles.metaLine} title={metaLine}>
                  {metaLine}
                </span>
              ) : null}
            </div>
            <h1 style={{ ...styles.title, ...(narrow ? styles.titleNarrow : null) }}>{title}</h1>
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
          {agentAssignPendingCount > 0 ? (
            <HeaderIconButton
              label={`${agentAssignPendingCount} orders need delivery agent`}
              tone="accent"
              onClick={() => {
                navigate('/dashboard', { state: { focusAgentAssign: true } });
              }}
            >
              {agentAssignPendingCount > 99 ? '99+' : agentAssignPendingCount}🛵
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
        </div>
      </header>

      {!soundReady ? (
        <Banner tone="warning" style={styles.alertBanner}>
          <span style={styles.alertText}>
            Order sound didn’t unlock after sign-in — tap Enable once (browser rule).
          </span>
          <span style={styles.alertActions}>
            <button
              type="button"
              style={styles.alertLinkBtn}
              onClick={() => {
                void enableSound();
              }}
            >
              Enable sound
            </button>
          </span>
        </Banner>
      ) : null}

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
    minHeight: '100dvh',
    margin: '0 auto',
    padding: '0.55rem 0.75rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  pageNarrow: {
    padding: '0 0.65rem 0',
    gap: '0.45rem',
  },
  header: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.5rem 0.65rem 0.55rem',
    boxShadow: 'var(--shadow-card)',
    position: 'relative',
    zIndex: 30,
    overflow: 'visible',
    flexShrink: 0,
  },
  headerSticky: {
    position: 'sticky',
    top: 0,
    borderRadius: 0,
    borderLeft: 'none',
    borderRight: 'none',
    marginLeft: '-0.65rem',
    marginRight: '-0.65rem',
    width: 'calc(100% + 1.3rem)',
    paddingTop: 'max(0.4rem, env(safe-area-inset-top, 0px))',
    boxShadow: '0 1px 0 rgba(15, 23, 42, 0.05)',
  },
  headerGrid: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.4rem',
  },
  headerLead: {
    display: 'grid',
    gap: '0.12rem',
    minWidth: 0,
    flex: 1,
  },
  identityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  shopChip: {
    flexShrink: 0,
    maxWidth: 'min(46vw, 12.5rem)',
    padding: '0.14rem 0.5rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--accent) 14%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.76rem',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.25,
  },
  metaLine: {
    flex: 1,
    minWidth: 0,
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  title: {
    margin: '0.08rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.05rem, 2.8vw, 1.28rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
  },
  titleNarrow: {
    fontSize: '1.08rem',
  },
  nav: {
    display: 'flex',
    gap: '0.12rem',
    flexWrap: 'wrap',
    marginTop: '0.28rem',
  },
  navLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.76rem',
    padding: '0.32rem 0.55rem',
    minHeight: 36,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    boxSizing: 'border-box',
  },
  navActive: {
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.76rem',
    padding: '0.32rem 0.55rem',
    minHeight: 36,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
    boxSizing: 'border-box',
  },
  headerActions: {
    display: 'flex',
    gap: '0.15rem',
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'nowrap',
    marginTop: '0.05rem',
  },
  alertBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    background: 'var(--brand, #0C831F)',
    color: '#FFFFFF',
  },
  alertText: { fontWeight: 700, flex: '1 1 12rem' },
  alertActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  alertLink: {
    color: 'inherit',
    fontWeight: 800,
    textDecoration: 'underline',
  },
  alertLinkBtn: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    fontWeight: 800,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: '0.45rem 0.25rem',
    minHeight: 'var(--touch-min)',
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
  main: {
    display: 'grid',
    gap: '0.5rem',
    minWidth: 0,
    flex: 1,
    minHeight: 0,
    alignContent: 'start',
  },
  footer: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingTop: '0.15rem',
    flexShrink: 0,
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
