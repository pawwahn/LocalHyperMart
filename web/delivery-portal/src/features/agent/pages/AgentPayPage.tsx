import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchMyPay, type AgentPaySummary } from '../api/agentApi';

type Preset = 'today' | '7d' | 'month' | 'lastMonth' | 'custom';

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function shiftIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function monthBounds(offset: number): { from: string; to: string } {
  const [y, m] = todayIso().split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): string {
  if (status === 'PAID') return 'Paid';
  if (status === 'FINALIZED') return 'Ready';
  if (status === 'DRAFT') return 'Draft';
  return status.replaceAll('_', ' ') || '—';
}

export function AgentPayPage() {
  const { session } = useAuth();
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(() => monthBounds(0).from);
  const [to, setTo] = useState(todayIso);
  const [data, setData] = useState<AgentPaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((next: Preset) => {
    setPreset(next);
    if (next === 'today') {
      const t = todayIso();
      setFrom(t);
      setTo(t);
    } else if (next === '7d') {
      setFrom(shiftIso(-6));
      setTo(todayIso());
    } else if (next === 'month') {
      const b = monthBounds(0);
      setFrom(b.from);
      setTo(todayIso());
    } else if (next === 'lastMonth') {
      const b = monthBounds(-1);
      setFrom(b.from);
      setTo(b.to);
    }
  }, []);

  function setCustomDate(which: 'from' | 'to', value: string) {
    if (!value) return;
    setPreset('custom');
    if (which === 'from') {
      setFrom(value);
      setTo((prev) => (prev && value > prev ? value : prev));
    } else {
      setTo(value);
      setFrom((prev) => (prev && value < prev ? value : prev));
    }
  }

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMyPay(session.accessToken, from, to));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load pay');
    } finally {
      setLoading(false);
    }
  }, [session, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AgentShell title="Your pay" subtitle="Earned vs paid for delivered orders" onRefresh={() => void load()}>
      <div style={styles.range} role="tablist" aria-label="Pay period">
        {([
          ['today', 'Today'],
          ['7d', '7 days'],
          ['month', 'This month'],
          ['lastMonth', 'Last month'],
          ['custom', 'Custom'],
        ] as Array<[Preset, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={preset === id}
            style={preset === id ? styles.rangeOn : styles.rangeOff}
            onClick={() => applyPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div style={styles.customRow}>
          <label style={styles.dateField}>
            From
            <input
              type="date"
              value={from}
              max={to || todayIso()}
              onChange={(e) => setCustomDate('from', e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={styles.dateField}>
            To
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => setCustomDate('to', e.target.value)}
              style={styles.dateInput}
            />
          </label>
        </div>
      ) : null}

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && !data ? <p style={styles.muted}>Loading pay…</p> : null}

      {data ? (
        <>
          <div style={styles.moneyRow}>
            <MoneyChip label="Earned" value={money(data.earned)} tone="plain" />
            <MoneyChip label="Paid" value={money(data.paid)} tone="ok" />
            <MoneyChip label="Due" value={money(data.due)} tone="warn" />
          </div>
          <p style={styles.meta}>
            {(data.yourDeliveries ?? data.payableOrders)} delivery
            {(data.yourDeliveries ?? data.payableOrders) === 1 ? '' : 'ies'} by you in{' '}
            {data.from === data.to ? data.from : `${data.from} → ${data.to}`}
            {data.payableOrders > 0 ? ` · ${data.payableOrders} payable` : ''}
            {data.unpaidOrderCount > 0 ? ` · ${data.unpaidOrderCount} unpaid` : ''}
          </p>
          <p style={styles.rates}>
            {!data.payEnabled
              ? data.payModel === 'VENDOR_SHOP'
                ? 'Shop delivery pay is off for this town — enable it in Super Admin → Towns → Vendor delivery'
                : 'Per-order pay is off for this town'
              : data.payModel === 'VENDOR_SHOP'
                ? `Shop delivery · ${money(data.vendorDirectOrderRate ?? 0)} per delivered order`
                : `Rates · pickup ${money(data.pickupRate)} · home ${money(data.lastMileRate)} · order ${money(data.completedOrderRate)}`}
          </p>

          <h3 style={styles.h3}>Awaiting payout</h3>
          {data.unpaidOrders.length === 0 ? (
            <p style={styles.muted}>No unpaid delivered orders in this range.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Order</th>
                    <th style={styles.th}>When</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unpaidOrders.map((row) => (
                    <tr key={row.orderId}>
                      <td style={styles.tdStrong}>{row.orderNumber}</td>
                      <td style={styles.tdMuted}>{formatWhen(row.deliveredAt)}</td>
                      <td style={styles.tdAmt}>{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={styles.h3}>Payouts</h3>
          {data.payouts.length === 0 ? (
            <p style={styles.muted}>No payouts recorded in this range.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Period</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((row) => (
                    <tr key={row.settlementId}>
                      <td style={styles.td}>
                        <div style={styles.tdStrong}>
                          {row.periodStart && row.periodEnd ? `${row.periodStart} → ${row.periodEnd}` : '—'}
                        </div>
                        <div style={styles.tdMuted}>
                          {row.orderCount} order{row.orderCount === 1 ? '' : 's'}
                          {row.payoutMethod ? ` · ${row.payoutMethod}` : ''}
                          {row.transactionReference ? ` · ${row.transactionReference}` : ''}
                          {row.paidAt ? ` · ${formatWhen(row.paidAt)}` : ''}
                        </div>
                      </td>
                      <td style={styles.td}>{statusLabel(row.status)}</td>
                      <td style={styles.tdAmt}>{money(row.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </AgentShell>
  );
}

function MoneyChip({ label, value, tone }: { label: string; value: string; tone: 'plain' | 'ok' | 'warn' }) {
  return (
    <div
      style={{
        ...styles.chip,
        background: tone === 'ok' ? 'var(--success-soft)' : tone === 'warn' ? 'var(--warning-soft)' : 'var(--bg)',
      }}
    >
      <span style={styles.chipLabel}>{label}</span>
      <span style={styles.chipVal}>{value}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  range: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 3,
    padding: 3,
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  customRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  dateField: {
    display: 'grid',
    gap: 2,
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
  },
  dateInput: {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 44,
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    font: 'inherit',
    fontWeight: 700,
  },
  rangeOff: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.75rem',
    minHeight: 40,
    borderRadius: 8,
    cursor: 'pointer',
  },
  rangeOn: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.75rem',
    minHeight: 40,
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
  },
  moneyRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' },
  chip: {
    display: 'grid',
    gap: 2,
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
  },
  chipLabel: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  chipVal: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' },
  meta: { margin: 0, fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-muted)' },
  rates: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' },
  h3: { margin: '0.25rem 0 0', fontSize: '0.82rem', fontWeight: 800 },
  tableWrap: { overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: {
    textAlign: 'left',
    padding: '0.35rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    background: 'var(--bg)',
  },
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdStrong: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  tdMuted: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 650,
    whiteSpace: 'nowrap',
  },
  tdAmt: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.82rem' },
};
