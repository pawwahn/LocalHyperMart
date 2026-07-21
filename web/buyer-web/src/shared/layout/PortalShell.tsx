import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { StickyCartBar } from '@/features/shop/components/StickyCartBar';
import { AdSlot } from '@/features/ads/components/AdSlot';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
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
  const location = useLocation();
  const onCart = location.pathname.startsWith('/cart');
  const showFloatingCart = showStickyCart && !onCart && cartCount > 0;
  const hasFooter = Boolean(footerSlot);

  return (
    <div
      style={{
        ...styles.page,
        paddingBottom: showFloatingCart || hasFooter
          ? 'calc(var(--tabbar-h) + var(--sticky-cart-h) + 1.75rem)'
          : 'calc(var(--tabbar-h) + 1.25rem)',
      }}
    >
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.locationBlock}>
            <p style={styles.brandMark}>HyperLocalMart</p>
            <button type="button" style={styles.locationBtn} aria-label="Delivery location">
              <span style={styles.pin} aria-hidden>
                ▾
              </span>
              <div>
                <p style={styles.locationLabel}>Delivery in today</p>
                <p style={styles.locationValue}>Narsaraopet, AP</p>
              </div>
            </button>
          </div>
          <div style={styles.headerActions}>
            <ThemePicker compact />
            {onRefresh ? (
              <button type="button" style={styles.iconBtn} onClick={onRefresh} aria-label="Refresh">
                ↻
              </button>
            ) : null}
            {session ? (
              <button type="button" style={styles.avatarBtn} onClick={logout} title="Sign out">
                {(session.phone ?? 'B').slice(-2)}
              </button>
            ) : (
              <Link to="/login" style={styles.signIn}>
                Login
              </Link>
            )}
          </div>
        </div>
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
    margin: '0 auto',
    padding: '0.65rem 0.85rem 0',
    minHeight: '100vh',
    display: 'grid',
    gap: '0.85rem',
    alignContent: 'start',
    background: 'var(--bg)',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
    backdropFilter: 'blur(10px)',
    paddingTop: '0.35rem',
    margin: '0 -0.15rem',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  locationBlock: { display: 'grid', gap: '0.15rem' },
  brandMark: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  locationBtn: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.35rem',
    border: 'none',
    background: 'transparent',
    padding: 0,
    textAlign: 'left',
    cursor: 'default',
  },
  pin: { color: 'var(--accent)', fontWeight: 800, marginTop: '0.15rem' },
  locationLabel: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    color: 'var(--text)',
    lineHeight: 1.15,
  },
  locationValue: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 },
  headerActions: { display: 'flex', gap: '0.45rem', alignItems: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    fontWeight: 700,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  signIn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: '0.82rem',
  },
  titleRow: { display: 'grid', gap: '0.2rem' },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.45rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  main: { display: 'grid', gap: '0.85rem' },
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
    gridTemplateColumns: 'repeat(3, 1fr)',
    background: 'var(--bg-elevated)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
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
