import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchMyPay, type AgentPaySummary } from '../api/agentApi';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { formatIsoDateRange } from '@hlm-dates/formatDateRange';
import { isoIstDate, rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
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
  const initial = rangeForReportPreset('month');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<AgentPaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <DateRangePresetBar
        preset={preset}
        from={from}
        to={to}
        onPresetChange={setPreset}
        onFromChange={setFrom}
        onToChange={setTo}
        maxDate={isoIstDate()}
        ariaLabel="Pay period"
      />

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && !data ? <p style={styles.muted}>Loading pay…</p> : null}

      {data ? (
        <>
          <p style={styles.rangeMeta}>{formatIsoDateRange(data.from, data.to)} · IST</p>

          {!data.payEnabled ? (
            <p style={styles.warn}>Pay is not enabled for your account yet — contact your hub.</p>
          ) : null}

          <div style={styles.moneyRow}>
            <div style={styles.moneyCard}>
              <span style={styles.moneyLabel}>Earned</span>
              <strong style={styles.moneyValue}>{money(data.earned)}</strong>
            </div>
            <div style={styles.moneyCard}>
              <span style={styles.moneyLabel}>Paid</span>
              <strong style={styles.moneyValue}>{money(data.paid)}</strong>
            </div>
            <div style={{ ...styles.moneyCard, ...styles.moneyCardDue }}>
              <span style={styles.moneyLabel}>Due</span>
              <strong style={styles.moneyValue}>{money(data.due)}</strong>
            </div>
          </div>

          <p style={styles.rateLine}>
            {data.payableOrders} payable order{data.payableOrders === 1 ? '' : 's'}
            {' · '}
            Pickup {money(data.pickupRate)} · Last mile {money(data.lastMileRate)}
            {data.completedOrderRate > 0 ? ` · Order ${money(data.completedOrderRate)}` : ''}
          </p>

          {data.unpaidOrderCount > 0 ? (
            <>
              <h2 style={styles.sectionTitle}>
                Unpaid trips ({data.unpaidOrderCount})
              </h2>
              {data.unpaidOrders.length < data.unpaidOrderCount ? (
                <p style={styles.muted}>Showing {data.unpaidOrders.length} of {data.unpaidOrderCount}.</p>
              ) : null}
              <ul style={styles.list}>
                {data.unpaidOrders.map((o) => (
                  <li key={o.orderId} style={styles.item}>
                    <span>{o.orderNumber}</span>
                    <strong>{money(o.amount)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={styles.muted}>No unpaid trips in this period.</p>
          )}

          {data.payouts.length > 0 ? (
            <>
              <h2 style={styles.sectionTitle}>Payouts</h2>
              <ul style={styles.list}>
                {data.payouts.map((p) => (
                  <li key={p.settlementId} style={styles.itemStack}>
                    <div style={styles.itemTop}>
                      <strong>{money(p.netAmount)}</strong>
                      <span style={styles.pill}>{statusLabel(p.status)}</span>
                    </div>
                    <p style={styles.itemSub}>
                      {p.periodStart && p.periodEnd ? formatIsoDateRange(p.periodStart, p.periodEnd) : '—'}
                      {' · '}
                      {p.orderCount} order{p.orderCount === 1 ? '' : 's'}
                      {p.paidAt ? ` · Paid ${formatWhen(p.paidAt)}` : ''}
                      {p.transactionReference ? ` · ${p.transactionReference}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={styles.muted}>No payouts recorded in this period.</p>
          )}
        </>
      ) : null}
    </AgentShell>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  warn: {
    margin: '0.35rem 0 0',
    padding: '0.4rem 0.55rem',
    borderRadius: 10,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    fontSize: '0.75rem',
    fontWeight: 650,
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 650 },
  rangeMeta: { margin: '0.35rem 0 0', fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' },
  moneyRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '0.45rem' },
  moneyCard: {
    padding: '0.55rem 0.6rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.12rem',
  },
  moneyCardDue: { borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))', background: 'var(--accent-soft)' },
  moneyLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  moneyValue: { fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' },
  rateLine: { margin: '0.45rem 0 0', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  sectionTitle: { margin: '0.75rem 0 0.35rem', fontSize: '0.82rem', fontWeight: 800 },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.78rem',
  },
  itemStack: {
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.2rem',
  },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' },
  itemSub: { margin: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  pill: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
  },
};
