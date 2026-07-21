export type SortDir = 'asc' | 'desc';

export type SortState<K extends string> = {
  key: K;
  dir: SortDir;
};

export function toggleSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function compareNumber(a: number | null | undefined, b: number | null | undefined): number {
  const empty = Number.POSITIVE_INFINITY;
  const av = a == null || Number.isNaN(Number(a)) ? empty : Number(a);
  const bv = b == null || Number.isNaN(Number(b)) ? empty : Number(b);
  return av - bv;
}

export function parseSortNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pageWindow<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = total === 0 ? 0 : safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  return {
    total,
    totalPages,
    safePage,
    start,
    end,
    from: total === 0 ? 0 : start + 1,
    to: end,
    pageItems: items.slice(start, end),
  };
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;
