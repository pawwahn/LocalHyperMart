/** Default parallel home collections per 1-hour window (lab can change per slot). */
export const DEFAULT_SLOT_CAPACITY = 5;

export function hourlySlotLabel(startHour: number): string {
  const fmt = (h: number) => {
    const x = ((h % 24) + 24) % 24;
    if (x === 0) return '12 am';
    if (x < 12) return `${x} am`;
    if (x === 12) return '12 pm';
    return `${x - 12} pm`;
  };
  return `${fmt(startHour)}–${fmt(startHour + 1)}`;
}

/** Parse "HH:mm", "HH:mm:ss", or ISO time part to minutes since midnight; null if invalid. */
export function templateTimeToMinutes(raw: string): number | null {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  const clock = t.includes('T') ? t.slice(t.indexOf('T') + 1) : t;
  const m = clock.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return (((h % 24) + 24) % 24) * 60 + min;
}

function trimClockForFallback(raw: string): string {
  const t = raw.trim();
  if (t.includes('T')) {
    const after = t.slice(t.indexOf('T') + 1);
    return after.length >= 5 ? after.slice(0, 5) : after;
  }
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function formatClock12FromMinutes(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Same style as the buyer app: "7 am–8 am", "7 pm–8 pm" (24h → am/pm).
 * Falls back to trimmed 24h when times are not a clean 1-hour window or unparsable.
 */
export function formatDiagnosticsSlotAmPmRange(startTime: string, endTime: string): string {
  const s = templateTimeToMinutes(startTime);
  const e = templateTimeToMinutes(endTime);
  if (s === null || e === null) {
    return `${trimClockForFallback(startTime)}–${trimClockForFallback(endTime)}`;
  }
  const oneHour =
    s % 60 === 0 &&
    e % 60 === 0 &&
    ((s + 60) % (24 * 60) === e || (s === 23 * 60 && e === 0));
  if (oneHour) {
    return hourlySlotLabel(Math.floor(s / 60) % 24);
  }
  return `${formatClock12FromMinutes(s)}–${formatClock12FromMinutes(e)}`;
}

export type HourlySlotTemplate = {
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

/** 24×7 grid of 1-hour collection windows (00:00–01:00 … 23:00–00:00). */
export function buildHourlySlotTemplates(capacity: number = DEFAULT_SLOT_CAPACITY): HourlySlotTemplate[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    /** Staff note only; time range is derived from start/end (buyer UIs format from clock). */
    label: '',
    startTime: `${String(hour).padStart(2, '0')}:00`,
    endTime: `${String((hour + 1) % 24).padStart(2, '0')}:00`,
    capacity: Math.max(1, capacity),
  }));
}
