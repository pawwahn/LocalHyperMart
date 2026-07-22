import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { useWallet } from '@/features/shop/hooks/useWallet';
import { StickyCartBar } from '@/features/shop/components/StickyCartBar';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';

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
  const { townLabel, openPicker } = useTown();
  const { balance: walletBalance } = useWallet();
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
      <TownPickerSheet />
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.locationBlock}>
            <p style={styles.brandMark}>HyperLocalMart</p>
            <button
              type="button"
              style={styles.locationBtn}
              aria-label={`Change town. Currently ${townLabel}`}
              title="Tap to change town"
              onClick={openPicker}
            >
              <span style={styles.locationEyebrow}>Your town · tap to change</span>
              <span style={styles.locationRow}>
                <span style={styles.locationValue}>{townLabel}</span>
                <span style={styles.chevron} aria-hidden>
                  ▾
                </span>
              </span>
            </button>
          </div>
          <div style={styles.headerActions}>
            {session ? (
              <Link
                to="/alerts"
                style={styles.alertsChip}
                title="Order alerts"
                aria-label="Order alerts"
              >
                Alerts
              </Link>
            ) : null}
            {session ? (
              <Link
                to="/wallet"
                style={styles.walletChip}
                title="Your store credit wallet"
                aria-label={`Wallet balance ₹${walletBalance.toFixed(2)}`}
              >
                <span style={styles.walletChipLabel}>Wallet</span>
                <span style={styles.walletChipAmt}>₹{walletBalance.toFixed(0)}</span>
              </Link>
            ) : null}
            {session ? <ThemePicker /> : null}
            {onRefresh ? (
              <HeaderIconButton label="Refresh" onClick={onRefresh}>
                ↻
              </HeaderIconButton>
            ) : null}
            {session ? (
              <HeaderIconButton label="Sign out" onClick={logout}>
                {(session.phone ?? 'B').slice(-2)}
              </HeaderIconButton>
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
    display: 'grid',
    gap: '0.12rem',
    border: '1px dashed color-mix(in srgb, var(--accent) 45%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))',
    padding: '0.4rem 0.65rem',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    maxWidth: '100%',
  },
  locationEyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.01em',
  },
  locationRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
  },
  locationValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    color: 'var(--text)',
    lineHeight: 1.15,
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '3px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  headerActions: { display: 'flex', gap: '0.45rem', alignItems: 'center' },
  walletChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-elevated))',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  alertsChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    textDecoration: 'none',
    color: 'var(--text)',
    fontSize: '0.78rem',
    fontWeight: 800,
  },
  walletChipLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--accent)',
  },
  walletChipAmt: { fontSize: '0.85rem', fontWeight: 800 },
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
    gridTemplateColumns: 'repeat(4, 1fr)',
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
