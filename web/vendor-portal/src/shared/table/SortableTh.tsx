import type { CSSProperties, ReactNode } from 'react';
import type { SortDir, SortState } from './tableControls';

type Props<K extends string> = {
  label: string;
  column: K;
  sort: SortState<K> | null;
  onSort: (column: K) => void;
  align?: 'left' | 'right' | 'center';
  style?: CSSProperties;
  children?: ReactNode;
};

export function SortableTh<K extends string>({
  label,
  column,
  sort,
  onSort,
  align = 'left',
  style,
  children,
}: Props<K>) {
  const active = sort?.key === column;
  const dir: SortDir | null = active ? sort.dir : null;
  const marker = dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : '';

  return (
    <th style={{ ...styles.base, textAlign: align, ...(active ? styles.active : null), ...style }} scope="col">
      <button
        type="button"
        style={{ ...styles.btn, textAlign: align }}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}${dir ? `, currently ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      >
        {children ?? label}
        <span style={{ ...styles.marker, ...(active ? null : styles.markerIdle) }} aria-hidden="true">
          {marker || ' ↕'}
        </span>
      </button>
    </th>
  );
}

const styles: Record<string, CSSProperties> = {
  base: {
    padding: 0,
    fontWeight: 700,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  active: {
    color: 'var(--text)',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'inherit',
    gap: '0.15rem',
    width: '100%',
    margin: 0,
    padding: '0.45rem 0.5rem',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
    touchAction: 'manipulation',
    minHeight: 40,
  },
  marker: {
    fontSize: '0.72rem',
    opacity: 0.9,
    fontWeight: 800,
  },
  markerIdle: {
    opacity: 0.35,
  },
};
