import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Card, Button } from '@/shared/ui';
import {
  fetchHubPaymentSubmissions,
  rejectHubPaymentSubmission,
  verifyHubPaymentSubmission,
  type HubPaymentSubmission,
} from '../api/hubPaymentApi';

type Props = {
  token: string;
  townId: string;
  hubId?: string;
  refreshTick?: number;
  onReviewed?: () => void;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

export function HubPaymentVerificationPanel({ token, townId, hubId, refreshTick = 0, onReviewed }: Props) {
  const [rows, setRows] = useState<HubPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token || !townId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchHubPaymentSubmissions(token, townId, hubId));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load hub payments');
    } finally {
      setLoading(false);
    }
  }, [token, townId, hubId]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const pending = rows.filter((r) => r.status === 'PENDING_VERIFICATION');

  async function verify(id: string) {
    setBusyId(id);
    try {
      await verifyHubPaymentSubmission(token, id);
      onReviewed?.();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const notes = (rejectNotes[id] ?? '').trim();
    if (!notes) {
      setError('Rejection reason is required');
      return;
    }
    setBusyId(id);
    try {
      await rejectHubPaymentSubmission(token, id, notes);
      onReviewed?.();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!townId || !hubId) {
    return null;
  }

  return (
    <Card padding="sm" style={styles.card}>
      <h2 style={styles.title}>Awaiting your confirmation</h2>
      <p style={styles.muted}>
        Hub paid online (UPI/NEFT). Confirm only if the bank credit matches each line to the paisa.
      </p>
      {loading ? <p style={styles.muted}>Loading…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {pending.length === 0 && !loading ? <p style={styles.muted}>No payments awaiting verification for this hub.</p> : null}
      {pending.map((row) => (
        <div key={row.submissionId} style={styles.row}>
          <div style={styles.rowHead}>
            <strong>{money(row.totalAmount)}</strong>
            <span style={styles.badge}>{row.statusLabel}</span>
          </div>
          <p style={styles.meta}>
            Paid {row.paymentDate} · ref <strong>{row.paymentReference}</strong>
            {row.hubNotes ? ` · ${row.hubNotes}` : ''}
          </p>
          <ul style={styles.lines}>
            {row.lines.map((l) => (
              <li key={l.lineId}>
                {l.lineType === 'FRANCHISE_FEE' ? 'Franchise' : 'COD'} · {money(l.amount)}
                {l.franchiseLabel ? ` · ${l.franchiseLabel}` : ''}
              </li>
            ))}
          </ul>
          <div style={styles.actions}>
            <Button size="sm" disabled={busyId === row.submissionId} onClick={() => void verify(row.submissionId)}>
              Confirm received
            </Button>
            <input
              style={styles.rejectInput}
              placeholder="Reason if rejecting"
              value={rejectNotes[row.submissionId] ?? ''}
              onChange={(e) => setRejectNotes((m) => ({ ...m, [row.submissionId]: e.target.value }))}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === row.submissionId}
              onClick={() => void reject(row.submissionId)}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.45rem' },
  title: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 650 },
  row: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.45rem 0.55rem',
    display: 'grid',
    gap: '0.25rem',
    background: 'var(--bg-elevated)',
  },
  rowHead: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  badge: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, #fef3c7 55%, transparent)',
    color: '#92400e',
  },
  meta: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  lines: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.72rem', color: 'var(--text-muted)' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  rejectInput: {
    flex: '1 1 10rem',
    font: 'inherit',
    fontSize: '0.78rem',
    padding: '0.28rem 0.4rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
};
