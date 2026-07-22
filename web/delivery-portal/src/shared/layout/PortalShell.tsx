import type { CSSProperties, ReactNode } from 'react';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
  /** Fixed bottom tab bar (Desk / Reports, agent tabs, etc.) */
  footerNav?: ReactNode;
};

export function PortalShell({ title, subtitle, children, onRefresh, footerNav }: Props) {
  const { session, logout } = useAuth();
  const isMobile = useIsMobile();
  const roleLabel =
    session?.portalRole === 'DELIVERY_AGENT'
      ? 'Agent'
      : session?.portalRole === 'HUB_ADMIN'
        ? 'Hub admin'
        : 'Delivery';

  return (
    <div
      style={{
        ...styles.page,
        paddingBottom: footerNav
          ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 1rem)'
          : '2.5rem',
        maxWidth: isMobile ? '100%' : 'var(--shell-max)',
      }}
    >
      <header style={isMobile ? styles.headerMobile : styles.header}>
        <div style={styles.headerText}>
          <p style={styles.brand}>HyperLocalMart · Delivery</p>
          <h1 style={isMobile ? styles.titleMobile : styles.title}>{title}</h1>
          <p style={styles.sub}>
            {roleLabel} · {session?.phone ?? '—'}
          </p>
          {subtitle ? <p style={styles.context}>{subtitle}</p> : null}
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
      <main style={styles.main}>{children}</main>
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
  headerText: { minWidth: 0, flex: 1 },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--accent)',
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
  sub: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  context: { margin: '0.1rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' },
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
};
