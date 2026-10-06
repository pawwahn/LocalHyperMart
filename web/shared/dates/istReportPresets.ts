/** Calendar dates in Asia/Kolkata (YYYY-MM-DD). */
export function isoIstDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function istYmd(d = new Date()): { y: number; m: number } {
  const [y, m] = isoIstDate(d).split('-').map(Number);
  return { y, m };
}

/** Start calendar year of the current India FY (Apr–Mar). */
function currentFyStartYear(d = new Date()): number {
  const { y, m } = istYmd(d);
  return m >= 4 ? y : y - 1;
}

function lastDayOfMonthIso(year: number, month1to12: number): string {
  return new Date(year, month1to12, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Fixed FY quarter/half: full period boundaries.
 * If the period has not started yet (e.g. Q4 Jan–Mar while today is Oct), use the full
 * future range — not “today” as `to`, which would violate from ≤ to.
 * If the period is in progress, cap `to` at today.
 */
function fiscalFixedPeriod(from: string, endInclusive: string): { from: string; to: string } {
  const today = isoIstDate();
  if (today < from) {
    return { from, to: endInclusive };
  }
  return { from, to: endInclusive > today ? today : endInclusive };
}

export type ReportDatePreset =
  | 'today'
  | 'week'
  | 'days30'
  | 'month'
  | 'previousMonth'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'firstHalf'
  | 'secondHalf'
  | 'annual'
  | 'financialYear'
  | 'custom';

export type TransferHistoryPreset = ReportDatePreset | 'all';

/** Standard IST date filters — use everywhere users pick a report or ledger period. */
export const REPORT_DATE_PRESET_OPTIONS: { id: ReportDatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'days30', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'previousMonth', label: 'Previous month' },
  { id: 'q1', label: 'Q1 (Apr–Jun)' },
  { id: 'q2', label: 'Q2 (Jul–Sep)' },
  { id: 'q3', label: 'Q3 (Oct–Dec)' },
  { id: 'q4', label: 'Q4 (Jan–Mar)' },
  { id: 'firstHalf', label: 'HY1 (Apr–Sep)' },
  { id: 'secondHalf', label: 'HY2 (Oct–Mar)' },
  { id: 'annual', label: 'Calendar year' },
  { id: 'financialYear', label: 'FY (Apr–Mar)' },
  { id: 'custom', label: 'Custom' },
];

/** Hub transfer history — same fiscal presets plus all-time. */
export const TRANSFER_HISTORY_PRESET_OPTIONS: { id: TransferHistoryPreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  ...REPORT_DATE_PRESET_OPTIONS.filter((o) => o.id !== 'custom'),
];

export function rangeForReportPreset(preset: Exclude<ReportDatePreset, 'custom'>): { from: string; to: string } {
  const to = isoIstDate();
  const { y, m } = istYmd();
  const fy = currentFyStartYear();

  if (preset === 'today') return { from: to, to };

  if (preset === 'week') {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: isoIstDate(from), to };
  }

  if (preset === 'days30') {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { from: isoIstDate(from), to };
  }

  if (preset === 'month') {
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to };
  }

  if (preset === 'previousMonth') {
    const pmY = m === 1 ? y - 1 : y;
    const pmM = m === 1 ? 12 : m - 1;
    const from = `${pmY}-${String(pmM).padStart(2, '0')}-01`;
    return { from, to: lastDayOfMonthIso(pmY, pmM) };
  }

  if (preset === 'annual') {
    return { from: `${y}-01-01`, to };
  }

  if (preset === 'financialYear') {
    return { from: `${fy}-04-01`, to };
  }

  if (preset === 'q1') {
    return fiscalFixedPeriod(`${fy}-04-01`, `${fy}-06-30`);
  }
  if (preset === 'q2') {
    return fiscalFixedPeriod(`${fy}-07-01`, `${fy}-09-30`);
  }
  if (preset === 'q3') {
    return fiscalFixedPeriod(`${fy}-10-01`, `${fy}-12-31`);
  }
  if (preset === 'q4') {
    return fiscalFixedPeriod(`${fy + 1}-01-01`, `${fy + 1}-03-31`);
  }
  if (preset === 'firstHalf') {
    return fiscalFixedPeriod(`${fy}-04-01`, `${fy}-09-30`);
  }
  if (preset === 'secondHalf') {
    return fiscalFixedPeriod(`${fy}-10-01`, `${fy + 1}-03-31`);
  }

  throw new Error(`Unknown preset: ${String(preset)}`);
}

/** Apply a preset to React state setters (no-op for `custom`). */
export function applyReportDatePreset(
  next: ReportDatePreset,
  setPreset: (p: ReportDatePreset) => void,
  setFrom: (v: string) => void,
  setTo: (v: string) => void,
): void {
  setPreset(next);
  if (next === 'custom') return;
  const r = rangeForReportPreset(next);
  setFrom(r.from);
  setTo(r.to);
}

/** `null` range means no date filter (all time). */
export function rangeForTransferHistoryPreset(preset: TransferHistoryPreset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  return rangeForReportPreset(preset);
}

/** Settlement APIs only accept DAY | WEEK | MONTH | CUSTOM. */
export type SettlementPeriodKind = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export function settlementPeriodKind(preset: ReportDatePreset): SettlementPeriodKind {
  if (preset === 'today') return 'DAY';
  if (preset === 'week') return 'WEEK';
  if (preset === 'month' || preset === 'previousMonth') return 'MONTH';
  return 'CUSTOM';
}

/** Hub COD payment-request API (DAILY | WEEKLY | MONTHLY | CUSTOM). */
export type HubCodPaymentPeriodKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export function hubCodPaymentPeriodKind(preset: ReportDatePreset): HubCodPaymentPeriodKind {
  if (preset === 'today') return 'DAILY';
  return 'CUSTOM';
}
