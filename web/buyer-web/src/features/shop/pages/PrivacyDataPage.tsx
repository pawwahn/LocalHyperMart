import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useShop } from '../hooks/useShop';
import {
  deleteMyAccount,
  fetchMyProfile,
  updateMarketingConsent,
} from '@/features/auth/api/userPrivacyApi';

export function PrivacyDataPage() {
  const { session, logout } = useAuth();
  const { cart } = useShop();
  const navigate = useNavigate();
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    let alive = true;
    void fetchMyProfile(session.accessToken)
      .then((p) => {
        if (alive) setMarketing(Boolean(p.marketingConsent));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load profile');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session?.accessToken]);

  async function onMarketingChange(next: boolean) {
    if (!session?.accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const p = await updateMarketingConsent(session.accessToken, next);
      setMarketing(Boolean(p.marketingConsent));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save preference');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !confirmDelete) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(session.accessToken, password);
      logout();
      navigate('/shop');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell
      title="Privacy & data"
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
    >
      <div style={styles.stack}>
        <p style={styles.lead}>
          Manage marketing consent and account deletion. Order and tax records may be kept after delete, as described
          in the{' '}
          <Link to="/legal/privacy" style={styles.link}>
            Privacy policy
          </Link>
          .
        </p>

        <section style={styles.card}>
          <h2 style={styles.h2}>Marketing</h2>
          <p style={styles.muted}>Promotional SMS/push when we enable that channel. Order alerts are always sent.</p>
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={marketing}
              disabled={loading || busy}
              onChange={(ev) => void onMarketingChange(ev.target.checked)}
            />
            <span>Send me deals and promotions</span>
          </label>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>Open source</h2>
          <p style={styles.muted}>Third-party software notices for this app.</p>
          <Link to="/legal/oss" style={styles.linkBtn}>
            View open source notices
          </Link>
        </section>

        <section style={styles.cardDanger}>
          <h2 style={styles.h2}>Delete account</h2>
          <p style={styles.muted}>
            Permanently disables login and removes saved addresses. Past orders stay for legal and settlement records.
          </p>
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(ev) => setConfirmDelete(ev.target.checked)}
            />
            <span>I understand this cannot be undone</span>
          </label>
          <form style={styles.form} onSubmit={(ev) => void onDeleteSubmit(ev)}>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              style={styles.input}
              disabled={!confirmDelete || busy}
            />
            <button
              type="submit"
              style={styles.deleteBtn}
              disabled={!confirmDelete || !password || busy}
            >
              Delete my account
            </button>
          </form>
        </section>

        {error ? <p style={styles.error}>{error}</p> : null}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.55rem' },
  lead: { margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.4 },
  link: { color: 'var(--accent)', fontWeight: 800 },
  card: {
    padding: '0.75rem 0.8rem',
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    display: 'grid',
    gap: '0.45rem',
  },
  cardDanger: {
    padding: '0.75rem 0.8rem',
    background: 'color-mix(in srgb, var(--danger, #b91c1c) 8%, var(--bg-elevated))',
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--danger, #b91c1c) 35%, var(--border))',
    display: 'grid',
    gap: '0.45rem',
  },
  h2: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700 },
  linkBtn: {
    display: 'inline-block',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  form: { display: 'grid', gap: '0.45rem' },
  input: {
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid var(--border)',
    padding: '0 0.75rem',
    fontSize: '0.88rem',
  },
  deleteBtn: {
    minHeight: 44,
    border: 'none',
    borderRadius: 12,
    background: 'var(--danger, #b91c1c)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: { margin: 0, color: 'var(--danger, #b91c1c)', fontWeight: 700, fontSize: '0.85rem' },
};
