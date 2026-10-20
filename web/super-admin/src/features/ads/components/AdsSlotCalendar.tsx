import { useMemo, type CSSProperties } from 'react';
import type { TownAdSlot } from '../api/adsApi';
import {
  AD_SLOT_ROWS,
  type AdOccupancyBooking,
} from '../api/adsBillingApi';
import { formatIsoDateRange } from '@/shared/dates/formatDateRange';

export type AdRoom = (typeof AD_SLOT_ROWS)[number];

type Props = {
  year: number;
  month: number;
  bookings: AdOccupancyBooking[];
  highlightFrom?: string;
  highlightTo?: string;
  /** Only this room is painted as the current stay. Other rooms stay free. */
  highlightSlot?: TownAdSlot;
  highlightIndex?: number;
  slot?: TownAdSlot;
  slotIndex?: number;
  /** Rooms turned off on Creatives. Keys are `SLOT:index`. */
  blockedRooms?: string[];
  /** Stay whose dates are being moved. Its own cells stay selectable. */
  editingInvoiceId?: string;
  onPickDate?: (iso: string, booking: AdOccupancyBooking | null, room: AdRoom) => void;
  onClearPick?: () => void;
};

function isoDay(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function covers(b: AdOccupancyBooking, iso: string): boolean {
  return b.fromDate <= iso && b.toDate >= iso;
}

const STAY_COLORS = ['#0f766e', '#b45309', '#1d4ed8', '#7c3aed', '#be123c', '#047857', '#9a3412', '#0369a1'];

function stayColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 33 + name.charCodeAt(i)) >>> 0;
  return STAY_COLORS[hash % STAY_COLORS.length];
}

export function AdsSlotCalendar({
  year,
  month,
  bookings,
  highlightFrom,
  highlightTo,
  highlightSlot,
  highlightIndex,
  slot,
  slotIndex,
  blockedRooms,
  editingInvoiceId,
  onPickDate,
  onClearPick,
}: Props) {
  const days = new Date(year, month + 1, 0).getDate();
  const dayNums = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);
  const rows = slot
    ? AD_SLOT_ROWS.filter((r) => r.slot === slot && (slotIndex == null || r.slotIndex === slotIndex))
    : AD_SLOT_ROWS;
  const today = (() => {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
  })();

  const columns = `5.6rem repeat(${days}, minmax(16px, 1fr))`;

  return (
    <div style={styles.wrap}>
      <div style={styles.stack}>
        <div style={{ ...styles.grid, gridTemplateColumns: columns }}>
          <span style={styles.head}>Room</span>
          {dayNums.map((d) => {
            const iso = isoDay(year, month, d);
            return (
              <span key={d} style={{ ...styles.headDay, ...(iso === today ? styles.headToday : null) }}>
                {d}
              </span>
            );
          })}
        </div>
        {rows.map((row) => (
          <Row
            key={`${row.slot}:${row.slotIndex}`}
            row={row}
            columns={columns}
            year={year}
            month={month}
            dayNums={dayNums}
            bookings={bookings.filter((b) => b.slot === row.slot && b.slotIndex === row.slotIndex)}
            highlightFrom={highlightFrom}
            highlightTo={highlightTo}
            highlightSlot={highlightSlot}
            highlightIndex={highlightIndex}
            today={today}
            blocked={blockedRooms?.includes(`${row.slot}:${row.slotIndex}`) ?? false}
            editingInvoiceId={editingInvoiceId}
            onPickDate={onPickDate}
            onClearPick={onClearPick}
          />
        ))}
      </div>
      <div style={styles.legend}>
        <span>
          <i style={{ ...styles.swatch, background: '#d1fae5' }} /> Free
        </span>
        <span>
          <i style={{ ...styles.swatch, background: '#fca5a5' }} /> Live booked
        </span>
        <span>
          <i style={{ ...styles.swatch, background: '#fde68a' }} /> Pre-order
        </span>
        <span>
          <i style={{ ...styles.swatch, background: '#93c5fd' }} /> Your dates
        </span>
        <span>
          <i style={{ ...styles.swatch, background: '#fee2e2' }} /> Disabled
        </span>
      </div>
    </div>
  );
}

