import type { CSSProperties, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';

type Props = {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  children: ReactNode;
};

const NAV = [
  { to: '/hub', label: 'Desk', icon: '🖥️', end: true },
  { to: '/hub/boys', label: 'Boys', icon: '🛵', end: false },
  { to: '/hub/reports', label: 'Reports', icon: '📊', end: false },
] as const;

export function HubShell({ title, subtitle, onRefresh, children }: Props) {
  return (
    <PortalShell
      title={title}
      subtitle={subtitle}
      onRefresh={onRefresh}
      footerNav={
        <nav style={styles.tabbar} aria-label="Hub sections">
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
      }
    >
      {children}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
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
    boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
  },
  tab: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.15rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.4rem 0.25rem',
    minHeight: 'var(--touch-min)',
  },
  tabActive: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.15rem',
    textDecoration: 'none',
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.4rem 0.25rem',
    minHeight: 'var(--touch-min)',
  },
  tabIcon: { fontSize: '1.25rem', lineHeight: 1 },
};
