import type { CSSProperties } from 'react';
import { formatMoney, type ItemPerformance } from '../api/reportsApi';

type Props = {
  rows: ItemPerformance[];
  empty: string;
};

export function ItemRankTable({ rows, empty }: Props) {
  if (rows.length === 0) return <p style={styles.muted}>{empty}</p>;
  return (
    <div style={styles.rankWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            <th style={styles.thRight}>Qty</th>
            <th style={styles.thRight}>Revenue</th>
            <th style={styles.thRight}>Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.name}-${row.unit ?? ''}`}>
              <td style={styles.td}>
                <strong>{row.name}</strong>
                {row.unit ? <div style={styles.sub}>{row.unit}</div> : null}
              </td>
              <td style={styles.tdRight}>{row.quantitySold}</td>
              <td style={styles.tdRight}>{formatMoney(row.revenue)}</td>
              <td style={styles.tdRight}>{row.orderCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  rankWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.88rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.55rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.55rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdRight: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'top',
  },
  sub: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 },
};
