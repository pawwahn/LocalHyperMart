import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { fetchMyVisitsHistory, type DiagnosticsVendorOrder } from '../api/diagnosticsApi';
import { monthBounds, shiftMonth, visitHistoryDayKey } from '../lib/diagnosticsMyVisits';
import { DiagnosticsDispatchOrderCards } from './DiagnosticsDispatchOrderCards';

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function todayMonthAnchor(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthLabel(anchor: string): string {
  const [y, m] = anchor.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function buildMonthGrid(anchor: string): Array<{ ymd: string; inMonth: boolean }> {
  const [y, m] = anchor.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDate = new Date(y, m, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: Array<{ ymd: string; inMonth: boolean }> = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ ymd: '', inMonth: false });
  }
  for (let d = 1; d <= lastDate; d++) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ ymd: `${y}-${mm}-${dd}`, inMonth: true });
  }
  return cells;
}

export function DiagnosticsMyVisitsHistoryPanel({
  token,
  active,
  reloadToken,
  selfStaffId,
  selfDisplayName,
  expandedVisitId,
  onExpandedVisitIdChange,
  idPrefix,
}: {
  token: string;
  active: boolean;
  reloadToken?: number;
  selfStaffId?: string | null;
  selfDisplayName?: string | null;
  expandedVisitId: string | null;
  onExpandedVisitIdChange: (id: string | null) => void;
  idPrefix: string;
}) {
  const [monthAnchor, setMonthAnchor] = useState(todayMonthAnchor);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [monthRows, setMonthRows] = useState<DiagnosticsVendorOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadMonth = useCallback(() => {
    if (!token || !active) return;
    const { from, to } = monthBounds(monthAnchor);
    setLoading(true);
    setError(null);
    void fetchMyVisitsHistory(token, from, to, debouncedSearch || undefined)
      .then((rows) => {
        setMonthRows(rows);
        setSelectedDay((prev) => {
          if (prev && rows.some((o) => visitHistoryDayKey(o) === prev)) return prev;
          const keys = new Set(rows.map((o) => visitHistoryDayKey(o)).filter(Boolean));
          if (keys.size === 1) return [...keys][0]!;
          return null;
        });
      })
      .catch((err) => {
        setMonthRows([]);
        const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Could not load history';
        if (err instanceof ApiError && err.status === 403 && /staff login/i.test(msg)) {
          setError('History is for collection staff logins. Sign in with your staff phone, not the shop owner account.');
        } else if (err instanceof ApiError && err.status >= 500) {
          setError('History failed to load — restart order-service, then refresh this tab.');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [token, active, monthAnchor, debouncedSearch]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth, reloadToken]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of monthRows) {
      const key = visitHistoryDayKey(order);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [monthRows]);

  const grid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);

  const listForDay = useMemo(() => {
    if (!selectedDay) return monthRows;
    return monthRows.filter((o) => visitHistoryDayKey(o) === selectedDay);
  }, [monthRows, selectedDay]);

  return (
    <div style={styles.wrap}>
      <div style={styles.searchRow}>
        <input
          style={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order no., patient, phone…"
          aria-label="Search history"
        />
        {loading ? <span style={styles.loadHint}>Loading…</span> : null}
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      <div style={styles.calHead}>
        <button type="button" style={styles.navBtn} onClick={() => setMonthAnchor((m) => shiftMonth(m, -1))} aria-label="Previous month">
          ‹
        </button>
        <span style={styles.monthTitle}>{monthLabel(monthAnchor)}</span>
        <button type="button" style={styles.navBtn} onClick={() => setMonthAnchor((m) => shiftMonth(m, 1))} aria-label="Next month">
          ›
        </button>
      </div>
      <div style={styles.dow}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} style={styles.dowCell}>
            {d}
          </span>
        ))}
      </div>
      <div style={styles.grid}>
        {grid.map((cell, i) => {
          if (!cell.inMonth || !cell.ymd) {
            return <span key={`pad-${i}`} style={styles.dayPad} />;
          }
          const count = countsByDay.get(cell.ymd) ?? 0;
          const on = selectedDay === cell.ymd;
          return (
            <button
              key={cell.ymd}
              type="button"
              style={{
                ...styles.dayBtn,
                ...(on ? styles.dayOn : null),
                ...(count > 0 ? styles.dayHas : null),
              }}
              onClick={() => setSelectedDay((prev) => (prev === cell.ymd ? null : cell.ymd))}
              title={count > 0 ? `${count} report(s)` : 'No reports'}
            >
              <span>{Number(cell.ymd.slice(8))}</span>
              {count > 0 ? <span style={styles.dot}>{count}</span> : null}
            </button>
          );
        })}
      </div>
      <p style={styles.listHint}>
        {selectedDay
          ? `${listForDay.length} record(s) · ${formatYmd(selectedDay)}`
          : `${monthRows.length} record(s) this month — tap a day to filter`}
      </p>
      {listForDay.length === 0 && !loading ? (
        <p style={styles.empty}>No completed reports for this selection.</p>
      ) : (
        <DiagnosticsDispatchOrderCards
          orders={listForDay}
          canDispatch={false}
          singleExpanded
          hideMaps
          expandedOrderId={expandedVisitId}
          onExpandedOrderIdChange={onExpandedVisitIdChange}
          idPrefix={idPrefix}
          selfStaffId={selfStaffId}
          selfDisplayName={selfDisplayName}
        />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.4rem', minWidth: 0 },
  searchRow: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  search: {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.42rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    fontSize: '0.78rem',
  },
  loadHint: { fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 },
  error: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)' },
  calHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' },
  navBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: 800,
  },
  monthTitle: { fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' },
  dow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
    marginTop: '0.15rem',
  },
  dowCell: {
    textAlign: 'center',
    fontSize: '0.58rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 3,
  },
  dayPad: { minHeight: 36 },
  dayBtn: {
    position: 'relative',
    minHeight: 36,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 0,
  },
  dayHas: {
    color: 'var(--text)',
    borderColor: 'color-mix(in srgb, #34d399 45%, var(--border))',
    background: 'color-mix(in srgb, #ecfdf5 55%, #fff)',
  },
  dayOn: {
    borderColor: '#059669',
    background: 'linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)',
    color: '#064e3b',
    boxShadow: '0 0 0 1px #059669',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 3,
    fontSize: '0.52rem',
    fontWeight: 900,
    lineHeight: 1,
    color: 'inherit',
  },
  listHint: { margin: '0.15rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 650 },
  empty: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
};
