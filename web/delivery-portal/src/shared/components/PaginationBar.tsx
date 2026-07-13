import type { CSSProperties } from 'react';

type Props = {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ page, totalPages, totalElements, pageSize, onPageChange }: Props) {
  if (totalElements === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalElements);

  return (
    <div style={styles.bar}>
      <span style={styles.meta}>
        {from}–{to} of {totalElements}
      </span>
      <div style={styles.actions}>
        <button
          type="button"
          style={styles.btn}
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span style={styles.pageLabel}>
          Page {page + 1} / {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          style={styles.btn}
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
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
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--border)',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.8rem' },
  actions: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  btn: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.35rem 0.65rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  pageLabel: { color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '5.5rem', textAlign: 'center' },
};
