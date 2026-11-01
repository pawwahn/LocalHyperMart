import { PickerDateField } from '@hlm-dates';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  beautySlotIdFromIso,
  istDateFromIso,
  blockedSlotIdsForDate,
  type BeautyProfile,
  type BeautySlotRow,
} from '../api/beautyApi';

type OrderRow = { status: string; slotStart?: string | null };

export type CalView = 'today' | 'daily' | 'weekly' | 'monthly';

const GLAM = {
  pink: '#be185d',
  pinkDark: '#9d174d',
  pinkSoft: '#fdf2f8',
  pinkBorder: '#f9a8d4',
  purple: '#9333ea',
  slate: '#64748b',
  red: '#dc2626',
};

type Props = {
  view: CalView;
  onViewChange: (view: CalView) => void;
  anchorDate: string;
  onAnchorDateChange: (date: string) => void;
  today: string;
  defaultStaffCount: number;
  staffForDate: (date: string) => number;
  slots: readonly BeautySlotRow[];
  slotIntervalMinutes: number;
  profile: BeautyProfile | null;
  orders: OrderRow[];
  onToggleManualBlock: (date: string, slotId: string) => void;
  manualBlockEditable?: boolean;
};

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function addDaysIst(dateStr: string, delta: number): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 30));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 30));
  const dow = dt.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  return addDaysIst(dateStr, shift);
}

function monthStart(dateStr: string): string {
  const { y, m } = parseYmd(dateStr);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function monthLabel(dateStr: string): string {
  const { y, m } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, 1, 6, 30));
  return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dayShort(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 30));
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function dayLong(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 30));
  return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function bookedMapForDate(orders: OrderRow[], date: string, slots: readonly BeautySlotRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    if (istDateFromIso(order.slotStart ?? '') !== date) continue;
    const slotId = beautySlotIdFromIso(order.slotStart, slots);
    if (slotId) map.set(slotId, (map.get(slotId) ?? 0) + 1);
  }
  return map;
}

function manualBlocksForDate(profile: BeautyProfile | null, date: string, slots: readonly BeautySlotRow[]): Set<string> {
  return new Set(blockedSlotIdsForDate(date, profile, slots));
}

function slotBlocked(manual: boolean, booked: number, capacity: number): boolean {
  return manual || booked >= capacity;
}

function slotStatus(manual: boolean, booked: number, capacity: number): { label: string; tone: 'open' | 'partial' | 'full' | 'manual' } {
  if (manual) return { label: 'Blocked', tone: 'manual' };
  if (booked >= capacity) return { label: 'Full', tone: 'full' };
  if (booked > 0) return { label: `${booked}/${capacity}`, tone: 'partial' };
  return { label: 'Open', tone: 'open' };
}

