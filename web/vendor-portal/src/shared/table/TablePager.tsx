import type { CSSProperties } from 'react';

type Props = {
  total: number;
  from: number;
  to: number;
  page: number;
  totalPages: number;
  selectedLabel?: string;
  onPageChange: (page: number) => void;
};

export function TablePager({
  total,
  from,
  to,
  page,
  totalPages,
  selectedLabel,
  onPageChange,
}: Props) {
  return (
    <div style={styles.bar}>
      <span style={styles.meta}>
        {total === 0 ? '0 results' : `${from}–${to} of ${total}`}
        {selectedLabel ? ` · ${selectedLabel}` : ''}
      </span>
      <div style={styles.pager}>
        <button
          type="button"
          style={{ ...styles.btn, ...(page <= 0 ? styles.btnDisabled : null) }}
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Prev
        </button>
        <span style={styles.pageNum}>
          {page + 1}/{totalPages}
        </span>
        <button
          type="button"
          style={{ ...styles.btn, ...(page >= totalPages - 1 ? styles.btnDisabled : null) }}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  meta: { minWidth: 0 },
  pager: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' },
  pageNum: { fontSize: '0.78rem', minWidth: '2.5rem', textAlign: 'center' },
  btn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    padding: '0.35rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text)',
    touchAction: 'manipulation',
    minHeight: 36,
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
};
