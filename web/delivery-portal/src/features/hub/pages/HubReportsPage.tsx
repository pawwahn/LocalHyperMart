import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { HubShell } from '../layout/HubShell';
import {
  fetchHubAgents,
  fetchHubAssignmentReport,
  fetchHubDailyOrdersReport,
  fetchHubPaymentMixReport,
  fetchHubQualityReport,
  fetchHubReport,
  fetchMyHub,
  type AgentDto,
} from '../api/hubApi';
import {
  fetchCodCloses,
  fetchCodCustodianOutstanding,
  fetchCodCustodianPendingDetail,
  fetchCodHubLedger,
} from '../api/codApi';
import { fetchHubAccountSummary } from '../api/hubAccountApi';
import {
  HUB_REPORT_CATALOG,
  hubReportById,
  type HubReportKind,
} from '../reports/hubReportCatalog';
import { HubReportContent, type LoadedHubReport } from '../reports/HubReportContent';
import {
  csvCodCloses,
  csvCodLedger,
  csvCodOutstanding,
  csvCodPending,
  csvDailyOrders,
  csvHubAccount,
  csvOperationsSummary,
  csvPaymentMix,
  csvQuality,
  csvTrips,
} from '../reports/hubReportCsv';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { formatIsoDateRange } from '../lib/codFormat';
import { rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';

export function HubReportsPage() {
  const { session } = useAuth();
  const isMobile = useIsMobile();
  const [hubId, setHubId] = useState<string | null>(null);
  const [townId, setTownId] = useState<string | null>(null);
  const [reportKind, setReportKind] = useState<HubReportKind>('operations');
  const monthRange = rangeForReportPreset('month');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(monthRange.from);
  const [to, setTo] = useState(monthRange.to);
  const [agentId, setAgentId] = useState('all');
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [loaded, setLoaded] = useState<LoadedHubReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = hubReportById(reportKind);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const me = await fetchMyHub(session.accessToken);
        setHubId(me.hubId);
        setTownId(me.townId);
        const list = await fetchHubAgents(session.accessToken, me.hubId).catch(() => [] as AgentDto[]);
        setAgents(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load hub');
      }
    })();
  }, [session]);

  const loadReport = useCallback(async () => {
    if (!session || !hubId || !townId) return;
    setLoading(true);
    setError(null);
    try {
      let next: LoadedHubReport;
      switch (reportKind) {
        case 'operations':
          next = { kind: 'operations', data: await fetchHubReport(session.accessToken, hubId, from, to) };
          break;
        case 'daily-orders':
          next = {
            kind: 'daily-orders',
            data: await fetchHubDailyOrdersReport(session.accessToken, hubId, from, to),
          };
          break;
        case 'trips':
          next = {
            kind: 'trips',
            data: await fetchHubAssignmentReport(
              session.accessToken,
              hubId,
              from,
              to,
              agentId === 'all' ? undefined : agentId,
            ),
          };
          break;
        case 'payment-mix':
          next = {
            kind: 'payment-mix',
            data: await fetchHubPaymentMixReport(session.accessToken, hubId, from, to),
          };
          break;
        case 'order-quality':
          next = {
            kind: 'order-quality',
            data: await fetchHubQualityReport(session.accessToken, hubId, from, to),
          };
          break;
        case 'hub-account':
          next = {
            kind: 'hub-account',
            data: await fetchHubAccountSummary(session.accessToken, from, to),
          };
          break;
        case 'cod-closes': {
          const items = await fetchCodCloses(session.accessToken, { townId, hubId, from, to });
          const filtered =
            agentId === 'all' ? items : items.filter((c) => c.agentId === agentId);
          next = { kind: 'cod-closes', data: filtered };
          break;
        }
        case 'cod-ledger':
          next = {
            kind: 'cod-ledger',
            data: await fetchCodHubLedger(session.accessToken, { townId, hubId, from, to }),
          };
          break;
        case 'cod-pending':
          next = {
            kind: 'cod-pending',
            data: await fetchCodCustodianPendingDetail(session.accessToken, { townId, hubId, from, to }),
          };
          break;
        case 'cod-outstanding':
          next = {
            kind: 'cod-outstanding',
            data: await fetchCodCustodianOutstanding(session.accessToken, { townId, hubId }),
          };
          break;
        default:
          throw new Error('Unknown report type');
      }
      setLoaded(next);
    } catch (err) {
      setLoaded(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load report');
    } finally {
      setLoading(false);
    }
  }, [session, hubId, townId, reportKind, from, to, agentId]);

  const rangeLabel = useMemo(() => {
    if (!def.usesDateRange) return 'Live snapshot';
    return formatIsoDateRange(from, to);
  }, [def.usesDateRange, from, to]);

  const exportCsv = useCallback(() => {
    if (!loaded) return;
    switch (loaded.kind) {
      case 'operations':
        csvOperationsSummary(loaded.data, agentId);
        break;
      case 'daily-orders':
        csvDailyOrders(loaded.data);
        break;
      case 'trips':
        csvTrips(loaded.data);
        break;
      case 'payment-mix':
        csvPaymentMix(loaded.data);
        break;
      case 'order-quality':
        csvQuality(loaded.data);
        break;
      case 'hub-account':
        csvHubAccount(loaded.data);
        break;
      case 'cod-closes':
        csvCodCloses(loaded.data, from, to);
        break;
      case 'cod-ledger':
        csvCodLedger(loaded.data);
        break;
      case 'cod-pending':
        csvCodPending(loaded.data, agentId);
        break;
      case 'cod-outstanding':
        csvCodOutstanding(loaded.data, agentId);
        break;
    }
  }, [loaded, agentId, from, to]);

  return (
    <HubShell title="Hub reports" onRefresh={() => void loadReport()}>
      <section style={styles.filters}>
        <p style={styles.filtersTitle}>1. Choose report</p>
        <div style={styles.reportGrid}>
          {HUB_REPORT_CATALOG.map((r) => (
            <button
              key={r.id}
              type="button"
              style={reportKind === r.id ? styles.reportCardActive : styles.reportCard}
              onClick={() => {
                setReportKind(r.id);
                setLoaded(null);
              }}
            >
              <strong style={styles.reportCardTitle}>{r.title}</strong>
              <span style={styles.reportCardSub}>{r.subtitle}</span>
            </button>
          ))}
        </div>

        {def.usesDateRange ? (
          <>
            <p style={styles.filtersTitle}>2. Choose dates</p>
            <DateRangePresetBar
              preset={preset}
              from={from}
              to={to}
              onPresetChange={setPreset}
              onFromChange={setFrom}
              onToChange={setTo}
              stackDateInputs={isMobile}
              ariaLabel="Report date range"
            />
          </>
        ) : (
          <p style={styles.muted}>This report uses current unsettled COD data (no date range).</p>
        )}

        {def.usesAgentFilter ? (
          <>
            <p style={styles.filtersTitle}>{def.usesDateRange ? '3' : '2'}. Filter by agent (optional)</p>
            <label style={styles.selectField}>
              Agent
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                style={isMobile ? styles.selectMobile : styles.select}
              >
                <option value="all">All delivery agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.phone} · {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <div style={isMobile ? styles.actionCol : styles.actionRow}>
          <button type="button" style={styles.applyBtn} onClick={() => void loadReport()} disabled={loading || !hubId}>
            {loading ? 'Loading…' : 'Show report'}
          </button>
          <button type="button" style={styles.secondaryBtn} disabled={!loaded} onClick={exportCsv}>
            Download CSV
          </button>
          <p style={styles.rangeHint}>
            {def.title}: {rangeLabel}
            {def.usesAgentFilter && agentId !== 'all'
              ? ` · ${agents.find((a) => a.id === agentId)?.phone ?? 'agent'}`
              : def.usesAgentFilter
                ? ' · all agents'
                : ''}
          </p>
        </div>
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && !loaded ? <p style={styles.muted}>Loading report…</p> : null}

      {loaded ? (
        <HubReportContent
          loaded={loaded}
          agentId={agentId}
          isMobile={isMobile}
          onSelectAgent={setAgentId}
        />
      ) : null}
    </HubShell>
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
    marginBottom: '1rem',
  },
  filtersTitle: { margin: 0, fontWeight: 800, fontSize: '1.05rem' },
  reportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.55rem',
  },
  reportCard: {
    textAlign: 'left',
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.65rem 0.75rem',
    background: 'var(--bg-muted)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.25rem',
  },
  reportCardActive: {
    textAlign: 'left',
    border: '2px solid var(--accent)',
    borderRadius: 12,
    padding: '0.65rem 0.75rem',
    background: 'var(--accent-soft)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.25rem',
  },
  reportCardTitle: { fontSize: '0.92rem' },
  reportCardSub: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
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
    maxWidth: 420,
  },
  selectMobile: {
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.85rem',
    fontSize: '1rem',
    fontWeight: 700,
    width: '100%',
  },
  actionRow: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' },
  actionCol: { display: 'grid', gap: '0.55rem' },
  applyBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.7rem 1.1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '2px solid var(--accent)',
    borderRadius: 10,
    padding: '0.7rem 1.1rem',
    minHeight: 'var(--touch-min)',
    background: 'transparent',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  rangeHint: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', flex: '1 1 100%' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontWeight: 600 },
};
