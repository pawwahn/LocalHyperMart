import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import {
  listAgentAssignments,
  listAgentRatings,
  type AdminAgentVm,
  type AgentAssignmentVm,
  type AgentRatingListVm,
} from '../api/agentsApi';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';

type Props = {
  agent: AdminAgentVm;
  townLabel: string;
  token: string;
  busy?: boolean;
  onClose: () => void;
  onDisable: () => void;
  onRestore: () => void;
};

type Panel = 'deliveries' | 'ratings' | 'log';
type JobType = 'all' | 'PICKUP' | 'LAST_MILE';

const PAGE_SIZE = 25;
const FETCH_SIZE = 50;

function jobWhen(row: AgentAssignmentVm): number {
  const iso = row.completedAt || row.assignedAt;
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseYmd(value: string, end = false): Date {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  return end ? endOfDay(dt) : startOfDay(dt);
}

function StarMarks({ value, size = 13 }: { value: number; size?: number }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span aria-label={`${n} of 5 stars`} style={{ display: 'inline-flex', gap: 1, fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= n ? '#D97706' : '#D1D5DB' }}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function legLabel(leg: string): string {
  if (leg === 'PICKUP') return 'Shop pickup';
  if (leg === 'LAST_MILE') return 'Home delivery';
  if (leg === 'VENDOR_DIRECT') return 'Shop to buyer';
  return leg;
}

function statusStyle(status: string): CSSProperties {
  if (status === 'COMPLETED') return styles.pillOn;
  if (status === 'IN_PROGRESS' || status === 'ASSIGNED') return styles.pillWarn;
  if (status === 'CANCELLED' || status === 'FAILED' || status === 'BUYER_REJECTED') return styles.pillDead;
  return styles.pillOff;
}

export function AgentDetailDialog({
  agent,
  townLabel,
  token,
  busy,
  onClose,
  onDisable,
  onRestore,
}: Props) {
  const [panel, setPanel] = useState<Panel>('deliveries');
  const initialDeliveryRange = rangeForReportPreset('today');
  const [preset, setPreset] = useState<ReportDatePreset>('today');
  const [fromYmd, setFromYmd] = useState(initialDeliveryRange.from);
  const [toYmd, setToYmd] = useState(initialDeliveryRange.to);
  const [jobType, setJobType] = useState<JobType>('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AgentAssignmentVm[]>([]);
  const [completedPickups, setCompletedPickups] = useState(0);
  const [completedHomes, setCompletedHomes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<AgentRatingListVm | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsPage, setRatingsPage] = useState(0);

  const fromIso = useMemo(() => parseYmd(fromYmd).toISOString(), [fromYmd]);

  const toIso = useMemo(() => parseYmd(toYmd, true).toISOString(), [toYmd]);

  useEffect(() => {
    setPage(0);
  }, [fromYmd, toYmd, jobType, agent.agentId]);

  useEffect(() => {
    if (panel !== 'deliveries') return;
    let cancelled = false;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 12000);
    setLoading(true);
    setError(null);
    void (async () => {
      const first = await listAgentAssignments(token, agent.agentId, {
        from: fromIso,
        to: toIso,
        page: 0,
        size: FETCH_SIZE,
        signal: ac.signal,
      });
      const all = [...(first.items ?? [])];
      const pages = Math.max(first.totalPages ?? 1, 1);
      for (let p = 1; p < pages && !cancelled; p += 1) {
        const next = await listAgentAssignments(token, agent.agentId, {
          from: fromIso,
          to: toIso,
          page: p,
          size: FETCH_SIZE,
          signal: ac.signal,
        });
        all.push(...(next.items ?? []));
      }
      if (cancelled) return;
      setRows(all);
      setCompletedPickups(first.completedPickups ?? 0);
      setCompletedHomes(first.completedHomeDeliveries ?? 0);
    })()
      .catch((err) => {
        if (cancelled) return;
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        setError(
          aborted
            ? 'Deliveries timed out. Try This month, or refresh once.'
            : err instanceof ApiError || err instanceof Error
              ? err.message
              : 'Could not load deliveries',
        );
        setRows([]);
        setCompletedPickups(0);
        setCompletedHomes(0);
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [token, agent.agentId, fromIso, toIso, panel]);

  useEffect(() => {
    setRatingsPage(0);
  }, [agent.agentId]);

  useEffect(() => {
    if (panel !== 'ratings') return;
    let cancelled = false;
    setRatingsLoading(true);
    setRatingsError(null);
    void listAgentRatings(token, agent.agentId, ratingsPage)
      .then((data) => {
        if (!cancelled) setRatings(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setRatings(null);
        setRatingsError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load ratings');
      })
      .finally(() => {
        if (!cancelled) setRatingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, agent.agentId, panel, ratingsPage]);

  const visible = useMemo(() => {
    return rows
      .filter((row) => {
        if (jobType === 'all') return true;
        if (jobType === 'LAST_MILE') {
          return row.legType === 'LAST_MILE' || row.legType === 'VENDOR_DIRECT';
        }
        return row.legType === jobType;
      })
      .sort((a, b) => jobWhen(b) - jobWhen(a));
  }, [rows, jobType]);

  const total = visible.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const paged = useMemo(() => {
    const start = Math.max(pageSafe, 0) * PAGE_SIZE;
    return visible.slice(start, start + PAGE_SIZE);
  }, [visible, pageSafe]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  const fromN = total === 0 ? 0 : pageSafe * PAGE_SIZE + 1;
  const toN = Math.min((pageSafe + 1) * PAGE_SIZE, total);

  return createPortal(
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-detail-title"
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <div>
            <h2 id="agent-detail-title" style={styles.title}>
              {agent.name}
            </h2>
            <p style={styles.sub}>
              {townLabel}
              {agent.hubName ? ` · ${agent.hubName}` : ''}
              {` · ${agent.phone}`}
            </p>
          </div>
          <div style={styles.headRight}>
            <span
              style={
                agent.status === 'ACTIVE' ? styles.pillOn : agent.status === 'INACTIVE' ? styles.pillWarn : styles.pillDead
              }
            >
              {agent.status}
            </span>
            <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div style={styles.viewTabs} role="tablist" aria-label="Agent views">
          {(
            [
              ['deliveries', 'Deliveries'],
              ['ratings', 'Ratings'],
              ['log', 'Change log'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={panel === id}
              style={panel === id ? styles.viewTabActive : styles.viewTab}
              onClick={() => setPanel(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={styles.body}>
        {error && panel === 'deliveries' ? <Banner tone="danger">{error}</Banner> : null}

        {panel === 'deliveries' ? (
          <>
            <div style={styles.filters}>
              <div style={styles.filterRow}>
              <DateRangePresetBar
                preset={preset}
                from={fromYmd}
                to={toYmd}
                onPresetChange={setPreset}
                onFromChange={setFromYmd}
                onToChange={setToYmd}
                ariaLabel="Delivery date range"
              />
              <label style={styles.jobField}>
                <select
                  style={styles.jobSelect}
                  value={jobType}
                  aria-label="Job type"
                  onChange={(e) => setJobType(e.target.value as JobType)}
                >
                  <option value="all">All</option>
                  <option value="PICKUP">Shop pickup</option>
                  <option value="LAST_MILE">Home delivery</option>
                </select>
              </label>
              </div>
              <div style={styles.statsRow}>
                <span style={styles.stat}>
                  <strong style={styles.statNum}>{loading ? '—' : completedPickups.toLocaleString('en-IN')}</strong>
                  pickup completed
                </span>
                <span style={styles.stat}>
                  <strong style={styles.statNum}>{loading ? '—' : completedHomes.toLocaleString('en-IN')}</strong>
                  home delivery completed
                </span>
                <span style={styles.meta}>
                  {loading
                    ? 'Loading…'
                    : `${fromN.toLocaleString('en-IN')}–${toN.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} jobs`}
                </span>
              </div>
            </div>
            {loading && rows.length === 0 ? (
              <p style={styles.muted}>Loading deliveries…</p>
            ) : visible.length === 0 ? (
              <p style={styles.muted}>
                {jobType === 'PICKUP'
                  ? 'No shop pickups in this range.'
                  : jobType === 'LAST_MILE'
                    ? 'No home deliveries in this range.'
                    : 'No pickups or deliveries in this range.'}
              </p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>When</th>
                      <th style={styles.th}>Job</th>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((row) => (
                      <tr key={row.assignmentId}>
                        <td style={styles.tdMuted}>{formatWhen(row.completedAt || row.assignedAt)}</td>
                        <td style={styles.td}>{legLabel(row.legType)}</td>
                        <td style={styles.td}>{row.orderNumber || row.assignmentNumber || '—'}</td>
                        <td style={styles.td}>
                          <span style={statusStyle(row.status)}>{String(row.status || '—').replaceAll('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 ? (
              <div style={styles.pager}>
                <Button size="sm" variant="ghost" disabled={pageSafe <= 0 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageSafe + 1 >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        ) : null}

        {panel === 'ratings' ? (
          <div style={styles.ratePanel}>
            {ratingsError ? <Banner tone="danger">{ratingsError}</Banner> : null}
            {ratingsLoading && !ratings ? (
              <p style={styles.placeMeta}>Loading ratings…</p>
            ) : ratings ? (
              <>
                <div style={styles.rateSummary}>
                  <div style={styles.rateScoreBox}>
                    <span style={styles.avgStars}>
                      {ratings.ratingCount > 0 ? ratings.averageStars.toFixed(1) : '—'}
                    </span>
                    <span style={styles.rateScoreLbl}>avg</span>
                  </div>
                  <div style={styles.rateSummaryCopy}>
                    <StarMarks value={ratings.ratingCount > 0 ? ratings.averageStars : 0} size={16} />
                    <span style={styles.placeMeta}>
                      {ratings.ratingCount === 0
                        ? 'No buyer ratings yet'
                        : `${ratings.ratingCount} buyer rating${ratings.ratingCount === 1 ? '' : 's'}`}
                      {ratings.visibleToHub ? '' : ' · hidden from hub'}
                    </span>
                  </div>
                </div>
                {ratings.items.length === 0 ? (
                  <p style={styles.placeBody}>Ratings appear here after a buyer rates a delivered order.</p>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Order</th>
                          <th style={styles.th}>Rating</th>
                          <th style={styles.th}>Comment</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratings.items.map((row) => (
                          <tr key={row.ratingId}>
                            <td style={styles.td}>{row.orderNumber || row.orderId}</td>
                            <td style={styles.td}>
                              <span style={styles.rateStarsCell}>
                                <StarMarks value={row.stars} />
                                <span style={styles.placeMeta}>{row.stars}</span>
                              </span>
                            </td>
                            <td style={styles.td}>{row.comment?.trim() ? row.comment : '—'}</td>
                            <td style={styles.tdMuted}>{formatWhen(row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {ratings.totalPages > 1 ? (
                  <div style={styles.pager}>
                    <span style={{ ...styles.placeMeta, marginRight: 'auto' }}>
                      Page {ratingsPage + 1} of {ratings.totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={ratingsPage <= 0 || ratingsLoading}
                      onClick={() => setRatingsPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={ratingsPage + 1 >= ratings.totalPages || ratingsLoading}
                      onClick={() => setRatingsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {panel === 'log' && token ? (
          <AdminHistoryPanel
            token={token}
            screen="agents"
            townId={agent.townId ?? undefined}
            title="Change log"
            embedded
            tall
          />
        ) : null}
        </div>

        <div style={styles.footer}>
          {agent.status === 'DISABLED' ? (
            <Button size="sm" disabled={busy} onClick={onRestore}>
              {busy ? '…' : 'Restore'}
            </Button>
          ) : (
            <Button size="sm" variant="danger" disabled={busy} onClick={onDisable}>
              {busy ? '…' : 'Disable permanently'}
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(2, 6, 12, 0.5)',
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
  },
  dialog: {
    width: 'min(1120px, calc(100vw - 1rem))',
    height: 'min(94vh, 920px)',
    maxHeight: 'min(94vh, 920px)',
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    padding: '0.7rem 0.85rem',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto',
    gap: '0.4rem',
    boxShadow: '0 18px 48px rgba(2, 6, 12, 0.28)',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  headRight: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    width: 'fit-content',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  body: {
    minHeight: 0,
    overflow: 'auto',
    display: 'grid',
    alignContent: 'start',
    gap: '0.4rem',
  },
  filters: { display: 'grid', gap: '0.35rem' },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem 0.55rem',
  },
  jobField: { marginLeft: 'auto' },
  jobSelect: {
    boxSizing: 'border-box',
    minWidth: 168,
    padding: '0.28rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.85rem',
  },
  stat: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 6,
    fontSize: '0.78rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
  },
  statNum: { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 999,
    padding: '0.22rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover, var(--accent))',
    borderRadius: 999,
    padding: '0.22rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  customRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem' },
  dateField: {
    display: 'grid',
    gap: 2,
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  dateInput: {
    padding: '0.3rem 0.4rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    font: 'inherit',
  },
  meta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 650 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  tableWrap: {
    overflow: 'auto',
    maxHeight: 'min(62vh, 36rem)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: {
    textAlign: 'left',
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted, var(--bg))',
  },
  td: { padding: '0.38rem 0.45rem', borderBottom: '1px solid var(--border)' },
  tdMuted: {
    padding: '0.38rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  pager: { display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' },
  placeholder: {
    border: '1px dashed var(--border)',
    borderRadius: 12,
    padding: '0.75rem 0.8rem',
    display: 'grid',
    gap: '0.35rem',
    background: 'var(--bg)',
  },
  placeTitle: { margin: 0, fontWeight: 800, fontSize: '0.9rem' },
  placeBody: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 },
  placeMeta: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 650 },
  star: { color: 'var(--border)', fontSize: '1.1rem', lineHeight: 1 },
  ratePanel: { display: 'grid', gap: '0.45rem', alignContent: 'start' },
  rateSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  rateScoreBox: {
    display: 'grid',
    justifyItems: 'center',
    minWidth: 52,
    padding: '0.15rem 0.4rem',
    borderRadius: 8,
    background: '#FEF3C7',
  },
  rateScoreLbl: {
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#92400E',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  rateSummaryCopy: { display: 'grid', gap: 2 },
  avgStars: { fontWeight: 800, fontSize: '1.2rem', color: '#92400E', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
  rateStarsCell: { display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  log: { display: 'grid', gap: '0.45rem' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' },
  pillOn: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 999,
    padding: '0.12rem 0.45rem',
  },
  pillWarn: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 999,
    padding: '0.12rem 0.45rem',
  },
  pillOff: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    borderRadius: 999,
    padding: '0.12rem 0.45rem',
  },
  pillDead: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--danger)',
    background: 'var(--danger-soft)',
    borderRadius: 999,
    padding: '0.12rem 0.45rem',
  },
};
