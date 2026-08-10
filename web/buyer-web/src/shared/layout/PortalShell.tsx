import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { StickyCartBar } from '@/features/shop/components/StickyCartBar';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  cartCount?: number;
  cartTotalLabel?: string;
  showDeliveryBanner?: boolean;
  showStickyCart?: boolean;
  hideTitle?: boolean;
  footerSlot?: ReactNode;
};

export function PortalShell({
  title,
  subtitle,
  children,
  onRefresh,
  cartCount = 0,
  cartTotalLabel,
  showDeliveryBanner = true,
  showStickyCart = true,
  hideTitle = false,
  footerSlot,
}: Props) {
  const { session, logout } = useAuth();
  const { townLabel, openPicker } = useTown();
  const location = useLocation();
  const navigate = useNavigate();
  const onCart = location.pathname.startsWith('/cart');
  const showFloatingCart = showStickyCart && !onCart && cartCount > 0;
  const hasFooter = Boolean(footerSlot);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      style={{
        ...styles.page,
        paddingBottom: showFloatingCart || hasFooter
          ? 'calc(var(--tabbar-h) + var(--sticky-cart-h) + 1.75rem)'
          : 'calc(var(--tabbar-h) + 1.25rem)',
      }}
    >
      <TownPickerSheet />
      <header style={styles.header}>
        <div style={styles.brandRow}>
          <p style={styles.brandMark}>HyperLocalMart</p>
          <div style={styles.headerActions}>
            {session ? (
              <HeaderIconButton
                label="Order alerts"
                onClick={() => navigate('/alerts')}
                style={styles.headerIcon}
              >
                🔔
              </HeaderIconButton>
            ) : null}
            <ThemePicker />
            {onRefresh ? (
              <HeaderIconButton
                label={refreshing ? 'Refreshing…' : 'Refresh'}
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                style={{
                  ...styles.headerIcon,
                  ...(refreshing ? { opacity: 0.65 } : null),
                }}
              >
                {refreshing ? '…' : '↻'}
              </HeaderIconButton>
            ) : null}
            {session ? (
              <HeaderIconButton label="Sign out" onClick={logout} style={styles.headerIcon}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.02em' }}>OUT</span>
              </HeaderIconButton>
            ) : (
              <Link to="/login" style={styles.signIn}>
                Login
              </Link>
            )}
          </div>
        </div>

        <button
          type="button"
          style={styles.locationBtn}
          aria-label={`Change town. Currently ${townLabel}`}
          title="Tap to change town"
          onClick={openPicker}
        >
          <span style={styles.pin} aria-hidden>
            📍
          </span>
          <span style={styles.locationValue}>
            <span style={styles.locationEyebrow}>Deliver to </span>
            {townLabel}
          </span>
          <span style={styles.chevron} aria-hidden>
            ▾
          </span>
        </button>
      </header>

      {showDeliveryBanner ? <AdSlot slot="home_hero" variant="hero" /> : null}

      {!hideTitle && title ? (
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.sub}>{subtitle}</p> : null}
        </div>
      ) : null}

      <main style={styles.main}>{children}</main>

      {footerSlot}

      {showFloatingCart ? (
        <StickyCartBar itemCount={cartCount} totalLabel={cartTotalLabel} />
      ) : null}

      <nav style={styles.tabbar} aria-label="Primary">
        <Tab to="/shop" current={location.pathname} icon="🏠" label="Home" />
        <Tab to="/cart" current={location.pathname} icon="🛒" label="Cart" badge={cartCount} />
        <Tab to="/orders" current={location.pathname} icon="📦" label="Orders" />
        <Tab to="/wallet" current={location.pathname} icon="👛" label="Wallet" />
      </nav>
    </div>
  );
}

function Tab({
  to,
  current,
  icon,
  label,
  badge = 0,
}: {
  to: string;
  current: string;
  icon: string;
  label: string;
  badge?: number;
}) {
  const active =
    to === '/shop'
      ? current === '/shop' || current === '/'
      : current === to || current.startsWith(`${to}/`);
  return (
    <Link to={to} style={active ? styles.tabActive : styles.tab}>
      <span style={styles.tabIcon} aria-hidden>
        {icon}
        {badge > 0 ? <span style={styles.tabBadge}>{badge}</span> : null}
      </span>
      <span>{label}</span>
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 'var(--shell-max)',
    width: '100%',
    margin: '0 auto',
    padding: '0.35rem 0.75rem 0',
    minHeight: '100vh',
    display: 'grid',
    gap: '0.45rem',
    alignContent: 'start',
    background: 'var(--bg)',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    margin: '0 -0.75rem',
    padding: '0.35rem 0.75rem 0.4rem',
    background: 'color-mix(in srgb, var(--bg-elevated) 96%, transparent)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border)',
    display: 'grid',
    gap: '0.3rem',
    minWidth: 0,
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.4rem',
    minWidth: 0,
  },
  brandMark: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--accent)',
  },
  headerActions: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '0.22rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerIcon: {
    width: 32,
    height: 32,
    minWidth: 32,
    fontSize: '0.9rem',
  },
  locationBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    padding: '0.35rem 0.65rem',
    minHeight: 36,
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: 10,
    boxSizing: 'border-box',
    minWidth: 0,
  },
  locationEyebrow: {
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'none',
    letterSpacing: '-0.01em',
    fontSize: 'inherit',
  },
  pin: {
    fontSize: '0.85rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  locationValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: 'var(--text)',
    lineHeight: 1.2,
    letterSpacing: '-0.015em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '1 1 auto',
    minWidth: 0,
  },
  chevron: {
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  signIn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.7rem',
    borderRadius: 10,
    background: 'var(--text)',
    color: 'var(--bg-elevated)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: '0.75rem',
    letterSpacing: '-0.01em',
  },
  titleRow: { display: 'grid', gap: '0.15rem' },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  main: { display: 'grid', gap: '0.5rem', minWidth: 0, width: '100%', overflowX: 'hidden' },
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
    gridTemplateColumns: 'repeat(4, 1fr)',
    background: 'color-mix(in srgb, var(--bg-elevated) 97%, transparent)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
    boxShadow: '0 -6px 24px rgba(2, 6, 12, 0.06)',
    boxSizing: 'border-box',
  },
  tab: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '0.45rem 0.25rem',
    minHeight: 'var(--touch-min)',
  },
  tabActive: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--accent)',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.45rem 0.25rem',
    minHeight: 'var(--touch-min)',
  },
  tabIcon: { position: 'relative', fontSize: '1.15rem', lineHeight: 1 },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    fontSize: '0.62rem',
    fontWeight: 800,
    display: 'inline-grid',
    placeItems: 'center',
  },
};
