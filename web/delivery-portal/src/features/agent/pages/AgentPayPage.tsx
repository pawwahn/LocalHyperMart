import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  acknowledgeMyPayout,
  fetchMyPay,
  reportMyPayoutNotReceived,
  type AgentPaySummary,
} from '../api/agentApi';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { formatIsoDateRange } from '@hlm-dates/formatDateRange';
import { DEFAULT_REPORT_DATE_PRESET, isoIstDate, rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';
import { downloadAgentPayoutStatement } from '../agentPayoutStatement';

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
  const initial = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
  const [preset, setPreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<AgentPaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

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

  async function confirmPayout(settlementId: string) {
    if (!session) return;
    setBusyId(settlementId);
    setError(null);
    try {
      await acknowledgeMyPayout(session.accessToken, settlementId);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not confirm');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectPayout(settlementId: string) {
    if (!session || !rejectNote.trim()) return;
    setBusyId(settlementId);
    setError(null);
    try {
      await reportMyPayoutNotReceived(session.accessToken, settlementId, rejectNote.trim());
      setRejectId(null);
      setRejectNote('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not send it back');
    } finally {
      setBusyId(null);
    }
  }

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

          {(data.payerNotices ?? []).length > 0 ? (
            <div style={styles.notice}>
              {(data.payerNotices ?? []).map((n) => (
                <p key={n.settlementId} style={styles.noticeLine}>
                  Not received{n.reference ? ` · ${n.reference}` : ''}: {n.comment}
                </p>
              ))}
            </div>
          ) : null}

          <h2 style={styles.sectionTitle}>Payment history ({data.payouts.length})</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Period</th>
                  <th style={styles.thRight}>Orders</th>
                  <th style={styles.th}>Paid on</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.th}>Ref</th>
                  <th style={styles.thRight}>You get</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={8}>No payouts in this period.</td>
                  </tr>
                ) : data.payouts.map((p) => {
                  const paid = p.status === 'PAID';
                  const confirmed = Boolean(p.acknowledgedAt);
                  const sentBack = Boolean(p.notReceivedAt) && !confirmed;
                  return (
                    <Fragment key={p.settlementId}>
                      <tr>
                        <td style={styles.td}>
                          {p.periodStart && p.periodEnd ? formatIsoDateRange(p.periodStart, p.periodEnd) : '—'}
                        </td>
                        <td style={styles.tdRight}>{p.orderCount}</td>
                        <td style={styles.td}>{p.paidAt ? formatWhen(p.paidAt) : '—'}</td>
                        <td style={styles.td}>{p.payoutMethod || '—'}</td>
                        <td style={styles.td}>{p.transactionReference || '—'}</td>
                        <td style={styles.tdRight}>{money(p.netAmount)}</td>
                        <td style={styles.td}>
                          <span style={confirmed ? styles.pillOk : sentBack ? styles.pillWarn : styles.pill}>
                            {confirmed ? 'Confirmed' : sentBack ? 'Sent back' : statusLabel(p.status)}
                          </span>
                          {confirmed ? <div style={styles.sub}>{formatWhen(p.acknowledgedAt)}</div> : null}
                          {sentBack && p.notReceivedNote ? <div style={styles.sub}>{p.notReceivedNote}</div> : null}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actions}>
                            <button
                              type="button"
                              style={styles.ghost}
                              onClick={() => downloadAgentPayoutStatement({
                                settlementId: p.settlementId,
                                agentName: data.agentName,
                                periodStart: p.periodStart,
                                periodEnd: p.periodEnd,
                                orderCount: p.orderCount,
                                netAmount: p.netAmount,
                                payoutMethod: p.payoutMethod,
                                transactionReference: p.transactionReference,
                                paidAt: p.paidAt,
                                status: confirmed ? 'Confirmed' : sentBack ? 'Sent back' : p.status,
                              })}
                            >
                              Statement
                            </button>
                            {paid && !confirmed && confirmId !== p.settlementId && rejectId !== p.settlementId ? (
                              <>
                                <button type="button" style={styles.primary} onClick={() => { setConfirmId(p.settlementId); setRejectId(null); }}>
                                  I got it
                                </button>
                                <button
                                  type="button"
                                  style={sentBack ? styles.told : styles.ghost}
                                  onClick={() => { setRejectId(p.settlementId); setRejectNote(p.notReceivedNote ?? ''); setConfirmId(null); }}
                                >
                                  {sentBack ? 'Update note' : 'Not received'}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {confirmId === p.settlementId ? (
                        <tr>
                          <td style={styles.detail} colSpan={8}>
                            <div style={styles.actions}>
                              <span style={styles.sub}>Confirm {money(p.netAmount)} reached you?</span>
                              <button type="button" style={styles.primary} disabled={busyId === p.settlementId} onClick={() => void confirmPayout(p.settlementId)}>
                                {busyId === p.settlementId ? 'Saving…' : 'Confirm'}
                              </button>
                              <button type="button" style={styles.ghost} disabled={busyId === p.settlementId} onClick={() => setConfirmId(null)}>
                                Back
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {rejectId === p.settlementId ? (
                        <tr>
                          <td style={styles.detail} colSpan={8}>
                            <div style={styles.actions}>
                              <input
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                placeholder="Comment for KoyaKart"
                                maxLength={500}
                                style={styles.note}
                                aria-label="What to recheck"
                              />
                              <button type="button" style={styles.primary} disabled={busyId === p.settlementId || !rejectNote.trim()} onClick={() => void rejectPayout(p.settlementId)}>
                                {busyId === p.settlementId ? 'Sending…' : 'Send comment'}
                              </button>
                              <button type="button" style={styles.ghost} disabled={busyId === p.settlementId} onClick={() => setRejectId(null)}>
                                Back
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={styles.gstNote}>
            GST does not apply to your payout. It is charged on the customer’s bill and paid by KoyaKart.
          </p>
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
  notice: {
    display: 'grid',
    gap: '0.2rem',
    marginTop: '0.55rem',
    padding: '0.4rem 0.55rem',
    borderRadius: 8,
    background: '#fee2e2',
    border: '1px solid #fecaca',
  },
  noticeLine: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' },
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
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 720 },
  th: {
    textAlign: 'left',
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    background: 'var(--bg)',
  },
  thRight: {
    textAlign: 'right',
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    background: 'var(--bg)',
  },
  td: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' },
  tdRight: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  detail: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  sub: { marginTop: '0.12rem', fontSize: '0.68rem', fontWeight: 650, color: 'var(--text-muted)', whiteSpace: 'normal' },
  gstNote: { margin: '0.28rem 0 0', fontSize: '0.68rem', fontWeight: 650, color: 'var(--text-muted)', lineHeight: 1.35 },
  pill: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
  },
  pillOk: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
    background: '#f0fdf4',
    color: '#15803d',
  },
  pillWarn: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
    background: '#fff7ed',
    color: '#c2410c',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.28rem', alignItems: 'center' },
  primary: {
    minHeight: 32,
    border: '1px solid #166534',
    borderRadius: 8,
    background: '#f0fdf4',
    color: '#14532d',
    fontWeight: 800,
    fontSize: '0.72rem',
    padding: '0.15rem 0.55rem',
    cursor: 'pointer',
  },
  ghost: {
    minHeight: 32,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 750,
    fontSize: '0.72rem',
    padding: '0.15rem 0.55rem',
    cursor: 'pointer',
  },
  told: {
    minHeight: 32,
    border: '1px solid #fdba74',
    borderRadius: 8,
    background: '#fff7ed',
    color: '#c2410c',
    fontWeight: 800,
    fontSize: '0.72rem',
    padding: '0.15rem 0.55rem',
    cursor: 'pointer',
  },
  note: {
    flex: '1 1 8rem',
    minHeight: 32,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.2rem 0.45rem',
    font: 'inherit',
    fontSize: '0.75rem',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
};
