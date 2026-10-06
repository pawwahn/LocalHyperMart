export { formatIsoDateRange } from '@hlm-dates/formatDateRange';

export function codMoney(v: number | null | undefined, compact = false): string {
  const n = Number(v ?? 0);
  if (compact && Number.isInteger(n)) {
    return `₹${n.toLocaleString('en-IN')}`;
  }
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ISO date YYYY-MM-DD → readable IST label */
export function formatCodDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDeliveredIst(at?: string | null): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, monthIndex: number): number {
  if (monthIndex === 1 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[monthIndex] ?? 30;
}

/** IST calendar month bounds as YYYY-MM-DD (monthIndex 0 = January). */
export function monthBoundsIst(year: number, monthIndex: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${year}-${pad(monthIndex + 1)}-01`;
  const to = `${year}-${pad(monthIndex + 1)}-${pad(daysInMonth(year, monthIndex))}`;
  return { from, to };
}

/** Weekday 0=Sun … 6=Sat for YYYY-MM-DD (IST calendar date). */
export function weekdayIst(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayIstIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function parseMonthFromIso(iso: string): { year: number; monthIndex: number } {
  const [y, m] = iso.split('-').map(Number);
  return { year: y, monthIndex: (m ?? 1) - 1 };
}
