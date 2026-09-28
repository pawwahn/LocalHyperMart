import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { DailyRow } from '../api/platformReportsApi';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Parts = { y: number; m: number; d: number };

function parseIso(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthsBetween(from: string, to: string): string[] {
  const start = parseIso(from);
  const end = parseIso(to);
  if (!start || !end) return [];
  const out: string[] = [];
  let y = start.y;
  let m = start.m;
  const endKey = end.y * 12 + end.m;
  while (y * 12 + m <= endKey && out.length < 14) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthTitle(key: string): string {
  const parts = parseIso(`${key}-01`);
  if (!parts) return key;
  return new Date(parts.y, parts.m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function monthChip(key: string, multiYear: boolean): string {
  const parts = parseIso(`${key}-01`);
  if (!parts) return key;
  const name = new Date(parts.y, parts.m - 1, 1).toLocaleString('en-IN', { month: 'short' });
  return multiYear ? `${name} ${parts.y}` : name;
}

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

function addMonths(key: string, delta: number): string {
  const parts = parseIso(`${key}-01`);
  if (!parts) return key;
  const date = new Date(parts.y, parts.m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastDay(key: string): string {
  const parts = parseIso(`${key}-01`);
  if (!parts) return `${key}-28`;
  return iso(parts.y, parts.m, new Date(parts.y, parts.m, 0).getDate());
}

function daysInclusive(from: string, to: string): number {
  const start = parseIso(from);
  const end = parseIso(to);
  if (!start || !end) return 0;
  const ms = Date.UTC(end.y, end.m - 1, end.d) - Date.UTC(start.y, start.m - 1, start.d);
  return Math.round(ms / 86400000) + 1;
}

export function coverMonth(currentFrom: string, currentTo: string, key: string, today: string): { from: string; to: string } {
  const start = `${key}-01`;
  const endFull = lastDay(key);
  const end = endFull > today ? today : endFull;
  let nextFrom = currentFrom.slice(0, 10) < start ? currentFrom.slice(0, 10) : start;
  let nextTo = currentTo.slice(0, 10) > end ? currentTo.slice(0, 10) : end;
  if (nextFrom > nextTo || daysInclusive(nextFrom, nextTo) > 366) {
    nextFrom = start;
    nextTo = end;
  }
  return { from: nextFrom, to: nextTo };
}

export function DailyCalendar({
  rows,
  from,
  to,
  today,
  onEnsureMonth,
}: {
  rows: DailyRow[];
  from: string;
  to: string;
  today: string;
  onEnsureMonth: (monthKey: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, DailyRow>();
    for (const row of rows) map.set(row.date.slice(0, 10), row);
    return map;
  }, [rows]);

  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const multiYear = months.length > 0 && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
  const [monthKey, setMonthKey] = useState(() => months[months.length - 1] ?? '');

  useEffect(() => {
    setMonthKey((current) => (months.includes(current) ? current : (months[months.length - 1] ?? '')));
  }, [months]);

  const activeKey = monthKey || months[months.length - 1] || '';
  const parts = parseIso(`${activeKey}-01`);
  const nextKey = addMonths(activeKey, 1);
  const nextDisabled = !activeKey || `${nextKey}-01` > today.slice(0, 10);

  const cells = useMemo(() => {
    if (!parts) return [];
    const firstWeekday = new Date(parts.y, parts.m - 1, 1).getDay();
    const lead = (firstWeekday + 6) % 7;
    const days = new Date(parts.y, parts.m, 0).getDate();
    const grid: Array<number | null> = [];
    for (let i = 0; i < lead; i += 1) grid.push(null);
    for (let day = 1; day <= days; day += 1) grid.push(day);
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [parts?.y, parts?.m]);

  if (!parts || months.length === 0) {
    return <p style={styles.empty}>No days in this range.</p>;
  }

  let orders = 0;
  let delivered = 0;
  let cancelled = 0;
  let gmv = 0;
  for (let day = 1; day <= new Date(parts.y, parts.m, 0).getDate(); day += 1) {
    const key = iso(parts.y, parts.m, day);
    if (key < from.slice(0, 10) || key > to.slice(0, 10)) continue;
    const row = byDate.get(key);
    orders += row?.orders ?? 0;
    delivered += row?.delivered ?? 0;
    cancelled += row?.cancelled ?? 0;
    gmv += row?.gmv ?? 0;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.nav}>
        <button
          type="button"
          style={styles.arrow}
          aria-label="Previous month"
          onClick={() => {
            const prev = addMonths(activeKey, -1);
            setMonthKey(prev);
            if (!months.includes(prev)) onEnsureMonth(prev);
          }}
        >
          ‹
        </button>
        <strong style={styles.title}>{monthTitle(activeKey)}</strong>
        <button
          type="button"
          style={{ ...styles.arrow, opacity: nextDisabled ? 0.35 : 1 }}
          aria-label="Next month"
          disabled={nextDisabled}
          onClick={() => {
            if (nextDisabled) return;
            setMonthKey(nextKey);
            if (!months.includes(nextKey)) onEnsureMonth(nextKey);
          }}
        >
          ›
        </button>
        <span style={styles.totals}>
          Orders {orders} · Delivered {delivered} · Cancelled {cancelled} · {money(gmv)}
        </span>
      </div>
      {months.length > 1 ? (
        <div style={styles.chips}>
          {months.map((key) => (
            <button
              key={key}
              type="button"
              style={key === activeKey ? styles.chipOn : styles.chip}
              onClick={() => setMonthKey(key)}
            >
              {monthChip(key, multiYear)}
            </button>
          ))}
        </div>
      ) : null}
      <div style={styles.scroll}>
        <div style={styles.grid}>
          {WEEKDAYS.map((name) => (
            <span key={name} style={styles.weekday}>
              {name}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day == null || !parts) {
              return <div key={`pad-${i}`} style={styles.pad} />;
            }
            const key = iso(parts.y, parts.m, day);
            const inRange = key >= from.slice(0, 10) && key <= to.slice(0, 10);
            if (!inRange) {
              return (
                <div key={key} style={styles.outside}>
                  <span style={styles.dayMuted}>{day}</span>
                </div>
              );
            }
            const row = byDate.get(key);
            const quiet = (row?.orders ?? 0) === 0 && (row?.delivered ?? 0) === 0 && (row?.cancelled ?? 0) === 0;
            return (
              <div key={key} style={quiet ? styles.cellQuiet : styles.cell}>
                <span style={styles.day}>{day}</span>
                <span>Orders {row?.orders ?? 0}</span>
                <span>Delivered {row?.delivered ?? 0}</span>
                <span>Cancelled {row?.cancelled ?? 0}</span>
                <span style={styles.gmv}>{money(row?.gmv)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.4rem' },
  nav: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '1.1rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  title: { fontSize: '0.92rem', fontWeight: 800, minWidth: '9rem' },
  totals: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.28rem' },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    padding: '0.22rem 0.5rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: 999,
    padding: '0.22rem 0.5rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  scroll: { overflowX: 'auto' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(112px, 1fr))',
    gap: '0.28rem',
  },
  weekday: {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    padding: '0 0.15rem',
  },
  pad: { minHeight: 92 },
  outside: {
    minHeight: 92,
    borderRadius: 8,
    padding: '0.28rem 0.35rem',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
  },
  cell: {
    minHeight: 92,
    borderRadius: 8,
    padding: '0.28rem 0.35rem',
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    display: 'grid',
    alignContent: 'start',
    gap: '0.02rem',
    fontSize: '0.68rem',
    lineHeight: 1.25,
  },
  cellQuiet: {
    minHeight: 92,
    borderRadius: 8,
    padding: '0.28rem 0.35rem',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    alignContent: 'start',
    gap: '0.02rem',
    fontSize: '0.68rem',
    lineHeight: 1.25,
    color: 'var(--text-muted)',
  },
  day: { fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' },
  dayMuted: { fontSize: '0.85rem', fontWeight: 700 },
  gmv: { fontWeight: 800 },
  empty: { margin: 0, padding: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' },
};
