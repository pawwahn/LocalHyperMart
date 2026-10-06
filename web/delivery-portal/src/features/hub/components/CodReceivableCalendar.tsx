import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Card, Button } from '@/shared/ui';
import { ApiError } from '@/shared/api/http';
import { fetchCodCustodianPendingDetail, type CodCustodianPendingDetail } from '../api/codApi';
import {
  codMoney,
  daysInMonth,
  monthBoundsIst,
  parseMonthFromIso,
  todayIstIso,
  weekdayIst,
} from '../lib/codFormat';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  token: string;
  townId: string;
  hubId: string;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
};

function dayTotal(day: CodCustodianPendingDetail['days'][number]): number {
  return Number(day.stillWithAgentsAmount ?? 0) + Number(day.declaredAwaitingAmount ?? 0);
}

export function CodReceivableCalendar({ token, townId, hubId, selectedDate, onSelectDate }: Props) {
  const initial = parseMonthFromIso(selectedDate || todayIstIso());
  const [year, setYear] = useState(initial.year);
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);
  const [data, setData] = useState<CodCustodianPendingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(
    () =>
      new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [year, monthIndex],
  );

  const amountByDate = useMemo(() => {
    const map = new Map<string, { total: number; orders: number }>();
    for (const day of data?.days ?? []) {
      const total = dayTotal(day);
      if (total <= 0 && (day.stillWithAgentsOrderCount ?? 0) + (day.declaredAwaitingOrderCount ?? 0) <= 0) {
        continue;
      }
      map.set(day.date, {
        total,
        orders: (day.stillWithAgentsOrderCount ?? 0) + (day.declaredAwaitingOrderCount ?? 0),
      });
    }
    return map;
  }, [data]);

  const loadMonth = useCallback(async () => {
    if (!token || !townId || !hubId) return;
    const { from, to } = monthBoundsIst(year, monthIndex);
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchCodCustodianPendingDetail(token, { townId, hubId, from, to });
      setData(detail);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load calendar');
    } finally {
      setLoading(false);
    }
  }, [token, townId, hubId, year, monthIndex]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  function shiftMonth(delta: number) {
    let m = monthIndex + delta;
    let y = year;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setMonthIndex(m);
    setYear(y);
  }

  const cells = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstIso = `${year}-${pad(monthIndex + 1)}-01`;
    const startPad = weekdayIst(firstIso);
    const totalDays = daysInMonth(year, monthIndex);
    const grid: Array<{ iso: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startPad; i++) grid.push({ iso: null, dayNum: null });
    for (let d = 1; d <= totalDays; d++) {
      grid.push({ iso: `${year}-${pad(monthIndex + 1)}-${pad(d)}`, dayNum: d });
    }
    return grid;
  }, [year, monthIndex]);

  const monthTotal = useMemo(() => {
    let sum = 0;
    for (const v of amountByDate.values()) sum += v.total;
    return sum;
  }, [amountByDate]);

  const today = todayIstIso();

  return (
    <Card elevated padding="sm" style={styles.shell}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>Cash to receive — calendar</h2>
          <p style={styles.sub}>
            Pending COD by delivery day (IST). Tap a day to open details in the Day view.
          </p>
        </div>
        <div style={styles.nav}>
          <Button type="button" variant="ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </Button>
          <span style={styles.monthLabel}>{monthLabel}</span>
          <Button type="button" variant="ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </Button>
        </div>
      </div>

      {loading ? <p style={styles.muted}>Loading {monthLabel}…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {!loading && !error ? (
        <>
          <p style={styles.monthTotal}>
            <span style={styles.monthTotalLabel}>Month pending to collect</span>
            <strong style={styles.monthTotalAmount}>{codMoney(monthTotal, true)}</strong>
          </p>
          <div style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <span key={w} style={styles.weekHead}>
                {w}
              </span>
            ))}
          </div>
          <div style={styles.grid}>
            {cells.map((cell, idx) => {
              if (!cell.iso || cell.dayNum == null) {
                return <div key={`pad-${idx}`} style={styles.cellEmpty} />;
              }
              const entry = amountByDate.get(cell.iso);
              const hasCash = entry && entry.total > 0;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  style={{
                    ...styles.cell,
                    ...(hasCash ? styles.cellHasCash : null),
                    ...(isSelected ? styles.cellSelected : null),
                    ...(isToday ? styles.cellToday : null),
                  }}
                  onClick={() => onSelectDate(cell.iso!)}
                  aria-label={
                    hasCash
                      ? `${cell.iso}, collect ${codMoney(entry!.total, true)}`
                      : `${cell.iso}, no pending COD`
                  }
                >
                  <span style={styles.cellDay}>{cell.dayNum}</span>
                  {hasCash ? (
                    <span style={styles.cellAmount}>{codMoney(entry!.total, true)}</span>
                  ) : (
                    <span style={styles.cellDash}>—</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  head: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sub: { margin: '0.12rem 0 0', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  nav: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
  monthLabel: { fontWeight: 800, fontSize: '0.88rem', minWidth: '9rem', textAlign: 'center' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 700 },
  monthTotal: {
    margin: 0,
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.35rem 0.5rem',
  },
  monthTotalLabel: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  monthTotalAmount: {
    fontSize: '1.35rem',
    fontWeight: 900,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.25rem',
  },
  weekHead: {
    textAlign: 'center',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.25rem',
  },
  cellEmpty: { minHeight: 52 },
  cell: {
    minHeight: 52,
    padding: '0.28rem 0.2rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.08rem',
    alignContent: 'start',
    cursor: 'pointer',
    textAlign: 'center',
  },
  cellHasCash: {
    background: 'var(--accent-soft)',
    borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
  },
  cellSelected: {
    outline: '2px solid var(--accent)',
    outlineOffset: -1,
  },
  cellToday: {
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)',
  },
  cellDay: { fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.1 },
  cellAmount: {
    fontSize: '0.62rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--accent-hover)',
    lineHeight: 1.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cellDash: { fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 },
};
