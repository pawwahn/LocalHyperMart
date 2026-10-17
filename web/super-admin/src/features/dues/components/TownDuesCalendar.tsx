import { useEffect, useMemo, useState } from 'react';
import type { DueAction } from '../api/townDuesApi';

export type DuesCalendarItem = {
  id: string;
  action: DueAction;
  who: string;
  town: string;
  what: string;
  amount: number;
  periodStart?: string | null;
  periodEnd?: string | null;
};

type Mode = 'week' | 'month';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ACTIONS: DueAction[] = ['SEND_BILL', 'COLLECT', 'PAY', 'CONFIRM'];

const ACTION_LABEL: Record<DueAction, string> = {
  SEND_BILL: 'Send bill',
  COLLECT: 'Collect',
  PAY: 'Pay',
  CONFIRM: 'Confirm',
};

type Bucket = {
  action: DueAction;
  count: number;
  amount: number;
  items: DuesCalendarItem[];
};

type Focus =
  | { kind: 'span'; action: DueAction }
  | { kind: 'day'; day: string; action?: DueAction }
  | { kind: 'undated'; action: DueAction };

function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function ymd(iso?: string | null): string | null {
  const s = (iso ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = parseUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function startOfWeek(iso: string): string {
  const date = parseUtc(iso);
  const weekday = date.getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDays(iso, -back);
}

function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function monthLabel(iso: string): string {
  return parseUtc(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dayNum(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

function shortDay(iso: string): string {
  return parseUtc(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function overlaps(item: DuesCalendarItem, from: string, to: string): boolean {
  const start = ymd(item.periodStart) ?? ymd(item.periodEnd);
  const end = ymd(item.periodEnd) ?? ymd(item.periodStart);
  if (!start || !end) return false;
  return start <= to && end >= from;
}

function isSpan(item: DuesCalendarItem): boolean {
  const start = ymd(item.periodStart);
  const end = ymd(item.periodEnd);
  return Boolean(start && end && start !== end);
}

function pinDay(item: DuesCalendarItem): string | null {
  return ymd(item.periodStart) ?? ymd(item.periodEnd);
}

function buckets(items: DuesCalendarItem[]): Bucket[] {
  const grouped = new Map<DueAction, DuesCalendarItem[]>();
  for (const item of items) {
    const list = grouped.get(item.action) ?? [];
    list.push(item);
    grouped.set(item.action, list);
  }
  return ACTIONS.filter((action) => grouped.has(action)).map((action) => {
    const list = grouped.get(action) ?? [];
    return {
      action,
      count: list.length,
      amount: list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      items: list,
    };
  });
}

function Pill({
  bucket,
  on,
  onClick,
}: {
  bucket: Bucket;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`dues-cal-pill ${bucket.action}${on ? ' on' : ''}`} onClick={onClick}>
      {ACTION_LABEL[bucket.action]}
      <b>{bucket.count}</b>
      <em>{money(bucket.amount)}</em>
    </button>
  );
}

export function TownDuesCalendar({
  mode,
  items,
  cursor,
  onCursor,
}: {
  mode: Mode;
  items: DuesCalendarItem[];
  cursor: string;
  onCursor: (iso: string) => void;
}) {
  const today = todayIso();
  const [focus, setFocus] = useState<Focus | null>(null);
  const [query, setQuery] = useState('');

  const range = useMemo(() => {
    if (mode === 'week') {
      const from = startOfWeek(cursor);
      return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)), month: '' };
    }
    const [y, m] = cursor.split('-').map(Number);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = toIso(new Date(Date.UTC(y, m, 0)));
    const from = startOfWeek(first);
    const to = addDays(startOfWeek(last), 6);
    const days: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
    return { from, to, days, month: first.slice(0, 7), monthFrom: first, monthTo: last };
  }, [mode, cursor]);

  const spanWindow = mode === 'month'
    ? { from: range.monthFrom ?? range.from, to: range.monthTo ?? range.to }
    : { from: range.from, to: range.to };

  const undated = items.filter((item) => !pinDay(item));
  const spanning = items.filter((item) => isSpan(item) && overlaps(item, spanWindow.from, spanWindow.to));
  const byDay = new Map<string, DuesCalendarItem[]>();
  for (const item of items) {
    if (isSpan(item) || !pinDay(item)) continue;
    const day = pinDay(item)!;
    if (day < range.from || day > range.to) continue;
    if (mode === 'month' && range.month && !day.startsWith(range.month)) continue;
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }

  const spanBuckets = buckets(spanning);
  const undatedBuckets = buckets(undated);
  const inView = spanning.length + [...byDay.values()].reduce((n, list) => n + list.length, 0) + undated.length;

  useEffect(() => {
    setFocus(null);
    setQuery('');
  }, [mode, cursor]);

  const detail = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === 'span') {
      const bucket = spanBuckets.find((row) => row.action === focus.action);
      return bucket
        ? { title: `${mode === 'week' ? 'All week' : 'All month'} · ${ACTION_LABEL[focus.action]}`, items: bucket.items }
        : null;
    }
    if (focus.kind === 'undated') {
      const bucket = undatedBuckets.find((row) => row.action === focus.action);
      return bucket ? { title: `No date · ${ACTION_LABEL[focus.action]}`, items: bucket.items } : null;
    }
    const dayItems = (byDay.get(focus.day) ?? []).filter((item) => !focus.action || item.action === focus.action);
    return { title: shortDay(focus.day), items: dayItems };
  }, [focus, spanBuckets, undatedBuckets, byDay, mode]);

  const shown = useMemo(() => {
    const list = detail?.items ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((item) => `${item.town} ${item.who} ${item.what}`.toLowerCase().includes(q))
      : list;
    return [...filtered].sort((a, b) => b.amount - a.amount || a.town.localeCompare(b.town));
  }, [detail, query]);

  const label = mode === 'week' ? `${shortDay(range.from)} – ${shortDay(range.to)}` : monthLabel(cursor);

  function shift(dir: -1 | 1) {
    if (mode === 'week') {
      onCursor(addDays(cursor, dir * 7));
      return;
    }
    const [y, m] = cursor.split('-').map(Number);
    onCursor(toIso(new Date(Date.UTC(y, m - 1 + dir, 1))));
  }

  function toggle(next: Focus) {
    setQuery('');
    setFocus((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? null : next));
  }

  return (
    <section className="dues-cal">
      <style>{CAL_CSS}</style>
      <div className="dues-cal-nav">
        <button type="button" onClick={() => shift(-1)} aria-label={mode === 'week' ? 'Previous week' : 'Previous month'}>
          ‹
        </button>
        <strong>{label}</strong>
        <button type="button" onClick={() => shift(1)} aria-label={mode === 'week' ? 'Next week' : 'Next month'}>
          ›
        </button>
        <button type="button" className="dues-cal-today" onClick={() => onCursor(today)}>
          {mode === 'week' ? 'This week' : 'This month'}
        </button>
        <span className="dues-cal-meta">{inView} in view</span>
      </div>

      {undatedBuckets.length > 0 ? (
        <div className="dues-cal-band">
          <span>No date</span>
          {undatedBuckets.map((bucket) => (
            <Pill
              key={bucket.action}
              bucket={bucket}
              on={focus?.kind === 'undated' && focus.action === bucket.action}
              onClick={() => toggle({ kind: 'undated', action: bucket.action })}
            />
          ))}
        </div>
      ) : null}

      {spanBuckets.length > 0 ? (
        <div className="dues-cal-band">
          <span>{mode === 'week' ? 'All week' : 'All month'}</span>
          {spanBuckets.map((bucket) => (
            <Pill
              key={bucket.action}
              bucket={bucket}
              on={focus?.kind === 'span' && focus.action === bucket.action}
              onClick={() => toggle({ kind: 'span', action: bucket.action })}
            />
          ))}
        </div>
      ) : null}

      <div className="dues-cal-weekdays">
        {WEEKDAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className={mode === 'week' ? 'dues-cal-grid week' : 'dues-cal-grid month'}>
        {range.days.map((day) => {
          const list = byDay.get(day) ?? [];
          const dayBuckets = buckets(list);
          const outside = mode === 'month' && !!range.month && !day.startsWith(range.month);
          const selected = focus?.kind === 'day' && focus.day === day;
          return (
            <div key={day} className={`dues-cal-day${day === today ? ' today' : ''}${outside ? ' outside' : ''}${selected ? ' on' : ''}`}>
              <header>
                <b>{mode === 'week' ? shortDay(day) : dayNum(day)}</b>
              </header>
              {dayBuckets.map((bucket) => (
                <button
                  key={bucket.action}
                  type="button"
                  className={`dues-cal-pill ${bucket.action}${selected && focus.action === bucket.action ? ' on' : ''}`}
                  onClick={() => toggle({ kind: 'day', day, action: bucket.action })}
                >
                  <b>{bucket.count}</b>
                  <em>{money(bucket.amount)}</em>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {detail ? (
        <div className="dues-cal-detail">
          <header>
            <strong>
              {detail.title} · {shown.length}
              {shown.length !== detail.items.length ? ` of ${detail.items.length}` : ''}
            </strong>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Town, who, or what"
              aria-label="Filter towns"
            />
            <button type="button" onClick={() => setFocus(null)}>
              Close
            </button>
          </header>
          <div className="dues-cal-detail-scroll">
            <table>
              <thead>
                <tr>
                  <th>Town</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.id}>
                    <td>{item.town}</td>
                    <td>{item.who}</td>
                    <td>{item.what}</td>
                    <td className={item.action}>{money(item.amount)}</td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No match.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const CAL_CSS = `
.dues-cal { display: grid; gap: 0.35rem; }
.dues-cal-nav { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.dues-cal-nav strong { font-size: 0.92rem; min-width: 9.5rem; }
.dues-cal-nav > button, .dues-cal-today {
  min-height: 2rem; min-width: 2rem; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text); font: inherit; font-weight: 800; cursor: pointer;
}
.dues-cal-today { padding: 0 0.55rem; font-size: 0.75rem; }
.dues-cal-meta { margin-left: auto; font-size: 0.72rem; color: var(--text-muted); font-weight: 700; }
.dues-cal-band {
  display: flex; flex-wrap: wrap; gap: 0.28rem; align-items: center;
}
.dues-cal-band > span { font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
.dues-cal-pill {
  display: inline-flex; align-items: baseline; gap: 0.28rem; max-width: 100%;
  border: 1px solid transparent; border-radius: 999px; min-height: 1.45rem; padding: 0.05rem 0.45rem;
  font: inherit; font-size: 0.68rem; font-weight: 750; cursor: pointer; white-space: nowrap;
}
.dues-cal-pill b { font-variant-numeric: tabular-nums; }
.dues-cal-pill em { font-style: normal; font-weight: 800; font-variant-numeric: tabular-nums; }
.dues-cal-pill.SEND_BILL { color: #c2410c; background: #fff7ed; }
.dues-cal-pill.COLLECT { color: #15803d; background: #f0fdf4; }
.dues-cal-pill.PAY { color: #b91c1c; background: #fef2f2; }
.dues-cal-pill.CONFIRM { color: #1d4ed8; background: #eff6ff; }
.dues-cal-pill.on { box-shadow: inset 0 0 0 1.5px currentColor; }
.dues-cal-weekdays, .dues-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.28rem; }
.dues-cal-weekdays span {
  font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; padding: 0 0.15rem;
}
.dues-cal-day {
  display: grid; align-content: start; gap: 0.16rem; min-width: 0;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elevated); padding: 0.2rem;
}
.dues-cal-grid.month .dues-cal-day { min-height: 3.15rem; }
.dues-cal-grid.week .dues-cal-day { min-height: 4.4rem; }
.dues-cal-day.today { border-color: var(--accent); }
.dues-cal-day.on { box-shadow: inset 0 0 0 1.5px var(--accent); }
.dues-cal-day.outside { opacity: 0.4; }
.dues-cal-day header b { font-size: 0.75rem; }
.dues-cal-day .dues-cal-pill { width: 100%; justify-content: space-between; border-radius: 6px; padding: 0.08rem 0.28rem; }
.dues-cal-detail { display: grid; gap: 0.28rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); padding: 0.35rem 0.4rem; }
.dues-cal-detail header { display: flex; align-items: center; gap: 0.4rem; }
.dues-cal-detail header strong { font-size: 0.8rem; white-space: nowrap; }
.dues-cal-detail input {
  flex: 1; min-width: 8rem; height: 2rem; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 0.45rem; background: var(--bg-elevated); color: var(--text); font: inherit; font-size: 0.78rem;
}
.dues-cal-detail header button {
  min-height: 2rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elevated);
  padding: 0 0.55rem; font: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer;
}
.dues-cal-detail-scroll { max-height: 14rem; overflow: auto; }
.dues-cal-detail table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.dues-cal-detail th {
  position: sticky; top: 0; text-align: left; background: var(--bg); color: var(--text-muted);
  font-size: 0.68rem; padding: 0.2rem 0.35rem; border-bottom: 1px solid var(--border);
}
.dues-cal-detail td { padding: 0.22rem 0.35rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.dues-cal-detail td:last-child, .dues-cal-detail th:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; white-space: nowrap; }
.dues-cal-detail td.SEND_BILL { color: #c2410c; }
.dues-cal-detail td.COLLECT { color: #15803d; }
.dues-cal-detail td.PAY { color: #b91c1c; }
.dues-cal-detail td.CONFIRM { color: #1d4ed8; }
@media (max-width: 800px) {
  .dues-cal-grid.week { grid-template-columns: 1fr; }
  .dues-cal-weekdays { display: none; }
  .dues-cal-grid.month { grid-template-columns: repeat(7, minmax(4.2rem, 1fr)); }
}
`;
