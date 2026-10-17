import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listHubs } from '@/features/hubs/api/hubsApi';
import { listAllAgents } from '@/features/agents/api/agentsApi';
import { listVendors } from '@/features/vendors/api/vendorsApi';
import { fetchCompliancePack, type CompliancePack } from '../api/financeLedgerApi';
import {
  buildPartyAuditReport,
  mergePartyDirectory,
  partyAuditCsv,
  printPartyAuditReport,
  type AuditLine,
  type AuditParty,
  type NamedParty,
  type PartyAuditReport,
} from '../partyAuditReport';
import { looksLikeUuid } from '@/shared/display/displayNames';
import { rangeForReportPreset, type ReportDatePreset } from '@/shared/dates/istReportPresets';

function money(value?: number | null): string {
  return `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PartyCategory = 'HUB' | 'VENDOR' | 'AGENT';

const CATEGORIES: { id: PartyCategory; label: string }[] = [
  { id: 'HUB', label: 'HUB' },
  { id: 'VENDOR', label: 'VENDOR' },
  { id: 'AGENT', label: 'Delivery Agent' },
];

/** Two even rows: recent ranges, then the financial-year slices. */
const AUDIT_PRESET_ROWS: { id: ReportDatePreset; label: string }[][] = [
  [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 days' },
    { id: 'days30', label: '30 days' },
    { id: 'month', label: 'This month' },
    { id: 'previousMonth', label: 'Prev month' },
    { id: 'financialYear', label: 'FY' },
    { id: 'custom', label: 'Custom' },
  ],
  [
    { id: 'q1', label: 'Q1 Apr–Jun' },
    { id: 'q2', label: 'Q2 Jul–Sep' },
    { id: 'q3', label: 'Q3 Oct–Dec' },
    { id: 'q4', label: 'Q4 Jan–Mar' },
    { id: 'firstHalf', label: 'HY1' },
    { id: 'secondHalf', label: 'HY2' },
    { id: 'annual', label: 'Year' },
  ],
];

function day(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function PartyAuditReportPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const initial = rangeForReportPreset('month');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [category, setCategory] = useState<PartyCategory>('HUB');
  const [partyId, setPartyId] = useState('');
  const [pack, setPack] = useState<CompliancePack | null>(null);
  const [directory, setDirectory] = useState<{ hubs: NamedParty[]; vendors: NamedParty[]; agents: NamedParty[] }>({
    hubs: [],
    vendors: [],
    agents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (next: ReportDatePreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const range = rangeForReportPreset(next);
    setFrom(range.from);
    setTo(range.to);
  };

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const townList = await listTowns(token);
      const townIds = townId ? [townId] : townList.map((town) => town.id);
      const [data, hubList, agentList, vendorGroups] = await Promise.all([
        fetchCompliancePack(token, { from, to, townId: townId || undefined }),
        listHubs(token).catch(() => []),
        listAllAgents(token).catch(() => []),
        Promise.all(townIds.map((id) => listVendors(token, id).catch(() => []))),
      ]);
      setTowns(townList);
      setPack(data);
      setDirectory({
        hubs: hubList
          .filter((hub) => !townId || hub.townId === townId)
          .map((hub) => ({ id: hub.hubId, name: hub.name })),
        vendors: vendorGroups.flat().map((vendor) => ({
          id: vendor.id,
          name: vendor.shopName?.trim() || vendor.businessName?.trim() || vendor.ownerName?.trim() || 'Vendor',
        })),
        agents: agentList
          .filter((agent) => !townId || agent.townId === townId)
          .map((agent) => ({ id: agent.agentId, name: agent.name })),
      });
    } catch (err) {
      setPack(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load the audit report');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, townId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const townName = useCallback(
    (id?: string | null) => {
      if (!id) return '';
      const found = towns.find((town) => town.id === id)?.displayName;
      if (found) return found;
      return looksLikeUuid(id) ? 'Town' : id;
    },
    [towns],
  );

  const townLabel = townId ? townName(townId) : 'All towns';
  const report = useMemo(
    () => (pack ? mergePartyDirectory(buildPartyAuditReport(pack), directory) : null),
    [pack, directory],
  );
  const categoryParties = report
    ? category === 'HUB'
      ? report.hubs
      : category === 'VENDOR'
        ? report.vendors
        : report.agents
    : [];
  const parties = partyId ? categoryParties.filter((row) => row.id === partyId) : categoryParties;
  const view: PartyAuditReport | null = report
    ? {
        ...report,
        hubs: category === 'HUB' ? parties : [],
        vendors: category === 'VENDOR' ? parties : [],
        agents: category === 'AGENT' ? parties : [],
      }
    : null;
  const partyLabel = category === 'HUB' ? 'Hub' : category === 'VENDOR' ? 'Vendor' : 'Delivery agent';

  useEffect(() => {
    if (!partyId) return;
    if (!categoryParties.some((party) => party.id === partyId)) setPartyId('');
  }, [categoryParties, partyId]);

  function downloadCsv() {
    if (!view) return;
    const blob = new Blob([partyAuditCsv(view, townLabel, townName)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KoyaKart-vendor-hub-audit-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell
      title="Audit report"
      subtitle="Hub, vendor, and delivery agent statements for accounts and auditors"
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {report?.truncated ? (
        <Banner tone="warning">
          Line detail is capped at 5,000 movements. Party totals still cover the full period. Narrow the dates for every line.
        </Banner>
      ) : null}

      <Card padding="sm" style={styles.filters}>
        <style>{AUDIT_FILTER_CSS}</style>
        <div className="audit-toolbar">
          <label className="audit-field">
            Town
            <select value={townId} onChange={(e) => setTownId(e.target.value)}>
              <option value="">All towns</option>
              {towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="audit-field">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="audit-field">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="audit-field">
            Category
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as PartyCategory);
                setPartyId('');
              }}
            >
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="audit-field">
            {partyLabel}
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">All</option>
              {categoryParties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </label>
          <div className="audit-actions">
            <Button type="button" size="sm" style={styles.actionBtn} onClick={() => void reload()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
            <Button type="button" size="sm" variant="secondary" style={styles.actionBtn} disabled={!view} onClick={downloadCsv}>
              Download CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              style={styles.actionBtn}
              disabled={!view}
              onClick={() => {
                if (view) printPartyAuditReport(view, townLabel, townName);
              }}
            >
              Print / PDF
            </Button>
          </div>
        </div>
        <div className="audit-presets">
          {AUDIT_PRESET_ROWS.map((row) => (
            <div key={row[0].id} className="audit-preset-row">
              {row.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={preset === id ? 'audit-chip on' : 'audit-chip'}
                  onClick={() => applyPreset(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p style={styles.hint}>
          {townLabel} · {day(from)} – {day(to)}. Net is cash received minus cash paid.
        </p>
      </Card>

      {loading && !report ? <p style={styles.muted}>Loading report…</p> : null}

      {view && category === 'HUB' ? (
        <PartySection
          title="Hubs"
          count={parties.length}
          summary={
            <SummaryTable
              columns={['Hub', 'Received', 'Paid out', 'Net', 'COD', 'Franchise', 'Other in', 'Commission', 'Txns']}
              rows={parties}
              empty="No hub movements in this period."
              cells={(hub) => [hub.name, money(hub.inflows), money(hub.outflows), money(hub.net), money(hub.cod), money(hub.franchise), money(hub.otherIn), money(hub.payouts), String(hub.txnCount)]}
              tones={['name', 'in', 'out', 'bal', 'num', 'num', 'num', 'num', 'num']}
            />
          }
          parties={parties}
          vendor={false}
          townName={townName}
        />
      ) : null}
      {view && category === 'VENDOR' ? (
        <PartySection
          title="Vendors"
          count={parties.length}
          summary={
            <SummaryTable
              columns={['Vendor', 'Paid out', 'Fees received', 'Net', 'Gross', 'Commission', 'Est. TDS', 'Txns']}
              rows={parties}
              empty="No vendor movements in this period."
              cells={(vendor) => [vendor.name, money(vendor.outflows), money(vendor.inflows), money(vendor.net), money(vendor.gross), money(vendor.commission), money(vendor.tds), String(vendor.txnCount)]}
              tones={['name', 'out', 'in', 'bal', 'num', 'num', 'num', 'num']}
            />
          }
          parties={parties}
          vendor
          townName={townName}
        />
      ) : null}
      {view && category === 'AGENT' ? (
        <PartySection
          title="Delivery agents"
          count={parties.length}
          summary={
            <SummaryTable
              columns={['Delivery agent', 'Paid out', 'Received', 'Net', 'Txns']}
              rows={parties}
              empty="No delivery agent movements in this period."
              cells={(agent) => [agent.name, money(agent.outflows), money(agent.inflows), money(agent.net), String(agent.txnCount)]}
              tones={['name', 'out', 'in', 'bal', 'num']}
            />
          }
          parties={parties}
          vendor={false}
          townName={townName}
        />
      ) : null}
    </PortalShell>
  );
}

function SummaryTable({
  columns,
  rows,
  empty,
  cells,
  tones,
}: {
  columns: string[];
  rows: AuditParty[];
  empty: string;
  cells: (row: AuditParty) => string[];
  tones: Array<'name' | 'in' | 'out' | 'bal' | 'num'>;
}) {
  const toneStyle = (tone: (typeof tones)[number]) =>
    tone === 'name' ? styles.tdStrong : tone === 'in' ? styles.tdIn : tone === 'out' ? styles.tdOut : tone === 'bal' ? styles.tdBal : styles.tdNum;
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={column} style={index === 0 ? styles.th : styles.thNum}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={styles.empty}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id}>
              {cells(row).map((value, index) => (
                <td key={columns[index]} style={toneStyle(tones[index] ?? 'num')}>
                  {value}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PartySection({
  title,
  count,
  summary,
  parties,
  vendor,
  townName,
}: {
  title: string;
  count: number;
  summary: ReactNode;
  parties: AuditParty[];
  vendor: boolean;
  townName: (id?: string | null) => string;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title} <span style={styles.count}>{count}</span>
      </h2>
      <div style={styles.tableWrap}>{summary}</div>
      {parties.map((party) => (
        <PartyLines key={party.id} party={party} vendor={vendor} townName={townName} />
      ))}
    </section>
  );
}

function PartyLines({
  party,
  vendor,
  townName,
}: {
  party: AuditParty;
  vendor: boolean;
  townName: (id?: string | null) => string;
}) {
  return (
    <div style={styles.lines}>
      <p style={styles.partyHead}>
        <strong>{party.name}</strong>
        <span style={styles.meta}>
          {party.lines.length} line{party.lines.length === 1 ? '' : 's'} · Net {money(party.net)}
        </span>
      </p>
      <div style={styles.tableWrap}>
        <table style={{ ...styles.table, minWidth: vendor ? 1180 : 980 }}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Verified</th>
              <th style={styles.th}>Received from / Paid to</th>
              <th style={styles.th}>Town</th>
              <th style={styles.th}>What</th>
              {vendor ? (
                <>
                  <th style={styles.thNum}>Gross</th>
                  <th style={styles.thNum}>Commission</th>
                  <th style={styles.thNum}>Est. TDS</th>
                </>
              ) : null}
              <th style={styles.thNum}>Cash in</th>
              <th style={styles.thNum}>Cash out</th>
              <th style={styles.thNum}>Balance</th>
              <th style={styles.th}>Reference</th>
              <th style={styles.th}>Period</th>
            </tr>
          </thead>
          <tbody>
            {party.lines.length === 0 ? (
              <tr>
                <td colSpan={vendor ? 12 : 9} style={styles.empty}>
                  Totals are above. No line detail in the loaded movements.
                </td>
              </tr>
            ) : (
              party.lines.map((line) => <LineRow key={line.key} line={line} vendor={vendor} townName={townName} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineRow({
  line,
  vendor,
  townName,
}: {
  line: AuditLine;
  vendor: boolean;
  townName: (id?: string | null) => string;
}) {
  const inflow = line.direction === 'IN';
  return (
    <tr>
      <td style={styles.tdNowrap}>{day(line.date)}</td>
      <td style={styles.tdMuted}>{day(line.verified)}</td>
      <td style={styles.td}>
        <div style={inflow ? styles.partyIn : styles.partyOut}>{inflow ? 'Received from' : 'Paid to'}</div>
        <strong>{line.who}</strong>
      </td>
      <td style={styles.td}>{townName(line.townId) || '—'}</td>
      <td style={styles.td}>
        {line.what}
        {line.detail ? <div style={styles.meta}>{line.detail}</div> : null}
      </td>
      {vendor ? (
        <>
          <td style={styles.tdNum}>{line.gross == null ? '—' : money(line.gross)}</td>
          <td style={styles.tdNum}>{line.commission == null ? '—' : money(line.commission)}</td>
          <td style={styles.tdNum}>{line.tds == null ? '—' : money(line.tds)}</td>
        </>
      ) : null}
      <td style={line.cashIn ? styles.tdIn : styles.tdDash}>{line.cashIn ? money(line.cashIn) : '—'}</td>
      <td style={line.cashOut ? styles.tdOut : styles.tdDash}>{line.cashOut ? money(line.cashOut) : '—'}</td>
      <td style={styles.tdBal}>{money(line.balance)}</td>
      <td style={styles.tdMono}>{line.reference || '—'}</td>
      <td style={styles.tdMuted}>{line.period || '—'}</td>
    </tr>
  );
}

const AUDIT_FILTER_CSS = `
.audit-toolbar {
  display: grid;
  grid-template-columns: minmax(8.5rem, 1.35fr) minmax(8.4rem, 0.85fr) minmax(8.4rem, 0.85fr) minmax(7rem, 0.7fr) minmax(9rem, 1.15fr) auto;
  gap: 0.4rem 0.5rem;
  align-items: end;
}
.audit-field {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
}
.audit-field input,
.audit-field select {
  width: 100%;
  box-sizing: border-box;
  height: 2.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 0.45rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 650;
}
.audit-actions {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: flex-end;
}
.audit-presets { display: grid; gap: 0.28rem; }
.audit-preset-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.28rem;
}
.audit-chip {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 999px;
  min-height: 1.7rem;
  padding: 0.2rem 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  text-align: center;
}
.audit-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 800;
}
@media (max-width: 1100px) {
  .audit-toolbar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .audit-actions { grid-column: 1 / -1; }
}
@media (max-width: 860px) {
  .audit-preset-row { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .audit-toolbar { grid-template-columns: 1fr 1fr; }
  .audit-actions { flex-wrap: wrap; }
  .audit-preset-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

const styles: Record<string, CSSProperties> = {
  filters: { display: 'grid', gap: '0.45rem', marginBottom: '0.55rem' },
  actionBtn: { minHeight: 44, padding: '0 0.75rem', whiteSpace: 'nowrap' },
  hint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  muted: { color: 'var(--text-muted)', margin: 0 },
  section: { display: 'grid', gap: '0.4rem', marginBottom: '0.75rem' },
  sectionTitle: { margin: '0.15rem 0 0', fontSize: '0.95rem', fontWeight: 800 },
  count: { color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: '0.78rem' },
  th: {
    textAlign: 'left',
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  thNum: {
    textAlign: 'right',
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  td: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdStrong: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', fontWeight: 800, verticalAlign: 'top' },
  tdNum: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdIn: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    color: '#15803d',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdOut: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    color: '#b91c1c',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdDash: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  tdBal: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdNowrap: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdMuted: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tdMono: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.72rem',
    verticalAlign: 'top',
  },
  empty: { padding: '0.7rem', textAlign: 'center', color: 'var(--text-muted)' },
  lines: { display: 'grid', gap: '0.25rem' },
  partyHead: { margin: '0.2rem 0 0', display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' },
  meta: { color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 },
  partyIn: { fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#15803d' },
  partyOut: { fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#b91c1c' },
};
