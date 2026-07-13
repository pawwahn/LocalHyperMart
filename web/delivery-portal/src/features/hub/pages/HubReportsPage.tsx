import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { HubShell } from '../layout/HubShell';
import { fetchHubReport, fetchMyHub, type HubReportDto } from '../api/hubApi';

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function shiftIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** First and last calendar day of a month in IST (YYYY-MM-DD). */
function monthBounds(offsetMonths: number): { from: string; to: string } {
  const parts = todayIso().split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const base = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

type Preset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom';
type AgentRow = HubReportDto['agents'][number];

export function HubReportsPage() {
  const { session } = useAuth();
  const isMobile = useIsMobile();
  const [hubId, setHubId] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [agentId, setAgentId] = useState('all');
  const [report, setReport] = useState<HubReportDto | null>(null);
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
    } else if (next === '30d') {
      setFrom(shiftIso(-29));
      setTo(todayIso());
    } else if (next === 'thisMonth') {
      const b = monthBounds(0);
      setFrom(b.from);
      setTo(b.to);
    } else if (next === 'lastMonth') {
      const b = monthBounds(-1);
      setFrom(b.from);
      setTo(b.to);
    }
  }, []);

  const loadHub = useCallback(async () => {
    if (!session) return;
    const me = await fetchMyHub(session.accessToken);
    setHubId(me.hubId);
    setHubName(me.hubName);
  }, [session]);

  const loadReport = useCallback(async () => {
    if (!session || !hubId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchHubReport(session.accessToken, hubId, from, to);
      setReport(next);
      setAgentId((prev) =>
        prev === 'all' || next.agents.some((a) => a.agentId === prev) ? prev : 'all',
      );
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load report');
    } finally {
      setLoading(false);
    }
  }, [session, hubId, from, to]);

  useEffect(() => {
    void loadHub().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load hub'),
    );
  }, [loadHub]);

  useEffect(() => {
    if (hubId) void loadReport();
  }, [hubId, loadReport]);

  const rangeLabel = useMemo(() => {
    if (from === to) return from;
    return `${from} → ${to}`;
  }, [from, to]);

  const selectedAgent: AgentRow | null = useMemo(() => {
    if (!report || agentId === 'all') return null;
    return report.agents.find((a) => a.agentId === agentId) ?? null;
  }, [report, agentId]);

  const visibleAgents: AgentRow[] = useMemo(() => {
    if (!report) return [];
    if (agentId === 'all') return report.agents;
    return report.agents.filter((a) => a.agentId === agentId);
  }, [report, agentId]);

  return (
    <HubShell
      title="Hub reports"
      subtitle={hubName || undefined}
      onRefresh={() => void loadReport()}
    >
      <section style={styles.filters}>
        <p style={styles.filtersTitle}>1. Choose dates</p>
        <div style={styles.presets}>
          <PresetChip active={preset === 'today'} label="Today" onClick={() => applyPreset('today')} />
          <PresetChip active={preset === '7d'} label="Last 7 days" onClick={() => applyPreset('7d')} />
          <PresetChip active={preset === '30d'} label="Last 30 days" onClick={() => applyPreset('30d')} />
          <PresetChip
            active={preset === 'thisMonth'}
            label="This month"
            onClick={() => applyPreset('thisMonth')}
          />
          <PresetChip
            active={preset === 'lastMonth'}
            label="Last month"
            onClick={() => applyPreset('lastMonth')}
          />
          <PresetChip active={preset === 'custom'} label="Custom dates" onClick={() => setPreset('custom')} />
        </div>
        <div style={isMobile ? styles.dateRowMobile : styles.dateRow}>
          <label style={isMobile ? styles.dateFieldMobile : styles.dateField}>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
              style={styles.dateInput}
            />
          </label>
          <label style={isMobile ? styles.dateFieldMobile : styles.dateField}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
              style={styles.dateInput}
            />
          </label>
        </div>

        <p style={styles.filtersTitle}>2. Choose delivery boy</p>
        <label style={styles.selectField}>
          Agent phone / name
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            style={isMobile ? styles.selectMobile : styles.select}
            aria-label="Select delivery boy"
          >
            <option value="all">All delivery boys</option>
            {(report?.agents ?? []).map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.phone} · {a.name}
              </option>
            ))}
          </select>
        </label>

        <div style={isMobile ? styles.dateRowMobile : styles.dateRow}>
          <button type="button" style={styles.applyBtn} onClick={() => void loadReport()} disabled={loading}>
            Show report
          </button>
          <p style={styles.rangeHint}>
            Showing: {rangeLabel}
            {selectedAgent ? ` · boy ${selectedAgent.phone}` : ' · all boys'}
          </p>
        </div>
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && !report ? <p style={styles.muted}>Loading report…</p> : null}

      {report ? (
        <>
          {selectedAgent ? (
            <section style={styles.agentHero}>
              <p style={styles.agentHeroEyebrow}>Selected delivery boy</p>
              <h2 style={styles.agentHeroTitle}>
                🛵 {selectedAgent.name}
              </h2>
              <p style={styles.agentHeroPhone}>Phone: {selectedAgent.phone}</p>
              <div style={styles.stats}>
                <Stat
                  label="Shop → Hub pickups"
                  value={selectedAgent.shopPickupsCompleted}
                  help="Bags this boy brought to hub"
                  tone="go"
                />
                <Stat
                  label="Hub → Home deliveries"
                  value={selectedAgent.homeDeliveriesCompleted}
                  help="Orders this boy gave to customers"
                  tone="info"
                />
                <Stat
                  label="Total trips done"
                  value={selectedAgent.totalCompleted}
                  help={`In ${rangeLabel}`}
                />
              </div>
            </section>
          ) : (
            <>
              <section>
                <h2 style={styles.h2}>Town orders & bags (whole hub)</h2>
                <div style={styles.stats}>
                  <Stat label="Orders placed" value={report.ordersPlaced} help="Customers placed order" />
                  <Stat label="Orders delivered" value={report.ordersDelivered} help="Reached customer home" />
                  <Stat label="Orders cancelled" value={report.ordersCancelled} help="Cancelled in this period" />
                  <Stat
                    label="Shop bags (sub-orders)"
                    value={report.subOrdersPlaced}
                    help="Bags from shops in orders"
                  />
                  <Stat
                    label="Bags marked ready"
                    value={report.bagsMarkedReady}
                    help="Shops packed in this period"
                  />
                </div>
              </section>

              <section>
                <h2 style={styles.h2}>All hub trips completed</h2>
                <div style={styles.stats}>
                  <Stat
                    label="Shop → Hub pickups"
                    value={report.shopPickupsCompleted}
                    help="Bags brought to hub"
                    tone="go"
                  />
                  <Stat
                    label="Hub → Home deliveries"
                    value={report.homeDeliveriesCompleted}
                    help="Orders given to customers"
                    tone="info"
                  />
                </div>
              </section>
            </>
          )}

          <section>
            <h2 style={styles.h2}>
              {selectedAgent ? 'This boy — trip numbers' : 'Delivery boys comparison'}
            </h2>
            {visibleAgents.length === 0 ? (
              <p style={styles.empty}>
                {agentId === 'all'
                  ? 'No delivery boys linked to this hub.'
                  : 'No trips for this boy in the selected dates.'}
              </p>
            ) : isMobile ? (
              <div style={styles.agentCards}>
                {visibleAgents.map((a) => (
                  <button
                    key={a.agentId}
                    type="button"
                    style={agentId === a.agentId ? styles.agentCardActive : styles.agentCard}
                    onClick={() => setAgentId(a.agentId)}
                  >
                    <strong style={styles.agentCardName}>{a.name}</strong>
                    <span style={styles.meta}>{a.phone} · {a.status}</span>
                    <div style={styles.agentCardNums}>
                      <span>Shop pickups <strong>{a.shopPickupsCompleted}</strong></span>
                      <span>Home <strong>{a.homeDeliveriesCompleted}</strong></span>
                      <span>Total <strong>{a.totalCompleted}</strong></span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Boy</th>
                      <th style={styles.th}>Phone (agent number)</th>
                      <th style={styles.thNum}>Shop pickups</th>
                      <th style={styles.thNum}>Home deliveries</th>
                      <th style={styles.thNum}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAgents.map((a) => (
                      <tr key={a.agentId}>
                        <td style={styles.td}>
                          <strong>{a.name}</strong>
                          <div style={styles.meta}>{a.status}</div>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.phoneBtn}
                            onClick={() => setAgentId(a.agentId)}
                            title="Show only this boy"
                          >
                            {a.phone}
                          </button>
                        </td>
                        <td style={styles.tdNum}>{a.shopPickupsCompleted}</td>
                        <td style={styles.tdNum}>{a.homeDeliveriesCompleted}</td>
                        <td style={styles.tdNum}>
                          <strong>{a.totalCompleted}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedAgent ? (
              <button type="button" style={styles.clearBtn} onClick={() => setAgentId('all')}>
                ← Show all delivery boys
              </button>
            ) : null}
          </section>
        </>
      ) : null}
    </HubShell>
  );
}

function PresetChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" style={active ? styles.chipActive : styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  help,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  help: string;
  tone?: 'neutral' | 'go' | 'info';
}) {
  const toneStyle =
    tone === 'go' ? styles.statGo : tone === 'info' ? styles.statInfo : styles.stat;
  return (
    <div style={toneStyle}>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statHelp}>{help}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  filters: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '1rem',
    display: 'grid',
    gap: '0.75rem',
  },
  filtersTitle: { margin: 0, fontWeight: 800, fontSize: '1.05rem' },
  presets: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  chip: {
    border: '2px solid var(--border)',
    borderRadius: 999,
    padding: '0.45rem 0.85rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipActive: {
    border: '2px solid var(--accent)',
    borderRadius: 999,
    padding: '0.45rem 0.85rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  dateRow: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'end' },
  dateRowMobile: { display: 'grid', gap: '0.65rem', width: '100%' },
  dateField: { display: 'grid', gap: '0.3rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' },
  dateFieldMobile: {
    display: 'grid',
    gap: '0.3rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    width: '100%',
  },
  selectField: {
    display: 'grid',
    gap: '0.35rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  select: {
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.85rem',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
    background: 'var(--bg-muted)',
    maxWidth: 420,
  },
  selectMobile: {
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.85rem',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
    background: 'var(--bg-muted)',
    width: '100%',
    maxWidth: '100%',
    minHeight: 'var(--touch-min)',
  },
  dateInput: {
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    fontSize: '0.95rem',
    color: 'var(--text)',
    background: 'var(--bg-muted)',
    width: '100%',
    minHeight: 'var(--touch-min)',
    boxSizing: 'border-box',
  },
  applyBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.7rem 1.1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
  },
  rangeHint: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' },
  agentHero: {
    background: 'rgba(66, 165, 245, 0.1)',
    border: '2px solid rgba(66, 165, 245, 0.45)',
    borderRadius: 16,
    padding: '1.1rem',
    display: 'grid',
    gap: '0.45rem',
  },
  agentHeroEyebrow: { margin: 0, fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent)' },
  agentHeroTitle: { margin: 0, fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-display)' },
  agentHeroPhone: { margin: 0, fontWeight: 700, fontSize: '1.05rem' },
  h2: { margin: '0 0 0.65rem', fontSize: '1.1rem', fontWeight: 800 },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    marginTop: '0.5rem',
  },
  agentCards: { display: 'grid', gap: '0.65rem' },
  agentCard: {
    textAlign: 'left',
    border: '2px solid var(--border)',
    borderRadius: 14,
    padding: '0.9rem 1rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.3rem',
    minHeight: 'var(--touch-min)',
  },
  agentCardActive: {
    textAlign: 'left',
    border: '2px solid var(--accent)',
    borderRadius: 14,
    padding: '0.9rem 1rem',
    background: 'var(--accent-soft)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.3rem',
    minHeight: 'var(--touch-min)',
  },
  agentCardName: { fontSize: '1.05rem', fontFamily: 'var(--font-display)' },
  agentCardNums: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.35rem',
    marginTop: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statGo: {
    background: 'rgba(129, 199, 132, 0.1)',
    border: '1px solid rgba(129, 199, 132, 0.45)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statInfo: {
    background: 'rgba(66, 165, 245, 0.1)',
    border: '1px solid rgba(66, 165, 245, 0.45)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statValue: { margin: 0, fontSize: '1.7rem', fontWeight: 800, fontFamily: 'var(--font-display)' },
  statLabel: { margin: '0.2rem 0 0', fontWeight: 800, fontSize: '0.92rem' },
  statHelp: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 520 },
  th: {
    textAlign: 'left',
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  thNum: {
    textAlign: 'right',
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  td: { padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdNum: {
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 700,
  },
  phoneBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
    fontSize: '1rem',
  },
  clearBtn: {
    marginTop: '0.75rem',
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.9rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontWeight: 600 },
  empty: {
    margin: 0,
    padding: '1rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
};
