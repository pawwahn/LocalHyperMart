/** Normalize API / ISO timestamps to YYYY-MM-DD for display. */
export function normalizeIsoDate(iso?: string | null): string | null {
  if (iso == null || iso === '') return null;
  const t = iso.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : iso.trim();
}

/** Two ISO calendar dates with a visible gap (default: spaced arrow). */
export function formatIsoDateRange(
  from?: string | null,
  to?: string | null,
  separator = ' → ',
): string {
  const a = normalizeIsoDate(from);
  const b = normalizeIsoDate(to);
  if (!a && !b) return '—';
  if (!a) return b!;
  if (!b || a === b) return a;
  return `${a}${separator}${b}`;
}

/** Filesystem-safe range slug (not for on-screen display). */
export function isoDateRangeSlug(from?: string | null, to?: string | null): string {
  const a = normalizeIsoDate(from) ?? 'start';
  const b = normalizeIsoDate(to) ?? a;
  return a === b ? a : `${a}_to_${b}`;
}
