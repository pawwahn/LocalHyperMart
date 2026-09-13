import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Button, Card } from '@/shared/ui';
import {
  formatAuditActor,
  formatAuditChange,
  formatAuditWhen,
  listAdminAudit,
  type AdminAuditEntry,
} from './adminAuditApi';

export type HistoryTab = { id: string; label: string; screen: string };

const PAGE_SIZE = 25;

type DateRange = '7d' | '30d' | 'all';

type Props = {
  token: string;
  screen?: string;
  screens?: string[];
  tabs?: HistoryTab[];
  townId?: string;
  townNames?: Record<string, string>;
  title?: string;
  refreshTick?: number;
  tall?: boolean;
  requireTown?: boolean;
  embedded?: boolean;
  emptyHint?: string;
};

function screenKeys(screen?: string, screens?: string[], tabs?: HistoryTab[]): string[] {
  if (tabs?.length) return tabs.map((t) => t.screen);
  const keys = screens?.length ? screens : screen ? [screen] : [];
  return [...new Set(keys.filter(Boolean))];
}

function rangeFrom(range: DateRange): string | undefined {
  if (range === 'all') return undefined;
  const days = range === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function LastChangeStrip({
  token,
  screen,
  townId,
  refreshTick = 0,
  onSeeAll,
}: {
  token: string;
  screen: string;
  townId?: string;
  refreshTick?: number;
  onSeeAll: () => void;
}) {
  const [row, setRow] = useState<AdminAuditEntry | null>(null);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listAdminAudit(token, screen, { townId, page: 0, size: 1 })
      .then((data) => {
        if (cancelled) return;
        setRow(data.items[0] ?? null);
        setTotal(data.totalElements);
      })
      .catch(() => {
        if (!cancelled) {
          setRow(null);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, screen, townId, refreshTick]);

  return (
    <button type="button" style={styles.strip} onClick={onSeeAll}>
      <span style={styles.stripLabel}>Last change</span>
      <span style={styles.stripBody}>
        {!ready
          ? 'Loading…'
          : row
            ? `${formatAuditWhen(row.createdAt)} · ${formatAuditActor(row)} · ${formatAuditChange(row)}`
            : 'None yet — save to create the first row'}
      </span>
      <span style={styles.stripLink}>{total > 1 ? `All ${total.toLocaleString('en-IN')}` : 'All changes'}</span>
    </button>
  );
}

export function AdminHistoryPanel({
  token,
  screen,
  screens,
  tabs,
  townId,
  townNames,
  title = 'Change history',
  refreshTick = 0,
  tall = false,
  requireTown = false,
  embedded = false,
  emptyHint,
}: Props) {
  const [rows, setRows] = useState<AdminAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState(tabs?.[0]?.id ?? '');
  const [page, setPage] = useState(0);
  const [pageDraft, setPageDraft] = useState('1');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [range, setRange] = useState<DateRange>('all');
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const allKeys = screenKeys(screen, screens, tabs).join('|');
  const activeScreen = tabs?.length ? (tabs.find((t) => t.id === tabId) ?? tabs[0]).screen : allKeys.split('|')[0];

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qDraft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [qDraft]);

  useEffect(() => {
    setPage(0);
    setPageDraft('1');
  }, [activeScreen, townId, refreshTick, range, q]);

  const load = useCallback(async () => {
    if (!token || !activeScreen) return;
    if (requireTown && !townId) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminAudit(token, activeScreen, {
        townId,
        page,
        size: PAGE_SIZE,
        from: rangeFrom(range),
        q: q || undefined,
      });
      setRows(data.items);
      setTotal(data.totalElements);
      setTotalPages(Math.max(data.totalPages, 1));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load history');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, activeScreen, townId, requireTown, page, range, q]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  function goToPage(raw: number) {
    const next = Math.min(Math.max(raw, 0), Math.max(totalPages - 1, 0));
    setPage(next);
    setPageDraft(String(next + 1));
  }

  const pager = !requireTown && (total > 0 || loading) ? (
    <div style={styles.pager}>
      <span style={styles.pageMeta}>
        {loading ? '…' : `${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}
      </span>
      {totalPages > 1 ? (
        <>
          <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => goToPage(0)}>
            First
          </Button>
          <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => goToPage(page - 1)}>
            Prev
          </Button>
          <label style={styles.pageJump}>
            Page
            <input
              style={styles.pageInput}
              inputMode="numeric"
              value={pageDraft}
              aria-label="Page number"
              onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goToPage(Math.max(1, Number(pageDraft) || 1) - 1);
              }}
              onBlur={() => goToPage(Math.max(1, Number(pageDraft) || 1) - 1)}
            />
            of {totalPages.toLocaleString('en-IN')}
          </label>
          <Button
            size="sm"
            variant="ghost"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => goToPage(totalPages - 1)}
          >
            Last
          </Button>
        </>
      ) : null}
    </div>
  ) : null;

  const body = (
    <>
      <div style={styles.headRow}>
        <h2 style={embedded ? styles.titleEmbed : styles.title}>
          {title} <span style={styles.count}>{loading ? '…' : total.toLocaleString('en-IN')}</span>
        </h2>
        {tabs?.length ? (
          <div style={styles.tabs}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                style={t.id === (tabId || tabs[0].id) ? styles.tabActive : styles.tab}
                onClick={() => setTabId(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {!requireTown ? (
        <div style={styles.filters}>
          <input
            style={styles.search}
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Search what changed…"
            aria-label="Search history"
          />
          <div style={styles.tabs} role="group" aria-label="Date range">
            {(
              [
                ['7d', '7 days'],
                ['30d', '30 days'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={range === id ? styles.tabActive : styles.tab}
                onClick={() => setRange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {pager}
      {total >= 100 ? (
        <p style={styles.hint}>
          {total.toLocaleString('en-IN')} rows stay in the database. This screen loads 25 at a time — use date or
          search, never scroll a full dump.
        </p>
      ) : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {requireTown && !townId ? (
        <p style={styles.muted}>
          {emptyHint || 'Search a town above to see its settings, pay, and enable/disable history.'}
        </p>
      ) : loading ? (
        <p style={styles.muted}>Loading history…</p>
      ) : rows.length === 0 ? (
        <p style={styles.muted}>
          {embedded ? 'No changes in this range. Save to create the first audit row.' : 'No changes in this filter yet.'}
        </p>
      ) : (
        <div style={tall || embedded ? styles.wrapFill : styles.wrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>When</th>
                <th style={styles.th}>Who</th>
                <th style={styles.th}>What changed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.tdMuted}>{formatAuditWhen(row.createdAt)}</td>
                  <td style={styles.tdMuted}>{formatAuditActor(row)}</td>
                  <td style={styles.td}>
                    {formatAuditChange(row, row.townId ? townNames?.[row.townId] : undefined)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div style={styles.embed}>{body}</div>;
  }
  return (
    <Card padding="sm" style={styles.card}>
      {body}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.4rem' },
  embed: { display: 'grid', gap: '0.4rem', minHeight: 0, alignContent: 'start' },
  headRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
  },
  titleEmbed: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 800,
  },
  count: { color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.8rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 650 },
  error: { margin: 0, color: '#b91c1c', fontSize: '0.78rem', fontWeight: 650 },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem',
  },
  search: {
    flex: '1 1 180px',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.35rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.8rem',
    fontWeight: 650,
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    width: 'fit-content',
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  tab: {
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
  tabActive: {
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
  wrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: '16rem',
    overflowY: 'auto',
  },
  wrapFill: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(58vh, 28rem)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.78rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.32rem 0.45rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
  },
  td: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  pager: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
  },
  pageMeta: { marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 650 },
  pageJump: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 650,
  },
  pageInput: {
    width: 44,
    boxSizing: 'border-box',
    padding: '0.18rem 0.3rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.75rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  strip: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
    padding: '0.4rem 0.55rem',
    cursor: 'pointer',
    minHeight: 40,
  },
  stripLabel: {
    fontSize: '0.66rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  stripBody: {
    fontSize: '0.78rem',
    fontWeight: 650,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  stripLink: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--accent-hover, var(--accent))',
    whiteSpace: 'nowrap',
  },
};
