import { useMemo, type CSSProperties } from 'react';
import type { TownAdSlot } from '../api/adsApi';
import {
  AD_SLOT_ROWS,
  type AdOccupancyBooking,
} from '../api/adsBillingApi';

type Props = {
  year: number;
  month: number;
  bookings: AdOccupancyBooking[];
  highlightFrom?: string;
  highlightTo?: string;
  slot?: TownAdSlot;
  slotIndex?: number;
  onPickDate?: (iso: string, booking: AdOccupancyBooking | null) => void;
};

function isoDay(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function covers(b: AdOccupancyBooking, iso: string): boolean {
  return b.fromDate <= iso && b.toDate >= iso;
}

export function AdsSlotCalendar({
  year,
  month,
  bookings,
  highlightFrom,
  highlightTo,
  slot,
  slotIndex,
  onPickDate,
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

  return (
    <div style={styles.wrap}>
      <div
        style={{
          ...styles.grid,
          gridTemplateColumns: `5.4rem repeat(${days}, minmax(14px, 1fr))`,
        }}
      >
        <span style={styles.head}>Slot</span>
        {dayNums.map((d) => (
          <span key={d} style={styles.headDay}>
            {d}
          </span>
        ))}
        {rows.map((row) => (
          <Row
            key={`${row.slot}:${row.slotIndex}`}
            row={row}
            year={year}
            month={month}
            dayNums={dayNums}
            bookings={bookings.filter((b) => b.slot === row.slot && b.slotIndex === row.slotIndex)}
            highlightFrom={highlightFrom}
            highlightTo={highlightTo}
            today={today}
            onPickDate={onPickDate}
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
      </div>
    </div>
  );
}

function Row({
  row,
  year,
  month,
  dayNums,
  bookings,
  highlightFrom,
  highlightTo,
  today,
  onPickDate,
}: {
  row: (typeof AD_SLOT_ROWS)[number];
  year: number;
  month: number;
  dayNums: number[];
  bookings: AdOccupancyBooking[];
  highlightFrom?: string;
  highlightTo?: string;
  today: string;
  onPickDate?: (iso: string, booking: AdOccupancyBooking | null) => void;
}) {
  return (
    <>
      <span style={styles.rowLabel}>{row.label}</span>
      {dayNums.map((d) => {
        const iso = isoDay(year, month, d);
        const hit = bookings.find((b) => covers(b, iso)) ?? null;
        const inPick = Boolean(highlightFrom && highlightTo && iso >= highlightFrom && iso <= highlightTo);
        const past = iso < today;
        let bg = '#d1fae5';
        if (hit?.bookingPhase === 'PREORDER') bg = '#fde68a';
        else if (hit) bg = '#fca5a5';
        if (inPick && !hit) bg = '#93c5fd';
        if (inPick && hit) bg = '#fdba74';
        return (
          <button
            key={iso}
            type="button"
            title={
              hit
                ? `${hit.advertiserName} · ${hit.invoiceNumber} · ${hit.fromDate}–${hit.toDate}`
                : `${iso} free`
            }
            style={{
              ...styles.cell,
              background: bg,
              opacity: past && !hit && !inPick ? 0.55 : 1,
              outline: iso === today ? '1px solid #0f766e' : undefined,
            }}
            onClick={() => onPickDate?.(iso, hit)}
          />
        );
      })}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.35rem', overflowX: 'auto' },
  grid: { display: 'grid', gap: 2, alignItems: 'center', minWidth: 640 },
  head: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' },
  headDay: { fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' },
  rowLabel: { fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
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