function Row({
  row,
  columns,
  year,
  month,
  dayNums,
  bookings,
  highlightFrom,
  highlightTo,
  highlightSlot,
  highlightIndex,
  today,
  blocked,
  editingInvoiceId,
  onPickDate,
  onClearPick,
}: {
  row: AdRoom;
  columns: string;
  year: number;
  month: number;
  dayNums: number[];
  bookings: AdOccupancyBooking[];
  highlightFrom?: string;
  highlightTo?: string;
  highlightSlot?: TownAdSlot;
  highlightIndex?: number;
  today: string;
  blocked: boolean;
  editingInvoiceId?: string;
  onPickDate?: (iso: string, booking: AdOccupancyBooking | null, room: AdRoom) => void;
  onClearPick?: () => void;
}) {
  const days = dayNums.length;
  const monthStart = isoDay(year, month, 1);
  const monthEnd = isoDay(year, month, days);
  const stays = bookings.filter((b) => b.toDate >= monthStart && b.fromDate <= monthEnd);
  return (
    <div style={{ ...styles.grid, ...styles.row, gridTemplateColumns: columns }}>
      <span style={blocked ? { ...styles.rowLabel, ...styles.rowLabelOff } : styles.rowLabel}>{row.label}</span>
      {dayNums.map((d) => {
        const iso = isoDay(year, month, d);
        const hit = bookings.find((b) => covers(b, iso)) ?? null;
        const thisRoom =
          highlightSlot === row.slot && (highlightIndex == null || highlightIndex === row.slotIndex);
        const inPick = Boolean(
          thisRoom && highlightFrom && highlightTo && iso >= highlightFrom && iso <= highlightTo,
        );
        const past = iso < today;
        const own = Boolean(editingInvoiceId && hit?.invoiceId === editingInvoiceId);
        let bg = blocked && !hit ? '#fee2e2' : '#d1fae5';
        if (!own && hit?.bookingPhase === 'PREORDER') bg = '#fde68a';
        else if (!own && hit) bg = '#fecaca';
        if (inPick && (!hit || own)) bg = '#93c5fd';
        if (inPick && hit && !own) bg = '#fdba74';
        return (
          <button
            key={iso}
            type="button"
            title={
              blocked && !hit
                ? `${row.label} is disabled · cannot book`
                : inPick
                  ? `${row.label} · ${highlightFrom} – ${highlightTo}. Double-click to clear.`
                  : hit
                    ? `${hit.advertiserName} · ${hit.invoiceNumber}`
                    : `${row.label} · ${iso} free`
            }
            style={{
              ...styles.cell,
              background: bg,
              cursor: blocked && !hit && !own ? 'not-allowed' : 'pointer',
              opacity: past && !hit && !inPick && !blocked ? 0.55 : 1,
            }}
            onClick={(e) => {
              if (blocked && !hit && !own) return;
              if (e.detail > 1) {
                if (inPick) onClearPick?.();
                return;
              }
              onPickDate?.(iso, hit, row);
            }}
            onDoubleClick={() => {
              if (inPick) onClearPick?.();
            }}
          />
        );
      })}
      {stays.map((stay) => {
        const start = Math.max(1, stay.fromDate < monthStart ? 1 : Number(stay.fromDate.slice(8, 10)));
        const end = Math.min(days, stay.toDate > monthEnd ? days : Number(stay.toDate.slice(8, 10)));
        const span = end - start + 1;
        const track = `(100% - 5.6rem) / ${days}`;
        return (
          <button
            key={stay.invoiceId}
            type="button"
            title={`${stay.advertiserName} · ${stay.invoiceNumber} · ${formatIsoDateRange(stay.fromDate, stay.toDate)}`}
            style={{
              ...styles.stay,
              left: `calc(5.6rem + ${start - 1} * (${track}))`,
              width: `calc(${span} * (${track}) - 2px)`,
              background: stay.bookingPhase === 'PREORDER' ? '#b45309' : stayColor(stay.advertiserName),
            }}
            onClick={() => onPickDate?.(stay.fromDate < monthStart ? monthStart : stay.fromDate, stay, row)}
          >
            {stay.advertiserName}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.35rem', overflowX: 'auto' },
  stack: { display: 'grid', gap: 3, minWidth: 720 },
  grid: { display: 'grid', gap: 2, alignItems: 'center' },
  row: { position: 'relative' },
  stay: {
    position: 'absolute',
    top: 1,
    height: 16,
    border: 'none',
    borderRadius: 3,
    padding: '0 4px',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: 800,
    textAlign: 'left',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    zIndex: 1,
  },
  head: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' },
  headDay: { fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' },
  headToday: { color: '#0f766e', fontWeight: 800 },
  rowLabel: { fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
  rowLabelOff: { color: '#b91c1c' },
  cell: {
    height: 18,
    border: 'none',
    borderRadius: 3,
    padding: 0,
    cursor: 'pointer',
    minWidth: 0,
  },
  legend: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  swatch: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 4,
  },
};
