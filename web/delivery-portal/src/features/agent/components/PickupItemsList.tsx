import type { CSSProperties } from 'react';
import type { PickupManifestView } from '../api/agentApi';

export function PickupItemsList({
  manifest,
  loading,
  failed,
  onRetry,
}: {
  manifest?: PickupManifestView;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  if (loading && !manifest) {
    return <p style={styles.loading}>Loading bag items…</p>;
  }

  if (!manifest) {
    return (
      <div style={styles.missingBox}>
        <p style={styles.missingTitle}>Bag items not showing</p>
        <p style={styles.missingHelp}>
          {failed
            ? 'Phone could not load what is inside the bag. Ask hub uncle, or tap Try again.'
            : 'Still loading bag items…'}
        </p>
        {onRetry ? (
          <button type="button" style={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.title}>Check these items</p>
      <ul style={styles.list}>
        {manifest.items.map((item, index) => (
          <li key={`${item.name}-${index}`} style={styles.row}>
            <span style={styles.name}>{item.name}</span>
            <strong style={styles.qty}>
              ×{item.quantity}
              {item.unitCode ? ` ${item.unitCode}` : ''}
            </strong>
          </li>
        ))}
      </ul>
      <p style={styles.footer}>
        Total {manifest.totalItemCount} · ₹{manifest.subtotal.toFixed(0)}
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    marginTop: '0.35rem',
    padding: '0.75rem 0.85rem',
    borderRadius: 12,
    background: 'rgba(129, 199, 132, 0.1)',
    border: '1px solid rgba(129, 199, 132, 0.35)',
  },
  title: { margin: '0 0 0.45rem', fontSize: '0.9rem', fontWeight: 800 },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'baseline',
    fontSize: '0.95rem',
  },
  name: { fontWeight: 700 },
  qty: { whiteSpace: 'nowrap', fontSize: '1rem' },
  footer: { margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 700 },
  loading: { margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 700 },
  missingBox: {
    marginTop: '0.35rem',
    padding: '0.75rem 0.85rem',
    borderRadius: 12,
    background: 'rgba(255, 183, 77, 0.15)',
    border: '2px solid rgba(255, 183, 77, 0.55)',
    display: 'grid',
    gap: '0.35rem',
  },
  missingTitle: { margin: 0, color: '#92400e', fontWeight: 800, fontSize: '0.95rem' },
  missingHelp: { margin: 0, color: '#92400e', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.35 },
  retry: {
    justifySelf: 'start',
    marginTop: '0.2rem',
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.9rem',
    background: '#ef6c00',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
