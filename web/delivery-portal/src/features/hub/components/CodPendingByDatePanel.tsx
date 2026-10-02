import { useMemo, type CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { CodCustodianPendingDetail } from '../api/codApi';

type Props = {
  data: CodCustodianPendingDetail | null;
  loading?: boolean;
  custodianLabel: string;
  /** When set, only this IST day (YYYY-MM-DD) is shown. Totals stay all-dates. */
  filterDate?: string | null;
};

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function formatDayHeading(dateKey: string): string {
  if (dateKey === 'unknown') return 'Delivery date unknown';
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(at?: string | null): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

type Row = {
  key: string;
  agentName: string;
  orderNumber: string;
  amount: number;
  status: 'With agent' | 'Declared';
  deliveredTime?: string;
};

export function CodPendingByDatePanel({ data, loading, custodianLabel, filterDate }: Props) {
  const days = useMemo(() => {
    if (!data?.days) return [];
    if (!filterDate) return data.days;
    return data.days.filter((d) => d.date === filterDate);
  }, [data, filterDate]);

  const hasAny = (data?.ordersStillWithAgents ?? 0) > 0 || (data?.handoversAwaitingConfirm ?? 0) > 0;

  if (loading) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>Pending COD (all dates)</p>
        <p style={styles.muted}>Loading…</p>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card style={styles.card}>
      <p style={styles.title}>Pending COD (all dates)</p>
      <p style={styles.lead}>
        Hub-route COD for {custodianLabel} · {data.lookbackFrom} → {data.lookbackTo} (IST). Grouped by day, then agent
        and order.
      </p>

      <div style={styles.summaryBlock}>
        <p style={styles.summaryLabel}>Total pending</p>
        <p style={styles.summaryAmount}>{money(data.totalStillWithAgents + data.totalDeclaredAwaitingConfirm)}</p>
        <div style={styles.splitRow}>
          <span style={styles.chip}>
            With agents <strong>{money(data.totalStillWithAgents)}</strong> · {data.ordersStillWithAgents} order(s)
          </span>
          <span style={{ ...styles.chip, ...styles.chipGreen }}>
            Declared — confirm <strong>{money(data.totalDeclaredAwaitingConfirm)}</strong> ·{' '}
            {data.handoversAwaitingConfirm} handover(s)
          </span>
        </div>
      </div>

      {filterDate ? (
        <p style={styles.filterNote}>
          Showing day <strong>{filterDate}</strong> only · clear date filter above to see all days
        </p>
      ) : null}

      {!hasAny ? (
        <p style={styles.muted}>No pending hub COD in this window — all remitted or nothing delivered yet.</p>
      ) : days.length === 0 ? (
        <p style={styles.muted}>No pending COD on {filterDate}.</p>
      ) : (
        days.map((day) => {
          const rows: Row[] = [];
          for (const agent of day.agents) {
            for (const o of agent.stillWithAgentOrders) {
              rows.push({
                key: `s-${o.orderId}`,
                agentName: agent.agentName || 'Agent',
                orderNumber: o.orderNumber,
                amount: Number(o.collectAmount ?? 0),
                status: 'With agent',
                deliveredTime: formatTime(o.deliveredAt),
              });
            }
            for (const h of agent.declaredAwaiting) {
              for (const line of h.lines) {
                rows.push({
                  key: `d-${h.handoverId}-${line.orderId}`,
                  agentName: agent.agentName || h.agentName || 'Agent',
                  orderNumber: line.orderNumber,
                  amount: Number(line.collectAmount ?? 0),
                  status: 'Declared',
                });
              }
            }
          }

          return (
            <section key={day.date} style={styles.daySection}>
              <div style={styles.dayHead}>
                <h3 style={styles.dayTitle}>{formatDayHeading(day.date)}</h3>
                <p style={styles.dayMeta}>
                  {money(day.stillWithAgentsAmount + day.declaredAwaitingAmount)} ·{' '}
                  {day.stillWithAgentsOrderCount + day.declaredAwaitingOrderCount} order(s)
                </p>
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Agent</th>
                      <th style={styles.th}>Order</th>
                      <th style={styles.thRight}>Amount</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.thRight}>Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td style={styles.td}>{r.agentName}</td>
                        <td style={styles.tdStrong}>{r.orderNumber}</td>
                        <td style={styles.tdRight}>{money(r.amount)}</td>
                        <td style={styles.td}>
                          <span style={r.status === 'Declared' ? styles.badgeDeclared : styles.badgeWithAgent}>
                            {r.status}
                          </span>
                        </td>
                        <td style={styles.tdRightMuted}>{r.deliveredTime ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.65rem 0.75rem', display: 'grid', gap: '0.55rem' },
  title: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  lead: { margin: 0, fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-muted)', fontWeight: 650 },
  muted: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 650 },
  summaryBlock: {
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: '#fffbeb',
    border: '1px solid #fbbf24',
    display: 'grid',
    gap: '0.25rem',
  },
  summaryLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#92400e' },
  summaryAmount: {
    margin: 0,
    fontSize: '1.65rem',
    fontWeight: 900,
    color: '#92400e',
    fontVariantNumeric: 'tabular-nums',
  },
  splitRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  chip: {
    fontSize: '0.72rem',
    fontWeight: 650,
    padding: '0.2rem 0.4rem',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.6)',
  },
  chipGreen: { background: '#ecfdf5' },
  filterNote: { margin: 0, fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-muted)' },
  daySection: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  dayHead: {
    padding: '0.45rem 0.55rem',
    background: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  dayTitle: { margin: 0, fontSize: '0.88rem', fontWeight: 800 },
  dayMeta: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  thRight: { textAlign: 'right', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.35rem 0.45rem', verticalAlign: 'top' },
  tdStrong: { padding: '0.35rem 0.45rem', fontWeight: 800, verticalAlign: 'top' },
  tdRight: {
    padding: '0.35rem 0.45rem',
    textAlign: 'right',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  tdRightMuted: {
    padding: '0.35rem 0.45rem',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    verticalAlign: 'top',
  },
  badgeWithAgent: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
  badgeDeclared: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: '#ecfdf5',
    border: '1px solid #6ee7b7',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
};
