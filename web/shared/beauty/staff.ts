function mergeOverrideEntry(map: Record<string, number>, key: string, value: unknown) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || value == null || value === '') return;
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  map[key] = Math.max(1, Math.min(50, n));
}

export function parseStaffOverrides(raw?: string | null | Record<string, unknown>): Record<string, number> {
  const map: Record<string, number> = {};
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      mergeOverrideEntry(map, key, value);
    }
    return map;
  }
  if (raw == null || raw === '{}') return map;
  if (typeof raw !== 'string') return map;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          mergeOverrideEntry(map, key, value);
        }
        return map;
      }
    } catch {
      /* fall through to regex */
    }
  }
  const re = /"?(\d{4}-\d{2}-\d{2})"?\s*:\s*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    map[match[1]] = Math.max(1, Math.min(50, Number(match[2])));
  }
  return map;
}

export function effectiveStaffForDate(defaultStaff: number, overrides: Record<string, number>, date: string): number {
  const base = Math.max(1, Math.min(50, defaultStaff));
  const v = overrides[date];
  return v == null ? base : Math.max(1, Math.min(50, v));
}

export function serializeStaffOverrides(overrides: Record<string, number>): string {
  const keys = Object.keys(overrides).sort();
  if (!keys.length) return '{}';
  return `{${keys.map((k) => `"${k}":${overrides[k]}`).join(',')}}`;
}
