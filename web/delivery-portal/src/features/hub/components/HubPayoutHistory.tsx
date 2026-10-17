import { useState, type CSSProperties } from 'react';
import {
  acknowledgeHubPayout,
  fetchHubPayout,
  reportHubPayoutNotReceived,
  type HubPayout,
} from '../api/hubAccountApi';
import { downloadHubPayoutBill } from '../hubPayoutBill';
import { HubPaymentConfirmDialog } from './HubPaymentConfirmDialog';

function money(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Props = {
  token: string;
  hubName: string;
  payouts: HubPayout[];
  onChanged: () => void;
};

export function HubPayoutHistory({ token, hubName, payouts, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<HubPayout | null>(null);

  async function openBill(settlementId: string) {
    setError(null);
    setBusyId(settlementId);
    try {
      const bill = await fetchHubPayout(token, settlementId);
      downloadHubPayoutBill(bill, hubName);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the bill');
    } finally {
      setBusyId(null);
    }
  }

  async function confirm(settlementId: string) {
    setError(null);
    setBusyId(settlementId);
    try {
      await acknowledgeHubPayout(token, settlementId);
      setNoteFor(null);
      setAsk(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm');
    } finally {
      setBusyId(null);
    }
  }

  async function sendMissing(settlementId: string) {
    setError(null);
    setBusyId(settlementId);
    try {
      await reportHubPayoutNotReceived(token, settlementId, note);
      setNoteFor(null);
      setNote('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not report');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <strong>Payouts from KoyaKart</strong>
        <span style={styles.count}>{payouts.length} in this period</span>
      </div>
      {error && !ask ? <p style={styles.error}>{error}</p> : null}
      {payouts.length === 0 ? (
        <p style={styles.empty}>No payout was paid in these dates.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Paid on</th>
                <th style={styles.th}>Mode / ref</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th}>Bill</th>
                <th style={styles.th}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((row) => {
                const confirmed = Boolean(row.acknowledgedAt);
                const missing = Boolean(row.notReceivedAt) && !confirmed;
                return (
                  <tr key={row.settlementId}>
                    <td style={styles.td}>
                      {(row.periodStart ?? '').slice(0, 10)} – {(row.periodEnd ?? '').slice(0, 10)}
                      <div style={styles.sub}>{row.orderCount} orders</div>
                    </td>
                    <td style={styles.td}>{when(row.recordedAt)}</td>
                    <td style={styles.td}>
                      {row.payoutMethod || '—'}
                      <div style={styles.sub}>{row.reference || 'No reference'}</div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>{money(row.amount)}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.bill}
                        disabled={busyId === row.settlementId}
                        onClick={() => void openBill(row.settlementId)}
                      >
                        {row.invoiceNumber || 'Bill'}
                      </button>
                    </td>
                    <td style={styles.td}>
                      {confirmed ? (
                        <span style={styles.ok}>Confirmed {when(row.acknowledgedAt)}</span>
                      ) : (
                        <div style={styles.actions}>
                          <button
                            type="button"
                            disabled={busyId === row.settlementId || missing}
                            onClick={() => {
                              setError(null);
                              setAsk(row);
                            }}
                            style={missing ? styles.gotItOff : styles.gotIt}
                          >
                            I got it
                          </button>
                          <button
                            type="button"
                            style={missing ? styles.told : styles.miss}
                            onClick={() => {
                              setNoteFor(noteFor === row.settlementId ? null : row.settlementId);
                              setNote('');
                            }}
                          >
                            {missing ? 'Told KoyaKart' : 'Not received'}
                          </button>
                        </div>
                      )}
                      {noteFor === row.settlementId ? (
                        <div style={styles.noteRow}>
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What is missing"
                            style={styles.note}
                          />
                          <button
                            type="button"
                            disabled={busyId === row.settlementId}
                            onClick={() => void sendMissing(row.settlementId)}
                            style={styles.gotIt}
                          >
                            Send
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <HubPaymentConfirmDialog
        open={ask != null}
        title="Confirm you received this"
        hint="Confirm only after this amount is in the hub account."
        amount={Number(ask?.amount ?? 0)}
        paymentDate={(ask?.recordedAt ?? '').slice(0, 10)}
        paymentReference={ask?.reference?.trim() || '—'}
        confirmLabel="I got it"
        busy={ask != null && busyId === ask.settlementId}
        error={ask ? error : null}
        onBack={() => {
          if (busyId) return;
          setAsk(null);
          setError(null);
        }}
        onConfirm={() => {
          if (ask) void confirm(ask.settlementId);
        }}
      />
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    gap: '0.35rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 12,
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' },
  count: { fontSize: '0.68rem', fontWeight: 700, color: '#64748b' },
  empty: { margin: 0, fontSize: '0.75rem', color: '#64748b' },
  error: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.75rem' },
  th: {
    textAlign: 'left',
    fontSize: '0.62rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#64748b',
    padding: '0.2rem 0.35rem',
    whiteSpace: 'nowrap',
  },
  td: { padding: '0.28rem 0.35rem', verticalAlign: 'middle', borderTop: '1px solid #dcfce7', overflowWrap: 'anywhere' },
  sub: { fontSize: '0.68rem', color: '#64748b', lineHeight: 1.25 },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.28rem' },
  bill: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: '#047857',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    whiteSpace: 'nowrap',
  },
  gotIt: {
    height: 26,
    padding: '0 0.55rem',
    border: 'none',
    borderRadius: 999,
    background: '#15803d',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.68rem',
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  gotItOff: {
    height: 26,
    padding: '0 0.55rem',
    border: '1px solid #d1d5db',
    borderRadius: 999,
    background: '#f3f4f6',
    color: '#9ca3af',
    fontWeight: 700,
    fontSize: '0.68rem',
    lineHeight: 1,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
  },
  miss: {
    height: 26,
    padding: '0 0.45rem',
    border: '1px solid #bbf7d0',
    borderRadius: 999,
    background: '#fff',
    color: '#047857',
    fontWeight: 650,
    fontSize: '0.68rem',
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  told: {
    height: 26,
    padding: '0 0.45rem',
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#b45309',
    fontWeight: 700,
    fontSize: '0.68rem',
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ok: { fontSize: '0.68rem', fontWeight: 700, color: '#15803d' },
  noteRow: { display: 'flex', gap: '0.28rem', alignItems: 'center', marginTop: '0.28rem' },
  note: {
    flex: 1,
    minWidth: 0,
    height: 26,
    borderRadius: 8,
    border: '1px solid #bbf7d0',
    padding: '0 0.45rem',
    font: 'inherit',
    fontSize: '0.72rem',
  },
};
