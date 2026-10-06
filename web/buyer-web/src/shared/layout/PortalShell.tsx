import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HeaderIconButton } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useBuyerDisplayName } from '@/features/auth/hooks/useBuyerProfile';
import { useTown } from '@/shared/town/TownContext';
import { StickyCartBar } from '@/features/shop/components/StickyCartBar';
import { useShop } from '@/features/shop/hooks/useShop';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { TownPickerSheet } from '@/features/towns/components/TownPickerSheet';
import { APP_NAME } from '@/shared/brand';
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
  cartCount,
  cartTotalLabel,
  showDeliveryBanner = true,
  showTownPicker = true,
  showStickyCart = true,
  hideTitle = false,
  shopChrome = false,
  footerSlot,
}: Props) {
  const { session, logout } = useAuth();
  const buyerName = useBuyerDisplayName();
  const { townLabel, openPicker } = useTown();
  const { cart } = useShop();
  const location = useLocation();
  const navigate = useNavigate();
  const onCart = location.pathname.startsWith('/cart');
  const resolvedCount = cartCount ?? cart?.itemCount ?? 0;
  const resolvedTotal = cartTotalLabel ?? cart?.payableLabel;
  const showFloatingCart = showStickyCart && !onCart && resolvedCount > 0;
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
      className="hlm-buyer-shell"
      style={{
        ...styles.page,
        paddingBottom: showFloatingCart || hasFooter
          ? 'calc(var(--tabbar-h) + var(--sticky-cart-h) + env(safe-area-inset-bottom, 0px) + 0.4rem)'
          : 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <TownPickerSheet />
      <header style={shopChrome ? styles.headerShop : styles.header}>
        {shopChrome ? null : (
          <div style={styles.brandRow}>
            <div style={styles.brandLockup}>
              <p style={styles.brandMark}>{APP_NAME}</p>
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
          shopChrome ? (
            <div className="hlm-shop-chrome-card" style={styles.shopHeaderCard}>
              <div style={styles.shopHeaderRow}>
                <button
                  type="button"
                  style={styles.shopLocationBtn}
                  aria-label={`Change town. Currently ${townLabel}`}
                  title="Tap to change town"
                  onClick={openPicker}
                >
                  <span style={styles.shopLocPin} aria-hidden>📍</span>
                  <span style={styles.shopLocCopy}>
                    <span style={styles.shopLocMeta}>
                      <span style={styles.shopEtaPill}>Same day</span>
                      {session && buyerName ? (
                        <span style={styles.shopHiName}>Hi, {buyerName}</span>
                      ) : (
                        <span style={styles.shopHiName}>Your home town</span>
                      )}
                    </span>
                    <span style={styles.shopLocTitle}>
                      {townLabel}
                      <span style={styles.shopLocChevron} aria-hidden>▾</span>
                    </span>
                  </span>
                </button>
                <div style={styles.shopHeaderActions}>
                  {session ? (
                    <>
                      <HeaderIconButton
                        label="Order alerts"
                        onClick={() => navigate('/alerts')}
                        style={styles.shopIconBtn}
                      >
                        🔔
                      </HeaderIconButton>
                      <button
                        type="button"
                        style={styles.shopAvatar}
                        aria-label="Account and settings"
                        onClick={() => navigate('/more')}
                      >
                        {(buyerName || 'U').charAt(0).toUpperCase()}
                      </button>
                    </>
                  ) : (
                    <Link to="/login" style={styles.shopLoginBtn}>
                      Login
                    </Link>
                  )}
                </div>
              </div>
              <p style={styles.shopSupporterRibbon}>
                <span style={styles.shopSupporterEm} aria-hidden>♥</span>
                Proud supporter of local business
              </p>
            </div>
          ) : (
            <div>
              <button
                type="button"
                style={styles.locationBtn}
                aria-label={`Change town. Currently ${townLabel}`}
                title="Tap to change town"
                onClick={openPicker}
              >
                <span style={styles.pin} aria-hidden>📍</span>
                <span style={styles.locationCopy}>
                  <span style={styles.locationEyebrow}>Deliver to </span>
                  <span style={styles.locationValue}>
                    {townLabel}
                    <span style={styles.chevron} aria-hidden>▾</span>
                  </span>
                </span>
              </button>
            </div>
          )
        ) : null}
      </header>

      {showDeliveryBanner ? <AdSlot slot="home_hero" variant="strip" /> : null}

      {!hideTitle && title ? (
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.sub}>{subtitle}</p> : null}
        </div>
      ) : null}

      <main style={styles.main}>{children}</main>

      {footerSlot ? createPortal(footerSlot, document.body) : null}

      {showFloatingCart ? (
        <StickyCartBar itemCount={resolvedCount} totalLabel={resolvedTotal} />
      ) : null}

      <nav className="hlm-buyer-tabbar" style={styles.tabbar} aria-label="Primary">
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
          badge={resolvedCount}
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
    padding: '0.35rem var(--shell-pad) 0',
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
    margin: '0 calc(-1 * var(--shell-pad))',
    padding: '0.35rem var(--shell-pad) 0.4rem',
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
    margin: '0 calc(-1 * var(--shell-pad))',
    padding: '0 var(--shell-pad) 0.5rem',
    background: 'var(--bg)',
    minWidth: 0,
  },
  shopHeaderCard: {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.55rem 0.65rem 0.5rem',
    borderRadius: '0 0 18px 18px',
    background: 'linear-gradient(145deg, #0A6B1A 0%, #0C831F 42%, #0A7520 100%)',
    boxShadow: '0 10px 28px rgba(12, 131, 31, 0.22)',
    color: '#fff',
  },
  shopHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minWidth: 0,
  },
  shopLocationBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flex: '1 1 auto',
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
  },
  shopLocPin: {
    fontSize: '1.15rem',
    lineHeight: 1,
    flexShrink: 0,
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
  },
  shopLocCopy: {
    display: 'grid',
    gap: '0.12rem',
    minWidth: 0,
    flex: '1 1 auto',
  },
  shopLocMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  shopEtaPill: {
    flexShrink: 0,
    background: 'var(--highlight)',
    color: '#1A1C1A',
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderRadius: 6,
    padding: '0.18rem 0.38rem',
    lineHeight: 1.1,
  },
  shopHiName: {
    fontSize: '0.68rem',
    fontWeight: 600,
    opacity: 0.92,
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  shopLocTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.12rem',
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    display: 'flex',
    alignItems: 'center',
    gap: '0.15rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shopLocChevron: {
    fontSize: '0.9rem',
    fontWeight: 800,
    opacity: 0.95,
    flexShrink: 0,
  },
  shopHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
  },
  shopIconBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    fontSize: '0.95rem',
    background: 'rgba(255, 255, 255, 0.18)',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    color: '#fff',
  },
  shopAvatar: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: '2px solid rgba(255, 255, 255, 0.55)',
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#0C831F',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.88rem',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  shopLoginBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
    background: '#fff',
    color: '#0C831F',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  shopSupporterRibbon: {
    margin: 0,
    padding: '0.38rem 0.55rem',
    borderRadius: 10,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.22) 0%, rgba(247,206,70,0.35) 50%, rgba(255,255,255,0.18) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontStyle: 'italic',
    fontWeight: 700,
    fontSize: '0.72rem',
    letterSpacing: '0.02em',
    color: '#FFFDF5',
    textAlign: 'center',
    lineHeight: 1.35,
    textShadow: '0 1px 2px rgba(0,0,0,0.12)',
  },
  shopSupporterEm: {
    marginRight: '0.28rem',
    color: '#F7CE46',
    fontStyle: 'normal',
  },
  locationCopy: {
    display: 'grid',
    gap: '0.02rem',
    minWidth: 0,
    flex: '1 1 auto',
  },
  etaChip: {
    flexShrink: 0,
    background: 'var(--highlight)',
    color: '#1A1C1A',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    borderRadius: 7,
    padding: '0.28rem 0.4rem',
    lineHeight: 1.1,
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
  buyerName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.88rem',
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    flexShrink: 0,
  },
  locationEyebrow: {
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'none',
    letterSpacing: '-0.01em',
    fontSize: '0.68rem',
    display: 'block',
  },
  pin: {
    fontSize: '0.85rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  locationValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.95rem',
    color: 'var(--text)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
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
    background: '#fff',
    borderTop: '1px solid var(--border)',
    boxShadow: '0 -6px 20px rgba(16, 24, 40, 0.06)',
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
