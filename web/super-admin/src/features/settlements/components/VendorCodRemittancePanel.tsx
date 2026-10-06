import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Card } from '@/shared/ui';
import { listAllAgents, type AdminAgentVm } from '@/features/agents/api/agentsApi';
import { listHubs, type AdminHubVm } from '@/features/hubs/api/hubsApi';
import { formatMoney } from '../api/settlementsApi';
import {
  fetchCodCloses,
  fetchCodHubLedger,
  recordCodHubRemittance,
  type CodCloseDayResponse,
  type CodHubLedger,
} from '../api/codApi';
import { Button, TextField } from '@/shared/ui';

type Props = {
  token: string;
  townId: string;
  from: string;
  to: string;
  /** Hub tab: same hub as payout filters — hides hub dropdown. */
  fixedHubId?: string;
  variant?: 'default' | 'hub-payout';
  refreshTick?: number;
};

export function VendorCodRemittancePanel({
  token,
  townId,
  from,
  to,
  fixedHubId,
  variant = 'default',
  refreshTick = 0,
}: Props) {
  const [hubs, setHubs] = useState<AdminHubVm[]>([]);
  const [hubId, setHubId] = useState('');
  const [closes, setCloses] = useState<CodCloseDayResponse[]>([]);
  const [agents, setAgents] = useState<AdminAgentVm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CodHubLedger | null>(null);
  const [remitAmount, setRemitAmount] = useState('');
  const [remitDate, setRemitDate] = useState('');
  const [remitRef, setRemitRef] = useState('');
  const [remitNotes, setRemitNotes] = useState('');
  const [remitBusy, setRemitBusy] = useState(false);
  const [remitNotice, setRemitNotice] = useState<string | null>(null);

  const agentName = useMemo(() => {
    const map = new Map(agents.map((a) => [a.agentId, a.name]));
    return (id: string) => map.get(id) ?? `${id.slice(0, 8)}…`;
  }, [agents]);

  useEffect(() => {
    if (!token || !townId) {
      setHubs([]);
      setHubId('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [all, agentList] = await Promise.all([listHubs(token), listAllAgents(token)]);
        if (cancelled) return;
        const inTown = all.filter((h) => h.townId === townId);
        setAgents(agentList.filter((a) => a.townId === townId || inTown.some((h) => h.hubId === a.hubId)));
        setHubs(inTown);
        if (fixedHubId && inTown.some((h) => h.hubId === fixedHubId)) {
          setHubId(fixedHubId);
        } else {
          setHubId((prev) => (prev && inTown.some((h) => h.hubId === prev) ? prev : inTown[0]?.hubId ?? ''));
        }
      } catch {
        if (!cancelled) {
          setHubs([]);
          setHubId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, townId, fixedHubId]);

  const activeHubId = fixedHubId || hubId;

  const loadCloses = useCallback(async () => {
    if (!token || !townId || !activeHubId) {
      setCloses([]);
      setLedger(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, ledgerData] = await Promise.all([
        fetchCodCloses(token, { townId, hubId: activeHubId, from, to }),
        fetchCodHubLedger(token, { townId, hubId: activeHubId, from, to }),
      ]);
      setCloses(rows);
      setLedger(ledgerData);
    } catch (err) {
      setCloses([]);
      setLedger(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD close-days');
    } finally {
      setLoading(false);
    }
  }, [token, townId, activeHubId, from, to]);

  useEffect(() => {
    void loadCloses();
  }, [loadCloses, refreshTick]);

  const totals = useMemo(() => {
    let received = 0;
    let orders = 0;
    for (const c of closes) {
      received += Number(c.receivedAmount ?? 0);
      orders += c.orderCount ?? 0;
    }
    return { received, orders, closeCount: closes.length };
  }, [closes]);

  const hubName = hubs.find((h) => h.hubId === activeHubId)?.name ?? 'Hub';
  const isHubPayout = variant === 'hub-payout';
  const balanceOwed = Number(ledger?.balanceOwedToCompany ?? 0);
  const codSettled = ledger != null && balanceOwed <= 0.005;
  const remittances = ledger?.remittances ?? [];

  if (!townId) return null;

  if (isHubPayout && fixedHubId && !activeHubId) {
    return (
      <Card padding="sm" style={styles.card}>
        <p style={styles.title}>COD from agents</p>
        <p style={styles.muted}>Select a hub above to see cash the hub confirmed from delivery agents.</p>
      </Card>
    );
  }

  return (
    <Card padding="sm" style={{ ...styles.card, ...(isHubPayout ? styles.cardHighlight : null) }}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>{isHubPayout ? 'COD ledger · agents → hub → KoyaKart' : 'COD cash trail'}</h2>
          <p style={styles.muted}>
            {isHubPayout
              ? 'Step 1: agents pay COD to the hub (table below). Step 2: hub pays KoyaKart online — you confirm under Hub online payments above. This block is the audit trail, not a second payment.'
              : 'Hub confirms agent COD in the delivery portal. Record hub → company deposits below so hub admins see their balance owed.'}
          </p>
        </div>
        {!fixedHubId && hubs.length > 1 ? (
          <label style={styles.hubPick}>
            Hub
            <select style={styles.select} value={hubId} onChange={(e) => setHubId(e.target.value)}>
              {hubs.map((h) => (
                <option key={h.hubId} value={h.hubId}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        ) : !fixedHubId && hubs.length === 1 ? (
          <span style={styles.hubPill}>{hubName}</span>
        ) : fixedHubId ? (
          <span style={styles.hubPill}>{hubName}</span>
        ) : (
          <span style={styles.hubPillMuted}>No hub in town</span>
        )}
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {remitNotice ? <p style={styles.notice}>{remitNotice}</p> : null}
      {isHubPayout && ledger && codSettled ? (
        <p style={styles.settledBanner}>
          COD cleared — received at hub matches remitted to KoyaKart (including verified hub online payments).
        </p>
      ) : null}
      {ledger ? (
        <div style={styles.kpiRow}>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>{isHubPayout ? 'COD still to collect' : 'Hub owes company'}</span>
            <strong style={isHubPayout ? styles.kpiStrong : undefined}>
              {formatMoney(ledger.balanceOwedToCompany)}
            </strong>
          </div>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>Received at hub (all time)</span>
            <strong>{formatMoney(ledger.totalReceivedAllTime)}</strong>
          </div>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>Remitted (all time)</span>
            <strong>{formatMoney(ledger.totalRemittedAllTime)}</strong>
          </div>
        </div>
      ) : null}
      {isHubPayout && remittances.length > 0 ? (
        <div style={styles.remitHistory}>
          <p style={styles.remitTitle}>Remitted to KoyaKart</p>
          <ul style={styles.remitList}>
            {remittances.slice(0, 8).map((r) => (
              <li key={r.remittanceId}>
                {formatMoney(r.amount)} · {r.remittanceDate}
                {r.reference ? ` · ${r.reference}` : ''}
                {r.notes ? ` · ${r.notes}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {activeHubId && (!isHubPayout || !codSettled) ? (
        <form
          style={styles.remitForm}
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const amount = Number(remitAmount);
              if (!token || !townId || !activeHubId || !Number.isFinite(amount) || amount <= 0) return;
              setRemitBusy(true);
              setRemitNotice(null);
              try {
                await recordCodHubRemittance(token, {
                  townId,
                  hubId: activeHubId,
                  remittanceDate: remitDate || undefined,
                  amount,
                  reference: remitRef.trim() || undefined,
                  notes: remitNotes.trim() || undefined,
                });
                setRemitAmount('');
                setRemitRef('');
                setRemitNotes('');
                setRemitNotice('Recorded hub remittance to company.');
                await loadCloses();
              } catch (err) {
                setRemitNotice(
                  err instanceof ApiError || err instanceof Error ? err.message : 'Could not record remittance',
                );
              } finally {
                setRemitBusy(false);
              }
            })();
          }}
        >
          <p style={styles.remitTitle}>
            {isHubPayout
              ? 'Manual COD record (offline only — if hub did not use Pay online)'
              : 'Record collection from hub'}
          </p>
          {isHubPayout ? (
            <p style={styles.muted}>
              Prefer confirming hub UPI/NEFT in <strong>Hub online payments · verify</strong> above. Use this only for
              cash/cheque not submitted by the hub.
            </p>
          ) : null}
          <div style={styles.remitRow}>
            <TextField label="Amount (₹)" type="number" step="0.01" min="0" value={remitAmount} onChange={(e) => setRemitAmount(e.target.value)} required />
            <TextField label="Date" type="date" value={remitDate} onChange={(e) => setRemitDate(e.target.value)} />
            <TextField label="Reference" value={remitRef} onChange={(e) => setRemitRef(e.target.value)} />
          </div>
          <TextField label="Notes" value={remitNotes} onChange={(e) => setRemitNotes(e.target.value)} />
          <Button type="submit" disabled={remitBusy}>
            {remitBusy ? 'Saving…' : 'Record remittance'}
          </Button>
        </form>
      ) : null}
      {loading ? (
        <p style={styles.muted}>Loading close-days…</p>
      ) : !activeHubId ? (
        <p style={styles.muted}>Select a town with a hub to see COD remittance history.</p>
      ) : closes.length === 0 ? (
        <p style={styles.muted}>
          No COD close-days for {hubName} in this date range — agent cash may still be outstanding.
        </p>
      ) : (
        <>
          <div style={styles.kpiRow}>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Close-days</span>
              <strong>{totals.closeCount}</strong>
            </div>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Orders closed</span>
              <strong>{totals.orders}</strong>
            </div>
            <div style={styles.kpi}>
              <span style={styles.kpiLabel}>Cash at hub (recorded)</span>
              <strong>{formatMoney(totals.received)}</strong>
            </div>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Agent</th>
                  <th style={styles.thRight}>Orders</th>
                  <th style={styles.thRight}>Received</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {closes.slice(0, 12).map((c) => (
                  <tr key={c.id}>
                    <td style={styles.td}>{c.closeDate}</td>
                    <td style={styles.tdMuted} title={c.agentId}>
                      {agentName(c.agentId)}
                    </td>
                    <td style={styles.tdRight}>{c.orderCount}</td>
                    <td style={styles.tdRight}>{formatMoney(c.receivedAmount)}</td>
                    <td style={styles.td}>
                      <span style={c.status === 'MATCHED' ? styles.ok : styles.warn}>
                        {c.status === 'MATCHED' ? 'Matched' : 'Discrepancy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {closes.length > 12 ? (
            <p style={styles.muted}>Showing latest 12 of {closes.length} close-days in range.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.5rem' },
  cardHighlight: {
    border: '1px solid color-mix(in srgb, var(--accent, #16a34a) 35%, var(--border))',
    background: 'color-mix(in srgb, var(--accent-soft, #dcfce7) 35%, var(--bg-elevated))',
  },
  kpiStrong: { fontSize: '1.15rem', color: 'var(--accent-strong, #15803d)' },
  head: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  title: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  strong: { fontWeight: 750, color: 'var(--text)' },
  hubPick: {
    display: 'grid',
    gap: '0.15rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  select: {
    padding: '0.28rem 0.4rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
  },
  hubPill: {
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.25rem 0.5rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  hubPillMuted: { fontSize: '0.72rem', color: 'var(--text-muted)' },
  error: { margin: 0, fontSize: '0.75rem', color: '#b91c1c', fontWeight: 650 },
  kpiRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  kpi: {
    flex: '1 1 6rem',
    padding: '0.4rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    display: 'grid',
    gap: '0.1rem',
  },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' },
  th: {
    textAlign: 'left',
    padding: '0.3rem 0.45rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  thRight: {
    textAlign: 'right',
    padding: '0.3rem 0.45rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  td: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)' },
  tdMuted: {
    padding: '0.28rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    fontSize: '0.7rem',
  },
  tdRight: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)', textAlign: 'right' },
  notice: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: '#15803d' },
  settledBanner: {
    margin: 0,
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 650,
    color: '#15803d',
    background: '#ecfdf5',
    border: '1px solid #bbf7d0',
  },
  remitHistory: {
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    display: 'grid',
    gap: '0.25rem',
  },
  remitList: {
    margin: 0,
    paddingLeft: '1.1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    display: 'grid',
    gap: '0.2rem',
  },
  remitForm: { display: 'grid', gap: '0.35rem', padding: '0.45rem', border: '1px dashed var(--border)', borderRadius: 8 },
  remitTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800 },
  remitRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7rem, 1fr))', gap: '0.35rem' },
  ok: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#15803d',
    background: '#dcfce7',
    padding: '0.12rem 0.35rem',
    borderRadius: 999,
  },
  warn: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#b45309',
    background: '#fef3c7',
    padding: '0.12rem 0.35rem',
    borderRadius: 999,
  },
};