function LegendKey() {
  const items: { swatch: CSSProperties; label: string }[] = [
    { swatch: { background: '#e5e7eb' }, label: 'Open' },
    { swatch: { background: GLAM.purple }, label: 'Booked' },
    { swatch: { background: GLAM.slate }, label: 'Full' },
    { swatch: { background: GLAM.red }, label: 'You blocked' },
  ];
  return (
    <div style={styles.legendRow} aria-label="Slot colors">
      {items.map((item) => (
        <span key={item.label} style={styles.legendItem}>
          <span style={{ ...styles.legendSwatch, ...item.swatch }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function SlotSegments({ capacity, booked, manual }: { capacity: number; booked: number; manual: boolean }) {
  const n = Math.max(1, capacity);
  const filled = Math.min(booked, n);
  const full = manual || booked >= n;
  const overbooked = !manual && booked > n;
  const segmentCount = overbooked ? booked : n;
  return (
    <span style={segStyles.wrap} aria-hidden>
      {Array.from({ length: segmentCount }, (_, i) => {
        let bg = '#e5e7eb';
        if (manual) bg = GLAM.red;
        else if (full && !overbooked) bg = GLAM.slate;
        else if (i < filled) bg = GLAM.purple;
        else if (overbooked && i >= n) bg = GLAM.purple;
        return <span key={i} style={{ ...segStyles.part, background: bg }} />;
      })}
    </span>
  );
}

function SlotCell({
  label,
  capacity,
  booked,
  manual,
  compact,
  onClick,
}: {
  label: string;
  capacity: number;
  booked: number;
  manual: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const blocked = slotBlocked(manual, booked, capacity);
  const status = slotStatus(manual, booked, capacity);
  const Tag = onClick ? 'button' : 'div';
  const toneStyle =
    status.tone === 'manual'
      ? cellStyles.manual
      : status.tone === 'full'
        ? cellStyles.blocked
        : status.tone === 'partial'
          ? cellStyles.partial
          : cellStyles.open;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      style={{
        ...cellStyles.base,
        ...(compact ? cellStyles.compact : null),
        ...toneStyle,
        ...(onClick ? cellStyles.clickable : null),
      }}
      title={
        manual
          ? 'Blocked by you — tap to open'
          : blocked
            ? 'Fully booked for customers'
            : booked
              ? `${booked} of ${capacity} professionals booked`
              : 'Open — tap to block'
      }
      onClick={onClick}
    >
      {label ? <span style={cellStyles.time}>{label}</span> : null}
      <SlotSegments capacity={capacity} booked={booked} manual={manual} />
      {!compact ? (
        <span
          style={{
            ...cellStyles.badge,
            ...(status.tone === 'open' ? cellStyles.badgeOpen : null),
            ...(status.tone === 'partial' ? cellStyles.badgePartial : null),
            ...(status.tone === 'full' ? cellStyles.badgeFull : null),
            ...(status.tone === 'manual' ? cellStyles.badgeManual : null),
          }}
        >
          {status.label}
        </span>
      ) : null}
    </Tag>
  );
}

function DaySlotGrid({
  date,
  staffForDate,
  slots,
  profile,
  orders,
  canEditManual,
  onToggleManualBlock,
}: {
  date: string;
  staffForDate: (date: string) => number;
  slots: readonly BeautySlotRow[];
  profile: BeautyProfile | null;
  orders: OrderRow[];
  canEditManual: boolean;
  onToggleManualBlock: (date: string, slotId: string) => void;
}) {
  const booked = bookedMapForDate(orders, date, slots);
  const manualSet = manualBlocksForDate(profile, date, slots);
  const capacity = staffForDate(date);

  const morning = slots.filter((s) => Number(s.start.slice(0, 2)) < 12);
  const afternoon = slots.filter((s) => Number(s.start.slice(0, 2)) >= 12);

  function renderGroup(title: string, groupSlots: readonly BeautySlotRow[]) {
    return (
      <div style={styles.slotGroup}>
        <p style={styles.groupTitle}>{title}</p>
        <div style={styles.dayGrid}>
          {groupSlots.map((slot) => {
            const bookedN = booked.get(slot.id) ?? 0;
            const manual = manualSet.has(slot.id);
            return (
              <SlotCell
                key={slot.id}
                label={slot.label}
                capacity={capacity}
                booked={bookedN}
                manual={manual}
                onClick={canEditManual ? () => onToggleManualBlock(date, slot.id) : undefined}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dayWrap}>
      {renderGroup('Morning', morning)}
      {renderGroup('Afternoon & evening', afternoon)}
    </div>
  );
}

export function GlamVendorCalendar({
  view,
  onViewChange,
  anchorDate,
  onAnchorDateChange,
  today,
  defaultStaffCount,
  staffForDate,
  slots,
  slotIntervalMinutes,
  profile,
  orders,
  onToggleManualBlock,
  manualBlockEditable = true,
}: Props) {
  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDaysIst(start, i));
  }, [anchorDate]);

  const monthGrid = useMemo(() => {
    const start = monthStart(anchorDate);
    const { y, m } = parseYmd(start);
    const firstDow = new Date(Date.UTC(y, m - 1, 1, 6, 30)).getUTCDay();
    const lead = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(Date.UTC(y, m, 0, 6, 30)).getUTCDate();
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < lead; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [anchorDate]);

  const displayDate = view === 'today' || view === 'daily' ? anchorDate : today;
  const canEditManual = manualBlockEditable && (view === 'today' || view === 'daily');

  const dayStats = useMemo(() => {
    const booked = bookedMapForDate(orders, displayDate, slots);
    const manual = manualBlocksForDate(profile, displayDate, slots);
    let openSpots = 0;
    let partialSlots = 0;
    let fullSlots = 0;
    const cap = staffForDate(displayDate);
    for (const slot of slots) {
      const b = booked.get(slot.id) ?? 0;
      const m = manual.has(slot.id);
      if (m || b >= cap) {
        fullSlots += 1;
        continue;
      }
      openSpots += Math.max(0, cap - b);
      if (b > 0) partialSlots += 1;
    }
    return { openSpots, partialSlots, fullSlots };
  }, [displayDate, orders, profile, staffForDate, slots]);

  function shiftDay(delta: number) {
    onAnchorDateChange(addDaysIst(displayDate, delta));
  }

  function navPrev() {
    if (view === 'monthly') {
      const { y, m } = parseYmd(anchorDate);
      onAnchorDateChange(m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`);
    } else if (view === 'weekly') onAnchorDateChange(addDaysIst(anchorDate, -7));
    else shiftDay(-1);
  }

  function navNext() {
    if (view === 'monthly') {
      const { y, m } = parseYmd(anchorDate);
      onAnchorDateChange(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`);
    } else if (view === 'weekly') onAnchorDateChange(addDaysIst(anchorDate, 7));
    else shiftDay(1);
  }

  const periodTitle =
    view === 'monthly'
      ? monthLabel(anchorDate)
      : view === 'weekly'
        ? `${dayShort(weekDays[0])} – ${dayShort(weekDays[6])}`
        : dayLong(displayDate);

  let body: ReactNode;

  if (view === 'weekly') {
    body = (
      <div style={styles.weekScroll}>
        <table style={styles.weekTable}>
          <thead>
            <tr>
              <th style={styles.timeTh}>Time</th>
              {weekDays.map((d) => (
                <th key={d} style={styles.dayTh}>
                  <button type="button" style={styles.dayLink} onClick={() => onAnchorDateChange(d)}>
                    {dayShort(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td style={styles.timeTd}>{slot.label}</td>
                {weekDays.map((d) => {
                  const booked = bookedMapForDate(orders, d, slots).get(slot.id) ?? 0;
                  const manual = manualBlocksForDate(profile, d, slots).has(slot.id);
                  const cap = staffForDate(d);
                  return (
                    <td key={d} style={styles.slotTd}>
                      <SlotCell label="" capacity={cap} booked={booked} manual={manual} compact />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (view === 'monthly') {
    body = (
      <div style={styles.monthWrap}>
        <div style={styles.monthHead}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span key={d} style={styles.monthDow}>
              {d}
            </span>
          ))}
        </div>
        <div style={styles.monthGrid}>
          {monthGrid.map((cell, idx) => {
            if (!cell.date) return <span key={`e-${idx}`} style={styles.monthEmpty} />;
            const booked = bookedMapForDate(orders, cell.date, slots);
            const manual = manualBlocksForDate(profile, cell.date, slots);
            let blockedSlots = 0;
            let partialSlots = 0;
            const cap = staffForDate(cell.date);
            for (const slot of slots) {
              const b = booked.get(slot.id) ?? 0;
              const m = manual.has(slot.id);
              if (slotBlocked(m, b, cap)) blockedSlots += 1;
              else if (b > 0) partialSlots += 1;
            }
            const isToday = cell.date === today;
            const heat =
              blockedSlots > 4 ? 'busy' : partialSlots > 0 || blockedSlots > 0 ? 'some' : 'clear';
            return (
              <button
                key={cell.date}
                type="button"
                style={{
                  ...styles.monthCell,
                  ...(isToday ? styles.monthToday : null),
                  ...(heat === 'busy' ? styles.monthHeatBusy : heat === 'some' ? styles.monthHeatSome : null),
                }}
                onClick={() => {
                  onAnchorDateChange(cell.date!);
                  onViewChange('daily');
                }}
              >
                <span style={styles.monthDay}>{parseYmd(cell.date).d}</span>
                <span style={styles.monthMini}>
                  {blockedSlots > 0 ? `${blockedSlots} full` : partialSlots > 0 ? `${partialSlots} in progress` : 'All open'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else {
    body = (
      <DaySlotGrid
        date={displayDate}
        staffForDate={staffForDate}
        slots={slots}
        profile={profile}
        orders={orders}
        canEditManual={canEditManual}
        onToggleManualBlock={onToggleManualBlock}
      />
    );
  }

  return (
    <section style={styles.card} aria-label="Glam calendar">
      <div style={styles.cardHead}>
        <div>
          <p style={styles.cardEyebrow}>Availability</p>
          <p style={styles.cardTitle}>{slotIntervalMinutes}-minute slots</p>
        </div>
        {(view === 'today' || view === 'daily') && (
          <div style={styles.statPills}>
            <span style={styles.statOpen}>{dayStats.openSpots} open spots</span>
            <span style={styles.statBusy}>{dayStats.partialSlots} partial</span>
            <span style={styles.statBlock}>{dayStats.fullSlots} full</span>
          </div>
        )}
      </div>

      <div style={styles.segmented} role="tablist" aria-label="Calendar view">
        {(
          [
            ['today', 'Today'],
            ['daily', 'Daily'],
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            style={view === id ? styles.segOn : styles.segOff}
            onClick={() => {
              onViewChange(id);
              if (id === 'today') onAnchorDateChange(today);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.navBar}>
        <button type="button" style={styles.navBtn} onClick={navPrev} aria-label="Previous">
          ‹
        </button>
        <div style={styles.navCenter}>
          <span style={styles.period}>{periodTitle}</span>
          {displayDate === today ? <span style={styles.todayChip}>Today</span> : null}
        </div>
        <button type="button" style={styles.navBtn} onClick={navNext} aria-label="Next">
          ›
        </button>
        {view === 'today' || view === 'daily' ? (
          <PickerDateField
            value={anchorDate}
            style={styles.dateInput}
            onChange={(next: string) => onAnchorDateChange(next || today)}
            aria-label="Pick date"
          />
        ) : null}
      </div>

      <LegendKey />
      <p style={styles.tapHint}>
        Capacity uses staff for each day (default {defaultStaffCount}). Existing bookings are kept when you lower staff; only new bookings follow the lower limit.
      </p>
      {canEditManual ? <p style={styles.tapHint}>Tap any slot to block or reopen it for customers.</p> : null}

      <div style={styles.body}>{body}</div>
    </section>
  );
}

const segStyles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', gap: 3, width: '100%', marginTop: 6 },
  part: { flex: 1, height: 8, borderRadius: 4, minWidth: 4, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' },
};

const cellStyles: Record<string, CSSProperties> = {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '0.5rem 0.55rem 0.45rem',
    minWidth: 0,
    background: '#fff',
    cursor: 'default',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
  compact: { padding: '0.25rem', borderRadius: 8 },
  clickable: { cursor: 'pointer' },
  open: { background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)' },
  partial: { borderColor: '#ddd6fe', background: 'linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)' },
  blocked: { borderColor: '#cbd5e1', background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' },
  manual: { borderColor: '#fecaca', background: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)' },
  time: { fontSize: '0.78rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.2 },
  badge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: '0.58rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.12rem 0.4rem',
    borderRadius: 999,
  },
  badgeOpen: { background: '#ecfdf5', color: '#047857' },
  badgePartial: { background: '#f3e8ff', color: '#7e22ce' },
  badgeFull: { background: '#f1f5f9', color: '#475569' },
  badgeManual: { background: '#fee2e2', color: '#b91c1c' },
};

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 16,
    border: `1px solid ${GLAM.pinkBorder}`,
    background: 'linear-gradient(165deg, #fff 0%, #fdf2f8 120%)',
    boxShadow: '0 8px 24px rgba(190, 24, 93, 0.08)',
    padding: '0.65rem 0.7rem 0.75rem',
    display: 'grid',
    gap: '0.55rem',
  },
  cardHead: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.4rem',
  },
  cardEyebrow: { margin: 0, fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: GLAM.pinkDark },
  cardTitle: { margin: '0.1rem 0 0', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  statPills: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  statOpen: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: '#ecfdf5', color: '#047857' },
  statBusy: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: '#f3e8ff', color: '#7e22ce' },
  statBlock: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: '#f1f5f9', color: '#475569' },
  segmented: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 3,
    padding: 3,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid #fce7f3',
  },
  segOff: {
    minHeight: 36,
    border: 'none',
    borderRadius: 9,
    background: 'transparent',
    fontWeight: 700,
    fontSize: '0.68rem',
    color: '#6b7280',
    cursor: 'pointer',
  },
  segOn: {
    minHeight: 36,
    border: 'none',
    borderRadius: 9,
    background: `linear-gradient(135deg, ${GLAM.pink} 0%, #db2777 100%)`,
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.68rem',
    boxShadow: '0 4px 12px rgba(190, 24, 93, 0.35)',
    cursor: 'pointer',
  },
  navBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.4rem',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #f3f4f6',
  },
  navCenter: { flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', minWidth: 0 },
  navBtn: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontWeight: 800,
    fontSize: '1.15rem',
    lineHeight: 1,
    color: GLAM.pinkDark,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  period: { fontWeight: 800, fontSize: '0.82rem', textAlign: 'center', color: '#111827', letterSpacing: '-0.02em' },
  todayChip: { fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: 999, background: GLAM.pinkSoft, color: GLAM.pinkDark, border: `1px solid ${GLAM.pinkBorder}` },
  dateInput: { minHeight: 38, borderRadius: 10, border: '1px solid #e5e7eb', padding: '0 0.5rem', fontSize: '0.72rem', fontWeight: 600 },
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', fontWeight: 700, color: '#4b5563' },
  legendSwatch: { width: 14, height: 8, borderRadius: 4, display: 'inline-block' },
  tapHint: { margin: 0, fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 },
  body: { marginTop: '0.15rem' },
  dayWrap: { display: 'grid', gap: '0.65rem' },
  slotGroup: { display: 'grid', gap: '0.35rem' },
  groupTitle: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    color: GLAM.pinkDark,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: '0.15rem',
    borderBottom: `2px solid ${GLAM.pinkBorder}`,
  },
  dayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(6.75rem, 1fr))',
    gap: '0.45rem',
  },
  weekScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 12, border: '1px solid #f3f4f6', background: '#fff' },
  weekTable: { borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: '0.65rem' },
  timeTh: { textAlign: 'left', padding: '0.35rem', fontWeight: 800, position: 'sticky', left: 0, background: '#fff', zIndex: 1 },
  dayTh: { padding: '0.35rem', fontWeight: 800, minWidth: 56 },
  dayLink: { border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.62rem', cursor: 'pointer', color: GLAM.pink },
  timeTd: { padding: '0.25rem 0.4rem', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1 },
  slotTd: { padding: 3, verticalAlign: 'middle' },
  monthWrap: { display: 'grid', gap: '0.35rem', background: '#fff', borderRadius: 12, padding: '0.45rem', border: '1px solid #f3f4f6' },
  monthHead: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  monthDow: { fontSize: '0.62rem', fontWeight: 800, textAlign: 'center', color: '#9ca3af' },
  monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  monthEmpty: { minHeight: 56 },
  monthCell: {
    minHeight: 56,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    background: '#fafafa',
    padding: '0.3rem 0.35rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    cursor: 'pointer',
    textAlign: 'left',
  },
  monthToday: { borderColor: GLAM.pink, boxShadow: `inset 0 0 0 1px ${GLAM.pinkBorder}` },
  monthHeatSome: { background: '#faf5ff' },
  monthHeatBusy: { background: '#f1f5f9' },
  monthDay: { fontWeight: 800, fontSize: '0.78rem' },
  monthMini: { fontSize: '0.52rem', fontWeight: 700, color: '#6b7280', lineHeight: 1.25 },
};
