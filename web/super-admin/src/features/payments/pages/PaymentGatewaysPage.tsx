import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  fetchPaymentGateways,
  savePaymentGateways,
  type GatewayAdminRow,
  type GatewayId,
} from '../api/paymentGatewaysApi';

const EMPTY: GatewayAdminRow[] = [
  blank('RAZORPAY', 'Razorpay'),
  blank('CASHFREE', 'Cashfree'),
  blank('PHONEPE', 'PhonePe'),
];

function blank(gateway: GatewayId, label: string): GatewayAdminRow {
  return {
    gateway,
    label,
    enabled: false,
    clientId: '',
    clientSecret: '',
    clientVersion: gateway === 'PHONEPE' ? '1' : '',
    webhookSecret: '',
    webhookUsername: '',
    webhookPassword: '',
    environment: gateway === 'RAZORPAY' ? '' : 'sandbox',
  };
}

export function PaymentGatewaysPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [rows, setRows] = useState<GatewayAdminRow[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchPaymentGateways(token);
      setRows(merge(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load payment gateways');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(gateway: GatewayId, change: Partial<GatewayAdminRow>) {
    setSaved('');
    setRows((current) => current.map((row) => (row.gateway === gateway ? { ...row, ...change } : row)));
  }

  async function onSave() {
    if (!token) return;
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const data = await savePaymentGateways(token, rows);
      setRows(merge(data));
      setSaved('Saved. Buyers see a gateway when it is on and both keys are filled.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save payment gateways');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title="Payments" subtitle="Turn gateways on and store their keys" onRefresh={() => void load()}>
      <div style={styles.stack}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {saved ? <Banner tone="success">{saved}</Banner> : null}
        <p style={styles.hint}>
          Keys stay in payment-service. Checkout uses the saved values as soon as you save.
        </p>
        {rows.map((row) => (
          <Card key={row.gateway} padding="sm" style={styles.card}>
            <div style={styles.head}>
              <strong style={styles.name}>{row.label}</strong>
              <button
                type="button"
                style={{ ...styles.toggle, ...(row.enabled ? styles.toggleOn : null) }}
                aria-pressed={row.enabled}
                disabled={loading || saving}
                onClick={() => patch(row.gateway, { enabled: !row.enabled })}
              >
                {row.enabled ? 'On' : 'Off'}
              </button>
              <span style={styles.status}>{statusLabel(row)}</span>
            </div>
            <div style={styles.grid}>
              <TextField
                id={`${row.gateway}-client-id`}
                label={row.gateway === 'RAZORPAY' ? 'Key id' : 'Client id'}
                value={row.clientId}
                autoComplete="off"
                disabled={loading || saving}
                style={styles.input}
                onChange={(e) => patch(row.gateway, { clientId: e.target.value })}
              />
              <TextField
                id={`${row.gateway}-client-secret`}
                label={row.gateway === 'RAZORPAY' ? 'Key secret' : 'Client secret'}
                type="password"
                value={row.clientSecret}
                autoComplete="new-password"
                disabled={loading || saving}
                style={styles.secret}
                onChange={(e) => patch(row.gateway, { clientSecret: e.target.value })}
              />
              {row.gateway === 'RAZORPAY' ? (
                <TextField
                  id="RAZORPAY-webhook-secret"
                  label="Webhook secret"
                  type="password"
                  value={row.webhookSecret}
                  autoComplete="new-password"
                  disabled={loading || saving}
                  style={styles.secret}
                  onChange={(e) => patch(row.gateway, { webhookSecret: e.target.value })}
                />
              ) : null}
              {row.gateway === 'PHONEPE' ? (
                <TextField
                  id="PHONEPE-client-version"
                  label="Version"
                  value={row.clientVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={loading || saving}
                  style={styles.input}
                  onChange={(e) => patch(row.gateway, { clientVersion: e.target.value })}
                />
              ) : null}
              {row.gateway !== 'RAZORPAY' ? (
                <label style={styles.selectLabel} htmlFor={`${row.gateway}-mode`}>
                  <span>Mode</span>
                  <select
                    id={`${row.gateway}-mode`}
                    value={row.environment === 'production' ? 'production' : 'sandbox'}
                    disabled={loading || saving}
                    style={styles.select}
                    onChange={(e) => patch(row.gateway, { environment: e.target.value })}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Live</option>
                  </select>
                </label>
              ) : null}
              {row.gateway === 'PHONEPE' ? (
                <>
                  <TextField
                    id="PHONEPE-webhook-user"
                    label="Webhook user"
                    value={row.webhookUsername}
                    autoComplete="off"
                    disabled={loading || saving}
                    style={styles.input}
                    onChange={(e) => patch(row.gateway, { webhookUsername: e.target.value })}
                  />
                  <TextField
                    id="PHONEPE-webhook-password"
                    label="Webhook password"
                    type="password"
                    value={row.webhookPassword}
                    autoComplete="new-password"
                    disabled={loading || saving}
                    style={styles.secret}
                    onChange={(e) => patch(row.gateway, { webhookPassword: e.target.value })}
                  />
                </>
              ) : null}
            </div>
          </Card>
        ))}
        <Button type="button" onClick={() => void onSave()} disabled={loading || saving} style={styles.save}>
          {saving ? 'Saving…' : 'Save gateways'}
        </Button>
      </div>
    </PortalShell>
  );
}

function merge(data: GatewayAdminRow[]): GatewayAdminRow[] {
  const byId = new Map(data.map((row) => [row.gateway, row]));
  return EMPTY.map((fallback) => {
    const row = byId.get(fallback.gateway);
    if (!row) return fallback;
    return {
      ...fallback,
      ...row,
      gateway: fallback.gateway,
      label: row.label || fallback.label,
      clientId: row.clientId ?? '',
      clientSecret: row.clientSecret ?? '',
      clientVersion: row.clientVersion || fallback.clientVersion,
      webhookSecret: row.webhookSecret ?? '',
      webhookUsername: row.webhookUsername ?? '',
      webhookPassword: row.webhookPassword ?? '',
      environment: row.environment || fallback.environment,
    };
  });
}

function statusLabel(row: GatewayAdminRow): string {
  const hasKeys = row.clientId.trim().length > 0 && row.clientSecret.trim().length > 0;
  if (row.enabled && hasKeys) return 'Buyers can pay here';
  if (row.enabled) return 'On, keys missing';
  return 'Hidden from checkout';
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.45rem', maxWidth: 920 },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  card: { display: 'grid', gap: '0.4rem' },
  head: { display: 'flex', alignItems: 'center', gap: '0.45rem', minHeight: 36 },
  name: { fontSize: '0.95rem' },
  toggle: {
    minHeight: 36,
    minWidth: 52,
    padding: '0 0.7rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  toggleOn: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--text-inverse)',
  },
  status: { marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.78rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  input: { padding: '0.4rem 0.55rem', minHeight: 36, fontSize: '0.88rem' },
  secret: { padding: '0.4rem 3.4rem 0.4rem 0.55rem', minHeight: 36, fontSize: '0.88rem' },
  selectLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
  },
  select: {
    width: '100%',
    minHeight: 36,
    padding: '0.35rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  save: { minHeight: 44, justifySelf: 'start' },
};
