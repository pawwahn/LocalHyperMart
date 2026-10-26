import type { BeautySlotRow } from './slots';

/** JSON map YYYY-MM-DD -> "1100,1130" from vendor profile. */
export function parseBlockedSlotsByDate(raw?: string | null): Record<string, string> {
  if (!raw || raw.trim() === '{}') return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [day, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[day] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function blockedSlotIdsForDate(
  date: string,
  profile?: {
    blockedSlotsByDate?: string | null;
    blockedSlotDate?: string | null;
    blockedSlotIds?: string | null;
  } | null,
  slots: readonly BeautySlotRow[] = [],
): string[] {
  if (!profile || !date) return [];
  const byDate = parseBlockedSlotsByDate(profile.blockedSlotsByDate);
  const csv = byDate[date] ?? (profile.blockedSlotDate === date ? profile.blockedSlotIds : null);
  if (!csv) return [];
  const allowed = new Set(slots.map((s) => s.id));
  return csv
    .split(',')
    .map((part) => part.trim())
    .filter((id) => allowed.has(id));
}
