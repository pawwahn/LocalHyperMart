import type { CSSProperties, ReactNode } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { Button } from '@/shared/ui';

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
          {onRefresh ? (
            <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh">
              {isMobile ? '↻' : 'Refresh'}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={logout}>
            {isMobile ? 'Out' : 'Sign out'}
          </Button>
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
    gap: '1rem',
    minHeight: '100dvh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '1rem 1.15rem',
    boxShadow: 'var(--shadow-card)',
  },
  headerMobile: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.65rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '0.85rem 0.95rem',
    boxShadow: 'var(--shadow-card)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  headerText: { minWidth: 0, flex: 1 },
  brand: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.88rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  title: {
    margin: '0.2rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.45rem, 3vw, 1.9rem)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  titleMobile: {
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  sub: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  context: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' },
  actions: { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  main: { display: 'grid', gap: '1rem', width: '100%', minWidth: 0 },
};
