/** Koya Glam appointment grid (IST). Defaults: 8:00–20:00, 45 min steps. */
export const BEAUTY_LEAD_MS = 60 * 60 * 1000;

export type BeautySlotScheduleConfig = {
  dayOpen: string;
  dayClose: string;
  intervalMinutes: number;
};

export const DEFAULT_BEAUTY_SLOT_SCHEDULE: BeautySlotScheduleConfig = {
  dayOpen: '08:00',
  dayClose: '20:00',
  intervalMinutes: 45,
};

export type BeautySlotRow = {
  id: string;
  label: string;
  start: string;
  end: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseHm(value: string): number {
  const parts = value.trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

/** Normalize browser/API times to HH:mm for inputs and payloads. */
export function trimBeautyTime(value?: string | null): string {
  if (!value) return DEFAULT_BEAUTY_SLOT_SCHEDULE.dayOpen;
  const parts = String(value).trim().split(':');
  if (parts.length < 2) return value.trim();
  return `${pad2(Number(parts[0]) || 0)}:${pad2(Number(parts[1]) || 0)}`;
}

function clampInterval(minutes: number): number {
  if (minutes <= 15) return 15;
  if (minutes <= 30) return 30;
  if (minutes <= 45) return 45;
  return 60;
}

function formatSlotLabel(hour: number, minute: number): string {
  const mins = hour * 60 + minute;
  const h12 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h12 >= 12 ? 'PM' : 'AM';
  const displayHour = h12 % 12 === 0 ? 12 : h12 % 12;
  if (m === 0) return `${displayHour} ${period}`;
  return `${displayHour}:${pad2(m)} ${period}`;
}

function coerceIntervalMinutes(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return clampInterval(n);
}

function coerceTimeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return trimBeautyTime(value);
  }
  if (Array.isArray(value) && value.length >= 2) {
    const h = Number(value[0]);
    const m = Number(value[1]);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return `${pad2(h)}:${pad2(m)}`;
    }
  }
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const h = Number(o.hour ?? o.hours ?? o.H ?? NaN);
    const m = Number(o.minute ?? o.minutes ?? o.M ?? NaN);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return `${pad2(h)}:${pad2(m)}`;
    }
  }
  return trimBeautyTime(fallback);
}

export function normalizeBeautySlotSchedule(raw?: Partial<BeautySlotScheduleConfig> | null): BeautySlotScheduleConfig {
  const intervalMinutes =
    coerceIntervalMinutes(raw?.intervalMinutes) ?? DEFAULT_BEAUTY_SLOT_SCHEDULE.intervalMinutes;
  const dayOpen = coerceTimeString(raw?.dayOpen, DEFAULT_BEAUTY_SLOT_SCHEDULE.dayOpen);
  const dayClose = coerceTimeString(raw?.dayClose, DEFAULT_BEAUTY_SLOT_SCHEDULE.dayClose);
  const openMin = parseHm(dayOpen);
  const closeMin = parseHm(dayClose);
  if (openMin >= closeMin || openMin + intervalMinutes > closeMin) {
    return {
      dayOpen: DEFAULT_BEAUTY_SLOT_SCHEDULE.dayOpen,
      dayClose: DEFAULT_BEAUTY_SLOT_SCHEDULE.dayClose,
      intervalMinutes,
    };
  }
  return { dayOpen, dayClose, intervalMinutes };
}

export function buildBeautySlots(config?: Partial<BeautySlotScheduleConfig> | null): BeautySlotRow[] {
  const schedule = normalizeBeautySlotSchedule(config);
  const rows: BeautySlotRow[] = [];
  const dayOpen = parseHm(schedule.dayOpen);
  const dayClose = parseHm(schedule.dayClose);
  for (let t = dayOpen; t + schedule.intervalMinutes <= dayClose; t += schedule.intervalMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const endT = t + schedule.intervalMinutes;
    const eh = Math.floor(endT / 60);
    const em = endT % 60;
    rows.push({
      id: `${pad2(h)}${pad2(m)}`,
      label: formatSlotLabel(h, m),
      start: `${pad2(h)}:${pad2(m)}`,
      end: `${pad2(eh)}:${pad2(em)}`,
    });
  }
  return rows;
}

/** @deprecated use buildBeautySlots() — default shop schedule */
export const BEAUTY_SLOTS = buildBeautySlots();

export type BeautySlotId = string;

export function parseBlockedBeautySlotIds(raw?: string | null, slots: readonly BeautySlotRow[] = BEAUTY_SLOTS): BeautySlotId[] {
  const allowed = new Set(slots.map((slot) => slot.id));
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((id): id is BeautySlotId => allowed.has(id));
}

/** Map an ISO slot start to the grid slot id in IST. */
export function beautySlotIdFromIso(
  iso?: string | null,
  slots: readonly BeautySlotRow[] = BEAUTY_SLOTS,
): BeautySlotId | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const id = `${pad2(hour)}${pad2(minute)}`;
  return slots.some((s) => s.id === id) ? id : null;
}

export function istDateFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function scheduleFromArtist(
  artist?:
    | {
        slotDayOpen?: string | null;
        slotDayClose?: string | null;
        slotIntervalMinutes?: number | string | null;
        slot_day_open?: string | null;
        slot_day_close?: string | null;
        slot_interval_minutes?: number | string | null;
      }
    | null,
): BeautySlotScheduleConfig {
  const ext = artist as Record<string, unknown> | null | undefined;
  return normalizeBeautySlotSchedule({
    dayOpen: (artist?.slotDayOpen ?? ext?.slot_day_open) as string | undefined,
    dayClose: (artist?.slotDayClose ?? ext?.slot_day_close) as string | undefined,
    intervalMinutes: coerceIntervalMinutes(
      artist?.slotIntervalMinutes ?? ext?.slot_interval_minutes,
    ) ?? undefined,
  });
}
