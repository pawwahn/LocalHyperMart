import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemePicker } from '@hlm-theme';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useShop } from '../hooks/useShop';

export function MorePage() {
  const { session, logout } = useAuth();
  const { cart } = useShop();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const rows = useMemo(
    () => [
      { to: '/orders', label: 'Orders', hint: 'Track deliveries' },
      { to: '/addresses', label: 'Saved addresses', hint: 'Edit or delete delivery addresses' },
      { to: '/alerts', label: 'Alerts', hint: 'Order updates' },
      { to: '/wallet', label: 'Wallet', hint: 'Store credit' },
    ],
    [],
  );

  return (
    <PortalShell
      title="More"
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
    >
      <div style={styles.list}>
        {rows.map((row) => (
          <Link key={row.to} to={row.to} style={styles.row}>
            <span>
              <strong style={styles.rowTitle}>{row.label}</strong>
              <span style={styles.rowHint}>{row.hint}</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
        ))}
        <div style={styles.row}>
          <span>
            <strong style={styles.rowTitle}>Theme</strong>
            <span style={styles.rowHint}>Dark / light & color</span>
          </span>
          <ThemePicker compact />
        </div>
        {session ? (
          <button
            type="button"
            style={styles.signOut}
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              logout();
              navigate('/shop');
            }}
          >
            Sign out
          </button>
        ) : (
          <Link to="/login" style={styles.login}>
            Login
          </Link>
        )}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'grid', gap: '0.4rem' },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.7rem 0.8rem',
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    textDecoration: 'none',
    color: 'var(--text)',
    border: 'none',
    minHeight: 48,
  },
  rowTitle: { display: 'block', fontSize: '0.92rem', fontWeight: 800 },
  rowHint: { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  signOut: {
    marginTop: '0.35rem',
    minHeight: 44,
    border: 'none',
    borderRadius: 14,
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  login: {
    marginTop: '0.35rem',
    minHeight: 44,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 14,
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    textDecoration: 'none',
  },
};
