import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { resolveTownDisplayName } from '@/features/towns/api/townsApi';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
  /** Fixed bottom tab bar (Desk / Reports, agent tabs, etc.) */
  footerNav?: ReactNode;
  /** Tighter header for ride/ops screens (agent). */
  dense?: boolean;
};

/** Short place for one-line mobile chrome (drop long state suffix). */
function shortPlace(place: string | null | undefined): string | null {
  if (!place) return null;
  const cleaned = place.replace(/,\s*Andhra Pradesh$/i, '').trim();
  return cleaned || place;
}

export function PortalShell({ title, subtitle, children, onRefresh, footerNav, dense = false }: Props) {
  const { session, logout } = useAuth();
  const isMobile = useIsMobile();
  const [townName, setTownName] = useState<string | null>(session?.townName ?? null);
  const roleLabel =
    session?.portalRole === 'DELIVERY_AGENT'
      ? 'Agent'
      : session?.portalRole === 'HUB_ADMIN'
        ? 'Hub admin'
        : 'Delivery';

  const townId = session?.townId;
  const sessionTownName = session?.townName;

  useEffect(() => {
    if (sessionTownName) {
      setTownName(sessionTownName);
      return;
    }
    if (!townId) return;
    let cancelled = false;
    void resolveTownDisplayName(townId)
      .then((name) => {
        if (cancelled || !name) return;
        setTownName(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [townId, sessionTownName]);

  const placeLabel = townName || session?.hubName || null;
  const placeShort = shortPlace(placeLabel);
  const phone = session?.phone ?? '—';

  const identityParts = [roleLabel, placeLabel, phone].filter(Boolean);
  const identityDesktop = identityParts.join(' · ');
  const identityMobile = [placeShort, phone].filter(Boolean).join(' · ');

  const identityText = identityParts.join(' · ').toLowerCase();
  const subtitleTrimmed = subtitle?.trim() || '';
  const showSubtitle =
    Boolean(subtitleTrimmed) &&
    subtitleTrimmed.toLowerCase() !== (session?.hubName ?? '').toLowerCase() &&
    subtitleTrimmed.toLowerCase() !== (townName ?? '').toLowerCase() &&
    !identityText.includes(subtitleTrimmed.toLowerCase());

  const denseMobile = dense && isMobile;

  return (
    <div
      style={{
        ...styles.page,
        ...(dense ? (isMobile ? styles.pageDenseMobile : styles.pageDense) : null),
        paddingBottom: footerNav
          ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
          : '2.5rem',
        maxWidth: isMobile ? '100%' : 'var(--shell-max)',
      }}
    >
      {denseMobile ? (
        <header style={styles.appBar}>
          <div style={styles.appBarTop}>
            <div style={styles.appBarTitleBlock}>
              <p style={styles.appBarBrand}>HyperLocalMart</p>
              <h1 style={styles.appBarTitle}>{title}</h1>
            </div>
            <div style={styles.appBarActions}>
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
          </div>
          <p style={styles.appBarMeta} title={identityDesktop}>
            {identityMobile}
          </p>
          {showSubtitle ? (
            <p style={styles.appBarFlow} title={subtitleTrimmed}>
              {subtitleTrimmed}
            </p>
          ) : null}
        </header>
      ) : (
        <header
          style={
            dense
              ? styles.headerDense
              : isMobile
                ? styles.headerMobile
                : styles.header
          }
        >
          <div style={styles.headerText}>
            <p style={dense ? styles.brandDense : styles.brand}>HyperLocalMart · Delivery</p>
            <h1 style={dense ? styles.titleDense : isMobile ? styles.titleMobile : styles.title}>
              {title}
            </h1>
            <p style={dense ? styles.subDense : styles.sub}>{identityDesktop}</p>
            {showSubtitle ? (
              <p style={dense ? styles.flowChip : styles.context} title={subtitleTrimmed}>
                {subtitleTrimmed}
              </p>
            ) : null}
          </div>
          <div style={styles.actions}>
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
      )}
      <main style={dense ? styles.mainDense : styles.main}>{children}</main>
      {footerNav}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: '100%',
    margin: '0 auto',
    padding: '1rem 1rem 0',
    display: 'grid',
    gap: '0.85rem',
    minHeight: '100dvh',
    alignContent: 'start',
  },
  pageDense: {
    padding: '0.65rem 0.75rem 0',
    gap: '0.55rem',
  },
  pageDenseMobile: {
    padding: '0 0 0',
    gap: 0,
  },
  appBar: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    background: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border)',
    padding: '0.45rem 0.75rem 0.55rem',
    paddingTop: 'max(0.45rem, env(safe-area-inset-top, 0px))',
    display: 'grid',
    gap: '0.2rem',
    boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
  },
  appBarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  appBarTitleBlock: {
    minWidth: 0,
    flex: 1,
  },
  appBarBrand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '0.02em',
    lineHeight: 1.1,
  },
  appBarTitle: {
    margin: '0.05rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  appBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
    flexShrink: 0,
  },
  appBarMeta: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 650,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  appBarFlow: {
    margin: '0.15rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 650,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
    flexWrap: 'wrap',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '0.85rem 1rem',
    boxShadow: 'var(--shadow-card)',
    position: 'relative',
    zIndex: 30,
    overflow: 'visible',
  },
  headerMobile: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.65rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '0.75rem 0.85rem',
    boxShadow: 'var(--shadow-card)',
    position: 'sticky',
    top: 0,
    zIndex: 30,
    overflow: 'visible',
  },
  headerDense: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.55rem 0.7rem',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    position: 'relative',
    zIndex: 30,
  },
  headerText: { minWidth: 0, flex: 1 },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  brandDense: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '0.01em',
  },
  title: {
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.35rem, 3vw, 1.7rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  titleMobile: {
    margin: '0.1rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.28rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  titleDense: {
    margin: '0.05rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  sub: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  subDense: {
    margin: '0.1rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  context: { margin: '0.1rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' },
  flowChip: {
    margin: '0.35rem 0 0',
    display: 'inline-block',
    maxWidth: '100%',
    padding: '0.28rem 0.55rem',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    color: 'var(--text)',
    fontSize: '0.68rem',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  main: {
    display: 'grid',
    gap: '0.75rem',
    width: '100%',
    minWidth: 0,
    alignContent: 'start',
    alignItems: 'stretch',
  },
  mainDense: {
    display: 'grid',
    gap: '0.55rem',
    width: '100%',
    minWidth: 0,
    alignContent: 'start',
    alignItems: 'stretch',
    padding: '0.65rem 0.75rem 0',
  },
};
