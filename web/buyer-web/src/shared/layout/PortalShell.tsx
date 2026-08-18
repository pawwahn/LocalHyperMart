import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HeaderIconButton } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { StickyCartBar } from '@/features/shop/components/StickyCartBar';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';
import {
  IconBasket,
  IconGrid,
  IconHome,
  IconMore,
  IconWallet,
} from '@/features/shop/components/NavIcons';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  cartCount?: number;
  cartTotalLabel?: string;
  showDeliveryBanner?: boolean;
  /** Town “Deliver to” control — keep on shop/cart; hide on order history. */
  showTownPicker?: boolean;
  showStickyCart?: boolean;
  hideTitle?: boolean;
  /** Shop home: location + search chrome, no brand lockup. */
  shopChrome?: boolean;
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
  showTownPicker = true,
  showStickyCart = true,
  hideTitle = false,
  shopChrome = false,
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
      <header style={shopChrome ? styles.headerShop : styles.header}>
        {shopChrome ? null : (
          <div style={styles.brandRow}>
            <div style={styles.brandLockup}>
              <p style={styles.brandMark}>HyperLocalMart</p>
              <span className="hlm-brand-tagline" style={styles.brandTagline}>
                <span style={styles.brandDash} aria-hidden>
                  —
                </span>
                Supporting your home town
              </span>
            </div>
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
        )}

        {showTownPicker ? (
          <button
            type="button"
            style={shopChrome ? styles.locationBtnShop : styles.locationBtn}
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
        ) : null}
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
        <Tab to="/shop" current={location.pathname} label="Home" icon={(active) => <IconHome active={active} />} />
        <Tab
          to="/categories"
          current={location.pathname}
          label="Categories"
          icon={(active) => <IconGrid active={active} />}
        />
        <Tab
          to="/cart"
          current={location.pathname}
          label="Basket"
          badge={cartCount}
          icon={(active) => <IconBasket active={active} />}
        />
        <Tab
          to="/wallet"
          current={location.pathname}
          label="Wallet"
          icon={(active) => <IconWallet active={active} />}
        />
        <Tab to="/more" current={location.pathname} label="More" icon={(active) => <IconMore active={active} />} />
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
  icon: (active: boolean) => ReactNode;
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
        {icon(active)}
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
    padding: '0.35rem 0.85rem 0',
    minHeight: '100vh',
    display: 'grid',
    gap: '0.55rem',
    alignContent: 'start',
    background: 'var(--bg)',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    margin: '0 -0.85rem',
    padding: '0.35rem 0.85rem 0.4rem',
    background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'grid',
    gap: '0.3rem',
    minWidth: 0,
  },
  headerShop: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    margin: '0 -0.85rem',
    padding: '0.4rem 0.85rem 0.15rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.2rem',
    minWidth: 0,
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.4rem',
    minWidth: 0,
  },
  brandLockup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
    minWidth: 0,
    flex: '1 1 auto',
  },
  brandMark: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
    flexShrink: 0,
  },
  brandTagline: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.78rem',
    fontWeight: 600,
    fontStyle: 'italic',
    letterSpacing: '-0.005em',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  brandDash: {
    marginRight: '0.22rem',
    color: 'var(--text-muted)',
    fontStyle: 'normal',
    fontWeight: 700,
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
  locationBtnShop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '0.15rem 0',
    minHeight: 32,
    textAlign: 'left',
    cursor: 'pointer',
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
    fontSize: '0.92rem',
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
    color: 'var(--text)',
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
    color: 'var(--bg)',
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
  main: { display: 'grid', gap: '0.65rem', minWidth: 0, width: '100%', overflowX: 'hidden' },
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
    gridTemplateColumns: 'repeat(5, 1fr)',
    background: 'var(--bg)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
    boxSizing: 'border-box',
  },
  tab: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.12rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.62rem',
    fontWeight: 600,
    padding: '0.4rem 0.1rem',
    minHeight: 'var(--touch-min)',
  },
  tabActive: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.12rem',
    textDecoration: 'none',
    color: 'var(--accent)',
    fontSize: '0.62rem',
    fontWeight: 700,
    padding: '0.4rem 0.1rem',
    minHeight: 'var(--touch-min)',
  },
  tabIcon: { position: 'relative', lineHeight: 1 },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    display: 'inline-grid',
    placeItems: 'center',
  },
};
