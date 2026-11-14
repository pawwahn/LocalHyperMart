import { Link, useLocation } from 'react-router-dom';
import type { CSSProperties } from 'react';

const TABS = [
  { to: '/payments/lookup', label: 'Order txn lookup' },
  { to: '/payments/gateways', label: 'Gateways' },
] as const;

export function PaymentsSubNav() {
  const { pathname } = useLocation();
  return (
    <nav style={styles.nav} aria-label="Payments sections">
      {TABS.map((tab) => {
        const active = pathname === tab.to || (tab.to === '/payments/lookup' && pathname === '/payments');
        return (
          <Link key={tab.to} to={tab.to} style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    marginBottom: '0.55rem',
  },
  tab: {
    minHeight: 36,
    padding: '0.35rem 0.85rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.82rem',
    textDecoration: 'none',
  },
  tabActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--text-inverse)',
  },
};
