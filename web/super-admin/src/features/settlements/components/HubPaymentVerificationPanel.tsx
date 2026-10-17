import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Card, Button, ConfirmDialog } from '@/shared/ui';
import {
  fetchHubPaymentSubmissions,
  isFranchiseOnlySubmission,
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
  scope?: 'cod' | 'franchise';
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

export function HubPaymentVerificationPanel({
  token,
  townId,
  hubId,
  refreshTick = 0,
  onReviewed,
  scope = 'cod',
}: Props) {
  const [rows, setRows] = useState<HubPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<{ kind: 'verify' | 'reject'; row: HubPaymentSubmission } | null>(null);

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

  const pending = rows.filter(
    (r) =>
      r.status === 'PENDING_VERIFICATION' &&
      (scope === 'franchise' ? isFranchiseOnlySubmission(r) : !isFranchiseOnlySubmission(r)),
  );

  async function verify(id: string) {
    setBusyId(id);
    try {
      await verifyHubPaymentSubmission(token, id);
      setAsk(null);
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
      setAsk(null);
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
      <h2 style={styles.title}>To confirm</h2>
      {loading ? <p style={styles.muted}>Loading…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {pending.length === 0 && !loading ? <p style={styles.muted}>None waiting.</p> : null}
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
            <Button size="sm" disabled={busyId === row.submissionId} onClick={() => setAsk({ kind: 'verify', row })}>
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
              onClick={() => {
                const notes = (rejectNotes[row.submissionId] ?? '').trim();
                if (!notes) {
                  setError('Rejection reason is required');
                  return;
                }
                setError(null);
                setAsk({ kind: 'reject', row });
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={ask != null}
        title={ask?.kind === 'reject' ? 'Reject this payment?' : 'Confirm this payment?'}
        description={
          ask ? (
            <span style={styles.askBody}>
              <strong>{money(ask.row.totalAmount)}</strong>
              <span>
                Paid {ask.row.paymentDate} · UTR {ask.row.paymentReference}
              </span>
              <span>
                {ask.kind === 'reject'
                  ? `Reason: ${(rejectNotes[ask.row.submissionId] ?? '').trim()}`
                  : 'Check this credit is in the KoyaKart account before confirming.'}
              </span>
            </span>
          ) : (
            ''
          )
        }
        confirmLabel={ask?.kind === 'reject' ? 'Yes, reject' : 'Yes, received'}
        danger={ask?.kind === 'reject'}
        busy={busyId != null}
        onConfirm={() => {
          if (!ask) return;
          if (ask.kind === 'reject') void reject(ask.row.submissionId);
          else void verify(ask.row.submissionId);
        }}
        onClose={() => {
          if (!busyId) setAsk(null);
        }}
      />
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
  askBody: { display: 'grid', gap: '0.2rem', fontSize: '0.82rem', fontWeight: 650 },
  rejectInput: {
    flex: '1 1 10rem',
    font: 'inherit',
    fontSize: '0.78rem',
    padding: '0.28rem 0.4rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
};
