import { PickerDateField } from '@hlm-dates';
import { parseBlockedSlotsByDate } from '@hlm-beauty';
import { formatDiagnosticsSlotAmPmRange } from '@hlm-diagnostics';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';
import { useMemo, type CSSProperties, type ReactNode } from 'react';

export type CalView = 'today' | 'daily' | 'weekly' | 'monthly';

type OrderRow = { status: string; slotStart?: string | null; servingBranchId?: string | null };

export type DiagSlotRow = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

const TEAL = {
  dark: '#0f766e',
  border: '#99f6e4',
  soft: '#ecfdf5',
};

type Props = {
  view: CalView;
  onViewChange: (view: CalView) => void;
  anchorDate: string;
  onAnchorDateChange: (date: string) => void;
  today: string;
  branchId: string;
  slots: readonly DiagSlotRow[];
  orders: OrderRow[];
  blockedSlotsByDate: string | null | undefined;
  busy: boolean;
  onToggleBlock: (date: string, slotId: string) => void;
};

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m || 1, d: d || 1 };
}

export function addDaysDiag(dateStr: string, delta: number): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  return addDaysDiag(dateStr, shift);
}

function monthStart(dateStr: string): string {
  const { y, m } = parseYmd(dateStr);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function monthLabel(dateStr: string): string {
  const { y, m } = parseYmd(dateStr);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function dayShort(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function dayLong(dateStr: string): string {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function manualSetForDate(raw: string | null | undefined, date: string): Set<string> {
  const map = parseBlockedSlotsByDate(raw);
  const csv = map[date] ?? '';
  return new Set(
    csv
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function slotTimeKey(slot: DiagSlotRow): string {
  return slot.startTime.slice(0, 5);
}

function slotAmPmRangeLabel(slot: Pick<DiagSlotRow, 'startTime' | 'endTime'>): string {
  return formatDiagnosticsSlotAmPmRange(slot.startTime, slot.endTime);
}

function bookedMapForDate(
  orders: OrderRow[],
  date: string,
  branchId: string,
  slots: readonly DiagSlotRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (!order.slotStart || /CANCEL/i.test(order.status)) continue;
    if (order.servingBranchId && order.servingBranchId !== branchId) continue;
    const day = order.slotStart.slice(0, 10);
    if (day !== date) continue;
    const time = order.slotStart.includes('T') ? order.slotStart.slice(11, 16) : order.slotStart.slice(0, 5);
    for (const slot of slots) {
      if (slotTimeKey(slot) === time) {
        map.set(slot.id, (map.get(slot.id) ?? 0) + 1);
      }
    }
  }
  return map;
}

function slotBlocked(manual: boolean, booked: number, capacity: number): boolean {
  return manual || booked >= capacity;
}

function slotStatus(
  manual: boolean,
  booked: number,
  capacity: number,
): { label: string; tone: 'open' | 'partial' | 'full' | 'manual' } {
  if (manual) return { label: 'Blocked', tone: 'manual' };
  if (booked >= capacity) return { label: 'Full', tone: 'full' };
  if (booked > 0) return { label: `${booked}/${capacity}`, tone: 'partial' };
  return { label: 'Open', tone: 'open' };
}

function SlotSegments({
  capacity,
  booked,
  manual,
  narrow,
}: {
  capacity: number;
  booked: number;
  manual: boolean;
  narrow?: boolean;
}) {
  const n = Math.max(1, capacity);
  const filled = Math.min(booked, n);
  const full = manual || booked >= n;
  const overbooked = !manual && booked > n;
  /** Phone weekly cells: fewer bars so slots stay readable */
  const segmentCount = overbooked
    ? Math.min(booked, narrow ? 10 : 999)
    : narrow
      ? Math.min(n, 6)
      : n;
  const filledBars = overbooked ? Math.min(booked, segmentCount) : Math.min(filled, segmentCount);
  const purple = '#7c3aed';
  const slate = '#64748b';
  const red = '#dc2626';
  return (
    <span style={{ ...segStyles.wrap, ...(narrow ? segStyles.wrapNarrow : null) }} aria-hidden>
      {Array.from({ length: segmentCount }, (_, i) => {
        let bg = '#e5e7eb';
        if (manual) bg = red;
        else if (full && !overbooked) bg = slate;
        else if (i < filledBars) bg = purple;
        return <span key={i} style={{ ...segStyles.part, ...(narrow ? segStyles.partNarrow : null), background: bg }} />;
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
  narrow,
  rowStripe,
  onClick,
}: {
  label: string;
  capacity: number;
  booked: number;
  manual: boolean;
  compact?: boolean;
  /** Phone layout: larger tap target, wrapped time label, slightly tighter segments */
  narrow?: boolean;
  /** Alternate row banding on phones (one slot per row): 0 | 1 */
  rowStripe?: 0 | 1;
  onClick?: () => void;
}) {
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
      disabled={onClick ? false : undefined}
      style={{
        ...cellStyles.base,
        ...(compact ? cellStyles.compact : null),
        ...(narrow && !compact ? cellStyles.baseNarrow : null),
        ...toneStyle,
        ...(narrow && rowStripe === 1 ? cellStyles.rowStripe : null),
        ...(onClick ? cellStyles.clickable : null),
      }}
      title={
        manual
          ? 'Blocked — tap to open'
          : booked >= capacity
            ? 'Full for customers'
            : booked > 0
              ? `${booked} of ${capacity} booked`
              : 'Open — tap to block'
      }
      onClick={onClick}
    >
      {label ? (
        <span style={{ ...cellStyles.time, ...(narrow && !compact ? cellStyles.timeNarrow : null) }}>{label}</span>
      ) : null}
      <SlotSegments capacity={capacity} booked={booked} manual={manual} narrow={narrow && compact} />
      {!compact ? (
        <span
          style={{
            ...cellStyles.badge,
            ...(narrow ? cellStyles.badgeNarrow : null),
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
  slots,
  orders,
  branchId,
  blockedSlotsByDate,
  busy,
  narrow,
  onToggleBlock,
}: {
  date: string;
  slots: readonly DiagSlotRow[];
  orders: OrderRow[];
  branchId: string;
  blockedSlotsByDate: string | null | undefined;
  busy: boolean;
  narrow: boolean;
  onToggleBlock: (date: string, slotId: string) => void;
}) {
  const booked = bookedMapForDate(orders, date, branchId, slots);
  const manual = manualSetForDate(blockedSlotsByDate, date);

  const morning = slots.filter((s) => Number(s.startTime.slice(0, 2)) < 12);
  const afternoon = slots.filter((s) => Number(s.startTime.slice(0, 2)) >= 12);

  function renderGroup(title: string, groupSlots: readonly DiagSlotRow[]) {
    return (
      <div style={styles.slotGroup}>
        <p style={styles.groupTitle}>{title}</p>
        <div style={narrow ? styles.dayGridNarrow : styles.dayGrid}>
          {groupSlots.map((slot, idx) => {
            const bookedN = booked.get(slot.id) ?? 0;
            const man = manual.has(slot.id);
            const label = slotAmPmRangeLabel(slot);
            /** One column on phones → stripe by row; two columns would use idx/2. */
            const rowStripe = narrow ? ((idx % 2) as 0 | 1) : undefined;
            return (
              <SlotCell
                key={slot.id}
                label={label}
                capacity={slot.capacity}
                booked={bookedN}
                manual={man}
                narrow={narrow}
                rowStripe={rowStripe}
                onClick={busy ? undefined : () => onToggleBlock(date, slot.id)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dayWrap}>
      {morning.length > 0 ? renderGroup('Morning', morning) : null}
      {afternoon.length > 0 ? renderGroup('Afternoon & night', afternoon) : null}
    </div>
  );
}

function LegendKey() {
  const items: { swatch: CSSProperties; label: string }[] = [
    { swatch: { background: '#e5e7eb' }, label: 'Open' },
    { swatch: { background: '#7c3aed' }, label: 'Booked' },
    { swatch: { background: '#64748b' }, label: 'Full' },
    { swatch: { background: '#dc2626' }, label: 'You blocked' },
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

export function DiagnosticsVendorCalendar({
  view,
  onViewChange,
  anchorDate,
  onAnchorDateChange,
  today,
  branchId,
  slots,
  orders,
  blockedSlotsByDate,
  busy,
  onToggleBlock,
}: Props) {
  const narrow = useIsNarrow(767);
  const navStackDaily = narrow && (view === 'today' || view === 'daily');
  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDaysDiag(start, i));
  }, [anchorDate]);

  const monthGrid = useMemo(() => {
    const start = monthStart(anchorDate);
    const { y, m } = parseYmd(start);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < lead; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [anchorDate]);

  const displayDate = view === 'today' || view === 'daily' ? anchorDate : today;
  const canEditManual = view === 'today' || view === 'daily';

  const dayStats = useMemo(() => {
    const booked = bookedMapForDate(orders, displayDate, branchId, slots);
    const manual = manualSetForDate(blockedSlotsByDate, displayDate);
    let openSpots = 0;
    let partialSlots = 0;
    let fullSlots = 0;
    for (const slot of slots) {
      const b = booked.get(slot.id) ?? 0;
      const m = manual.has(slot.id);
      if (m || b >= slot.capacity) {
        fullSlots += 1;
        continue;
      }
      openSpots += Math.max(0, slot.capacity - b);
      if (b > 0) partialSlots += 1;
    }
    return { openSpots, partialSlots, fullSlots };
  }, [displayDate, orders, branchId, slots, blockedSlotsByDate]);

  function shiftDay(delta: number) {
    onAnchorDateChange(addDaysDiag(displayDate, delta));
  }

  function navPrev() {
    if (view === 'monthly') {
      const { y, m } = parseYmd(anchorDate);
      const dt = new Date(y, m - 2, 1);
      onAnchorDateChange(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`);
    } else if (view === 'weekly') onAnchorDateChange(addDaysDiag(anchorDate, -7));
    else shiftDay(-1);
  }

  function navNext() {
    if (view === 'monthly') {
      const { y, m } = parseYmd(anchorDate);
      const dt = new Date(y, m, 1);
      onAnchorDateChange(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`);
    } else if (view === 'weekly') onAnchorDateChange(addDaysDiag(anchorDate, 7));
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
        <table style={{ ...styles.weekTable, ...(narrow ? styles.weekTableNarrow : null) }}>
          <thead>
            <tr>
              <th style={{ ...styles.timeTh, ...(narrow ? styles.timeThNarrow : null) }}>Time</th>
              {weekDays.map((d) => (
                <th key={d} style={{ ...styles.dayTh, ...(narrow ? styles.dayThNarrow : null) }}>
                  <button type="button" style={styles.dayLink} onClick={() => onAnchorDateChange(d)}>
                    {dayShort(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const label = slotAmPmRangeLabel(slot);
              return (
                <tr key={slot.id}>
                  <td style={{ ...styles.timeTd, ...(narrow ? styles.timeTdNarrow : null) }}>{label}</td>
                  {weekDays.map((d) => {
                    const booked = bookedMapForDate(orders, d, branchId, slots).get(slot.id) ?? 0;
                    const manual = manualSetForDate(blockedSlotsByDate, d).has(slot.id);
                    return (
                      <td key={d} style={{ ...styles.slotTd, ...(narrow ? styles.slotTdNarrow : null) }}>
                        <SlotCell
                          label=""
                          capacity={slot.capacity}
                          booked={booked}
                          manual={manual}
                          compact
                          narrow={narrow}
                          onClick={busy ? undefined : () => onToggleBlock(d, slot.id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
            const booked = bookedMapForDate(orders, cell.date, branchId, slots);
            const manual = manualSetForDate(blockedSlotsByDate, cell.date);
            let blockedSlots = 0;
            let partialSlots = 0;
            for (const slot of slots) {
              const b = booked.get(slot.id) ?? 0;
              const m = manual.has(slot.id);
              if (slotBlocked(m, b, slot.capacity)) blockedSlots += 1;
              else if (b > 0) partialSlots += 1;
            }
            const isToday = cell.date === today;
            const heat = blockedSlots > 4 ? 'busy' : partialSlots > 0 || blockedSlots > 0 ? 'some' : 'clear';
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
                  {blockedSlots > 0 ? `${blockedSlots} blocked/full` : partialSlots > 0 ? `${partialSlots} busy` : 'All open'}
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
        slots={slots}
        orders={orders}
        branchId={branchId}
        blockedSlotsByDate={blockedSlotsByDate}
        busy={busy}
        narrow={narrow}
        onToggleBlock={onToggleBlock}
      />
    );
  }

  return (
    <section
      style={{
        ...styles.card,
        ...(narrow ? styles.cardNarrow : null),
      }}
      aria-label="Diagnostics collection calendar"
    >
      <div style={styles.cardHead}>
        <div>
          <p style={styles.cardEyebrow}>Availability</p>
          <p style={styles.cardTitle}>Home collection slots</p>
        </div>
        {(view === 'today' || view === 'daily') && slots.length > 0 ? (
          <div style={styles.statPills}>
            <span style={styles.statOpen}>{dayStats.openSpots} open spots</span>
            <span style={styles.statBusy}>{dayStats.partialSlots} partial</span>
            <span style={styles.statBlock}>{dayStats.fullSlots} full/blocked</span>
          </div>
        ) : null}
      </div>

      <div style={{ ...styles.segmented, ...(narrow ? styles.segmentedNarrow : null) }} role="tablist" aria-label="Calendar view">
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
            style={view === id ? (narrow ? styles.segOnNarrow : styles.segOn) : narrow ? styles.segOffNarrow : styles.segOff}
            onClick={() => {
              onViewChange(id);
              if (id === 'today') onAnchorDateChange(today);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          ...styles.navBar,
          ...(navStackDaily ? styles.navBarStacked : null),
        }}
      >
        <button type="button" style={styles.navBtn} onClick={navPrev} aria-label="Previous" disabled={busy}>
          ‹
        </button>
        <div style={{ ...styles.navCenter, ...(navStackDaily ? styles.navCenterInGrid : null) }}>
          <span style={styles.period}>{periodTitle}</span>
          {displayDate === today ? <span style={styles.todayChip}>Today</span> : null}
        </div>
        <button type="button" style={styles.navBtn} onClick={navNext} aria-label="Next" disabled={busy}>
          ›
        </button>
        {view === 'today' || view === 'daily' ? (
          <PickerDateField
            value={anchorDate}
            style={{
              ...styles.dateInput,
              ...(navStackDaily ? styles.dateInputFullWidth : null),
            }}
            onChange={(next: string) => onAnchorDateChange(next || today)}
            aria-label="Pick date"
          />
        ) : null}
      </div>

      <LegendKey />
      <p style={styles.tapHint}>
        Times use <strong>am/pm</strong> (same as customers). Each cell shows bookings vs capacity (N). Tap a slot to
        block or reopen for customers on{' '}
        {canEditManual ? 'this day' : 'weekly cells (pick a day in Monthly → Daily to edit blocks)'}.
      </p>
      {canEditManual && slots.length > 0 ? <p style={styles.tapHintStrong}>Tap any slot below to block or reopen.</p> : null}

      <div style={styles.body}>{slots.length === 0 ? <p style={styles.emptySlots}>Add slot templates first.</p> : body}</div>
    </section>
  );
}

const segStyles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', gap: 3, width: '100%', marginTop: 6 },
  wrapNarrow: { marginTop: 5, gap: 2 },
  part: { flex: 1, height: 8, borderRadius: 4, minWidth: 4, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' },
  partNarrow: { minWidth: 3, height: 7 },
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
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    background: '#fff',
    cursor: 'default',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
  /** Subtle banding so rows read clearly on phones (works on open + blocked cells). */
  rowStripe: {
    boxShadow: 'inset 0 0 0 999px rgba(15, 23, 42, 0.03)',
  },
  baseNarrow: {
    minHeight: 92,
    padding: '0.5rem 0.45rem 0.4rem',
    alignItems: 'stretch',
  },
  compact: { padding: '0.25rem', borderRadius: 8 },
  clickable: { cursor: 'pointer' },
  open: { background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)' },
  partial: { borderColor: '#ddd6fe', background: 'linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)' },
  blocked: { borderColor: '#cbd5e1', background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' },
  manual: { borderColor: '#fecaca', background: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)' },
  time: { fontSize: '0.78rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827', lineHeight: 1.2 },
  timeNarrow: {
    fontSize: '0.74rem',
    lineHeight: 1.25,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    hyphens: 'manual',
    textAlign: 'center',
  },
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
  badgeOpen: { background: TEAL.soft, color: TEAL.dark },
  badgePartial: { background: '#f3e8ff', color: '#7e22ce' },
  badgeFull: { background: '#f1f5f9', color: '#475569' },
  badgeManual: { background: '#fee2e2', color: '#b91c1c' },
  badgeNarrow: { alignSelf: 'center', marginTop: 5 },
};

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 16,
    border: `1px solid ${TEAL.border}`,
    background: 'linear-gradient(165deg, #fff 0%, #ecfdf5 120%)',
    boxShadow: '0 8px 24px rgba(15, 118, 110, 0.08)',
    padding: '0.65rem 0.7rem 0.75rem',
    display: 'grid',
    gap: '0.55rem',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  cardNarrow: {
    padding: '0.5rem 0.5rem 0.65rem',
    gap: '0.45rem',
  },
  cardHead: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.4rem',
  },
  cardEyebrow: { margin: 0, fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEAL.dark },
  cardTitle: { margin: '0.1rem 0 0', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#1f2937' },
  statPills: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  statOpen: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: TEAL.soft, color: TEAL.dark },
  statBusy: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: '#f3e8ff', color: '#7e22ce' },
  statBlock: { fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.45rem', borderRadius: 999, background: '#f1f5f9', color: '#475569' },
  segmented: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 3,
    padding: 3,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid #ccfbf1',
  },
  segmentedNarrow: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.25rem',
    padding: '0.3rem',
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
  segOffNarrow: {
    minHeight: 42,
    fontSize: '0.72rem',
    padding: '0.2rem 0.15rem',
  },
  segOn: {
    minHeight: 36,
    border: 'none',
    borderRadius: 9,
    background: `linear-gradient(135deg, ${TEAL.dark} 0%, #0d9488 100%)`,
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.68rem',
    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.35)',
    cursor: 'pointer',
  },
  segOnNarrow: {
    minHeight: 42,
    fontSize: '0.74rem',
    padding: '0.25rem 0.2rem',
    border: 'none',
    borderRadius: 9,
    background: `linear-gradient(135deg, ${TEAL.dark} 0%, #0d9488 100%)`,
    color: '#fff',
    fontWeight: 800,
    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.35)',
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
  /** Today/Daily + narrow: date picker full width under arrows (avoids horizontal clip). */
  navBarStacked: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '0.35rem',
    rowGap: '0.45rem',
    minWidth: 0,
  },
  navCenter: { flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', minWidth: 0 },
  navCenterInGrid: { flex: 'none', minWidth: 0 },
  navBtn: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontWeight: 800,
    fontSize: '1.15rem',
    lineHeight: 1,
    color: TEAL.dark,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  period: { fontWeight: 800, fontSize: '0.82rem', textAlign: 'center', color: '#111827', letterSpacing: '-0.02em' },
  todayChip: { fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: 999, background: TEAL.soft, color: TEAL.dark, border: `1px solid ${TEAL.border}` },
  dateInput: { minHeight: 38, borderRadius: 10, border: '1px solid #e5e7eb', padding: '0 0.5rem', fontSize: '0.72rem', fontWeight: 600 },
  dateInputFullWidth: {
    gridColumn: '1 / -1',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    justifySelf: 'stretch',
  },
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', fontWeight: 700, color: '#4b5563' },
  legendSwatch: { width: 14, height: 8, borderRadius: 4, display: 'inline-block' },
  tapHint: { margin: 0, fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 },
  tapHintStrong: { margin: 0, fontSize: '0.65rem', color: '#0f766e', fontWeight: 800 },
  body: { marginTop: '0.15rem' },
  emptySlots: { margin: 0, fontSize: '0.78rem', color: '#64748b' },
  dayWrap: { display: 'grid', gap: '0.65rem' },
  slotGroup: { display: 'grid', gap: '0.35rem', minWidth: 0, width: '100%' },
  groupTitle: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    color: TEAL.dark,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: '0.15rem',
    borderBottom: `2px solid ${TEAL.border}`,
  },
  dayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 7.25rem), 1fr))',
    gap: '0.45rem',
    width: '100%',
    minWidth: 0,
    alignItems: 'stretch',
  },
  /** One full-width column on phones — readable time range + status without side clipping. */
  dayGridNarrow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '0.4rem',
    width: '100%',
    minWidth: 0,
    alignItems: 'stretch',
  },
  weekScroll: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    borderRadius: 12,
    border: '1px solid #f3f4f6',
    background: '#fff',
    maxWidth: '100%',
  },
  weekTable: { borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: '0.65rem' },
  weekTableNarrow: { minWidth: '100%', tableLayout: 'fixed', fontSize: '0.58rem' },
  timeTh: { textAlign: 'left', padding: '0.35rem', fontWeight: 800, position: 'sticky', left: 0, background: '#fff', zIndex: 1 },
  timeThNarrow: { width: '22%', maxWidth: '3.75rem', fontSize: '0.55rem', padding: '0.2rem' },
  dayTh: { padding: '0.35rem', fontWeight: 800, minWidth: 56 },
  dayThNarrow: { minWidth: 0, width: '11%', padding: '0.15rem', fontSize: '0.55rem' },
  dayLink: { border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.62rem', cursor: 'pointer', color: TEAL.dark },
  timeTd: { padding: '0.25rem 0.4rem', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1 },
  timeTdNarrow: {
    whiteSpace: 'normal',
    maxWidth: '4.5rem',
    fontSize: '0.55rem',
    lineHeight: 1.25,
    wordBreak: 'break-word',
    verticalAlign: 'top',
    padding: '0.2rem 0.25rem',
  },
  slotTd: { padding: 3, verticalAlign: 'middle' },
  slotTdNarrow: { padding: 2, width: '11%' },
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
  monthToday: { borderColor: TEAL.dark, boxShadow: `inset 0 0 0 1px ${TEAL.border}` },
  monthHeatSome: { background: '#faf5ff' },
  monthHeatBusy: { background: '#f1f5f9' },
  monthDay: { fontWeight: 800, fontSize: '0.78rem' },
  monthMini: { fontSize: '0.52rem', fontWeight: 700, color: '#6b7280', lineHeight: 1.25 },
};
