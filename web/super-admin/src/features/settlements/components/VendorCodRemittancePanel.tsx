import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Card } from '@/shared/ui';
import { listAllAgents, type AdminAgentVm } from '@/features/agents/api/agentsApi';
import { listHubs, type AdminHubVm } from '@/features/hubs/api/hubsApi';
import { formatMoney } from '../api/settlementsApi';
import { fetchCodCloses, type CodCloseDayResponse } from '../api/codApi';

type Props = {
  token: string;
  townId: string;
  from: string;
  to: string;
};

export function VendorCodRemittancePanel({ token, townId, from, to }: Props) {
  const [hubs, setHubs] = useState<AdminHubVm[]>([]);
  const [hubId, setHubId] = useState('');
  const [closes, setCloses] = useState<CodCloseDayResponse[]>([]);
  const [agents, setAgents] = useState<AdminAgentVm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setHubId((prev) => (prev && inTown.some((h) => h.hubId === prev) ? prev : inTown[0]?.hubId ?? ''));
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
  }, [token, townId]);

  const loadCloses = useCallback(async () => {
    if (!token || !townId || !hubId) {
      setCloses([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCodCloses(token, { townId, hubId, from, to });
      setCloses(rows);
    } catch (err) {
      setCloses([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD close-days');
    } finally {
      setLoading(false);
    }
  }, [token, townId, hubId, from, to]);

  useEffect(() => {
    void loadCloses();
  }, [loadCloses]);

  const totals = useMemo(() => {
    let received = 0;
    let orders = 0;
    for (const c of closes) {
      received += Number(c.receivedAmount ?? 0);
      orders += c.orderCount ?? 0;
    }
    return { received, orders, closeCount: closes.length };
  }, [closes]);

  const hubName = hubs.find((h) => h.hubId === hubId)?.name ?? 'Hub';

  if (!townId) return null;

  return (
    <Card padding="sm" style={styles.card}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>COD cash trail</h2>
          <p style={styles.muted}>
            Buyer pays cash to the delivery agent → hub records handover in{' '}
            <strong style={styles.strong}>Delivery portal → Hub → COD close day</strong>. Vendor payout here is
            platform → vendor; reconcile COD still with agents before large payouts. Hub → Super Admin collection is
            not auto-tracked yet — use franchise / manual collection.
          </p>
        </div>
        {hubs.length > 1 ? (
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
        ) : hubs.length === 1 ? (
          <span style={styles.hubPill}>{hubName}</span>
        ) : (
          <span style={styles.hubPillMuted}>No hub in town</span>
        )}
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading ? (
        <p style={styles.muted}>Loading close-days…</p>
      ) : !hubId ? (
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
