import type { CSSProperties } from 'react';
import type { PickupManifestView } from '../api/agentApi';

/** Human labels for catalog unit codes (KG, PIECE, L, …). */
function formatUnit(unitCode: string | null | undefined): { short: string; full: string } | null {
  const code = (unitCode ?? '').trim().toUpperCase();
  if (!code) return null;
  switch (code) {
    case 'KG':
    case 'KILOGRAM':
      return { short: 'kg', full: 'kilogram' };
    case 'G':
    case 'GRAM':
      return { short: 'g', full: 'gram' };
    case 'L':
    case 'LTR':
    case 'LITRE':
    case 'LITER':
      return { short: 'L', full: 'litre' };
    case 'ML':
      return { short: 'ml', full: 'millilitre' };
    case 'PIECE':
    case 'PCS':
    case 'PC':
    case 'NOS':
    case 'UNIT':
      return { short: 'pcs', full: 'pieces' };
    case 'PACK':
    case 'PKT':
      return { short: 'pack', full: 'pack' };
    case 'DOZEN':
      return { short: 'dozen', full: 'dozen' };
    default:
      return { short: code.toLowerCase(), full: code.toLowerCase() };
  }
}

function formatTakeAmount(quantity: number, unitCode: string | null | undefined): string {
  const unit = formatUnit(unitCode);
  return unit ? `${quantity} ${unit.short}` : String(quantity);
}

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
      <p style={styles.legend}>Take = quantity × unit from catalog (kg / pcs / L)</p>
      <div style={styles.headRow}>
        <span>Item</span>
        <span>Take</span>
      </div>
      <ul style={styles.list}>
        {manifest.items.map((item, index) => {
          const unit = formatUnit(item.unitCode);
          return (
            <li key={`${item.name}-${index}`} style={styles.row}>
              <div style={styles.nameBlock}>
                <span style={styles.name}>{item.name}</span>
                <span style={unit ? styles.unitHint : styles.unitMissing}>
                  {unit ? unit.full : 'Unit missing — confirm with shop'}
                </span>
              </div>
              <strong style={styles.qty}>{formatTakeAmount(item.quantity, item.unitCode)}</strong>
            </li>
          );
        })}
      </ul>
      <p style={styles.footer}>
        {manifest.items.length} product{manifest.items.length === 1 ? '' : 's'} · ₹
        {manifest.subtotal.toFixed(0)}
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
  title: { margin: '0 0 0.2rem', fontSize: '0.9rem', fontWeight: 800 },
  legend: {
    margin: '0 0 0.55rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  headRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '0.35rem',
  },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.45rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center',
    fontSize: '0.95rem',
  },
  nameBlock: { display: 'grid', gap: '0.1rem' },
  name: { fontWeight: 700 },
  unitHint: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  unitMissing: { fontSize: '0.75rem', color: '#b45309', fontWeight: 700 },
  qty: {
    whiteSpace: 'nowrap',
    fontSize: '1.05rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.2rem 0.65rem',
  },
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
