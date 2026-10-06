import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Card } from '@/shared/ui';
import { fetchHubPaymentSubmissions, type HubPaymentSubmission } from '../api/hubPaymentApi';

type Props = {
  token: string;
  townId: string;
  hubId?: string;
  hubName?: string;
  refreshTick?: number;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

function lineLabel(type: string): string {
  return type === 'FRANCHISE_FEE' ? 'Franchise' : 'COD';
}

function statusStyle(status: string): CSSProperties {
  if (status === 'VERIFIED') {
    return { background: '#ecfdf5', color: '#15803d', borderColor: '#86efac' };
  }
  if (status === 'REJECTED') {
    return { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' };
  }
  return { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' };
}

export function HubPaymentHistoryPanel({ token, townId, hubId, hubName, refreshTick = 0 }: Props) {
  const [rows, setRows] = useState<HubPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED'>('ALL');

  const load = useCallback(async () => {
    if (!token || !townId || !hubId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchHubPaymentSubmissions(token, townId, hubId));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load payment history');
    } finally {
      setLoading(false);
    }
  }, [token, townId, hubId]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  if (!townId || !hubId) {
    return null;
  }

  return (
    <Card padding="sm" style={styles.card}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>Payment history</h2>
          <p style={styles.muted}>
            {hubName ? `${hubName} · ` : ''}
            Hub online payments — pending, confirmed, and rejected.
          </p>
        </div>
        <div style={styles.filters} role="tablist" aria-label="Filter status">
          {(
            [
              ['ALL', 'All'],
              ['PENDING_VERIFICATION', 'Pending'],
              ['VERIFIED', 'Confirmed'],
              ['REJECTED', 'Rejected'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              style={filter === id ? styles.filterOn : styles.filterOff}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p style={styles.muted}>Loading…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {!loading && filtered.length === 0 ? <p style={styles.muted}>No payments in this filter.</p> : null}

      {filtered.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Bank date</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>UTR / ref</th>
                <th style={styles.th}>Lines</th>
                <th style={styles.th}>Hub note</th>
                <th style={styles.th}>Admin / outcome</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.submissionId}>
                  <td style={styles.td}>{formatWhen(row.submittedAt)}</td>
                  <td style={styles.td}>{formatPayDate(row.paymentDate)}</td>
                  <td style={styles.tdNum}>{money(row.totalAmount)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...statusStyle(row.status) }}>{row.statusLabel}</span>
                  </td>
                  <td style={styles.tdMono}>{row.paymentReference}</td>
                  <td style={styles.td}>
                    <ul style={styles.lineList}>
                      {row.lines.map((l) => (
                        <li key={l.lineId}>
                          {lineLabel(l.lineType)} · {money(l.amount)}
                          {l.franchiseLabel ? ` · ${l.franchiseLabel}` : ''}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={styles.td}>{row.hubNotes?.trim() || '—'}</td>
                  <td style={styles.td}>
                    {row.status === 'VERIFIED' ? <>Confirmed {formatWhen(row.verifiedAt)}</> : null}
                    {row.status === 'REJECTED' ? (
                      <>
                        Rejected {formatWhen(row.rejectedAt)}
                        {row.adminNotes ? ` — ${row.adminNotes}` : ''}
                      </>
                    ) : null}
                    {row.status === 'PENDING_VERIFICATION' ? 'Awaiting confirm' : null}
                    {row.adminNotes && row.status === 'VERIFIED' && row.adminNotes.trim() ? (
                      <span style={styles.adminNote}> · {row.adminNotes}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.45rem' },
  head: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' },
  title: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  muted: { margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 650 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  filterOn: {
    border: '1px solid var(--accent)',
    background: 'color-mix(in srgb, var(--accent-soft) 55%, transparent)',
    borderRadius: 999,
    padding: '0.3rem 0.65rem',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  filterOff: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    padding: '0.3rem 0.65rem',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: {
    textAlign: 'left',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.45rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    fontWeight: 600,
    color: 'var(--text-muted)',
    maxWidth: '14rem',
  },
  tdNum: {
    padding: '0.45rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  tdMono: {
    padding: '0.45rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.72rem',
    wordBreak: 'break-all',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.18rem 0.45rem',
    borderRadius: 999,
    border: '1px solid',
  },
  lineList: { margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.15rem' },
  adminNote: { fontWeight: 650 },
};
