import type { CSSProperties } from 'react';

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  pageSizes?: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
};

export function ListPager({
  page,
  pageCount,
  total,
  pageSize,
  pageSizes = [25, 50, 100],
  onPage,
  onPageSize,
}: Props) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div style={styles.bar} role="navigation" aria-label="Table pages">
      <span style={styles.meta}>
        {from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}
      </span>
      <div style={styles.controls}>
        <label style={styles.sizeLabel}>
          Rows
          <select
            style={styles.select}
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          style={styles.btn}
          disabled={page <= 0}
          onClick={() => onPage(0)}
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          style={styles.btn}
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          Prev
        </button>
        <span style={styles.pageNum}>
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          style={styles.btn}
          disabled={page + 1 >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          Next
        </button>
        <button
          type="button"
          style={styles.btn}
          disabled={page + 1 >= pageCount}
          onClick={() => onPage(pageCount - 1)}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem 0.5rem',
    padding: '0.25rem 0.1rem 0',
  },
  meta: { fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' },
  controls: { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' },
  sizeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginRight: '0.15rem',
  },
  select: {
    padding: '0.2rem 0.35rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.72rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  btn: {
    appearance: 'none',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 6,
    padding: '0.22rem 0.45rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 32,
  },
  pageNum: {
    fontSize: '0.72rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    padding: '0 0.25rem',
    minWidth: '3.5rem',
    textAlign: 'center',
  },
};
