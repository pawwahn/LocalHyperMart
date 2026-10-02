import type { CSSProperties, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAgentKind } from '../hooks/useAgentKind';

type Props = {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  children: ReactNode;
};

const HUB_NAV = [
  { to: '/agent', label: 'Home', icon: '🏠', end: true },
  { to: '/agent/pickups', label: 'From shop', icon: '🛍️', end: false },
  { to: '/agent/deliveries', label: 'To home', icon: '🛵', end: false },
  { to: '/agent/cod-handover', label: 'COD', icon: '💵', end: false },
  { to: '/agent/history', label: 'Done', icon: '✅', end: false },
  { to: '/agent/pay', label: 'Pay', icon: '₹', end: false },
] as const;

const VENDOR_NAV = [
  { to: '/agent', label: 'Home', icon: '🏠', end: true },
  { to: '/agent/deliveries', label: 'Deliveries', icon: '🛵', end: false },
  { to: '/agent/cod-handover', label: 'COD', icon: '💵', end: false },
  { to: '/agent/history', label: 'Done', icon: '✅', end: false },
  { to: '/agent/pay', label: 'Pay', icon: '₹', end: false },
] as const;

export function AgentShell({ title, subtitle, onRefresh, children }: Props) {
  const { vendorShop } = useAgentKind();
  const nav = vendorShop ? VENDOR_NAV : HUB_NAV;
  return (
    <PortalShell
      title={title}
      subtitle={subtitle}
      onRefresh={onRefresh}
      dense
      footerNav={
        <nav
          style={{
            ...styles.tabbar,
            ...(vendorShop
              ? { ['--agent-tab-cols' as string]: 'repeat(5, 1fr)' }
              : { ['--agent-tab-cols' as string]: 'repeat(6, 1fr)' }),
          }}
          aria-label="Agent work"
        >
          {nav.map((item) => (
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
      <div
        aria-hidden
        style={{ height: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 2.75rem)', flexShrink: 0 }}
      />
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
    gridTemplateColumns: 'var(--agent-tab-cols, repeat(5, 1fr))',
    background: 'var(--bg-elevated)',
    borderTop: '1px solid var(--border)',
    zIndex: 50,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
  },
  tab: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.35rem 0.15rem',
    minHeight: 'var(--touch-min)',
    textAlign: 'center',
  },
  tabActive: {
    display: 'grid',
    placeItems: 'center',
    gap: '0.1rem',
    textDecoration: 'none',
    color: 'var(--accent)',
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '0.35rem 0.15rem',
    minHeight: 'var(--touch-min)',
    textAlign: 'center',
  },
  tabIcon: { fontSize: '1.2rem', lineHeight: 1 },
};
