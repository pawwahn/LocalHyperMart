import { useState, type CSSProperties } from 'react';
import type { DeliveryManifestView, PickupManifestView } from '../api/agentApi';

function formatRupee(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}

function isDeliveryManifest(
  manifest: PickupManifestView | DeliveryManifestView,
): manifest is DeliveryManifestView {
  return 'orderId' in manifest;
}

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

export function PickupItemsList({
  manifest,
  loading,
  failed,
  onRetry,
  title = 'Items',
  legend,
  showShop = false,
  defaultOpen = true,
  paymentMethod,
  collectCashAmount,
}: {
  manifest?: PickupManifestView | DeliveryManifestView;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  title?: string;
  legend?: string;
  showShop?: boolean;
  defaultOpen?: boolean;
  paymentMethod?: string | null;
  collectCashAmount?: number | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (loading && !manifest) {
    return <p style={styles.loading}>Loading items…</p>;
  }

  if (!manifest) {
    if (!failed) return null;
    return (
      <div style={styles.missingRow}>
        <span style={styles.missingText}>Items unavailable</span>
        {onRetry ? (
          <button type="button" style={styles.retryLink} onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const lines = manifest.items ?? [];
  const unitCount = lines.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const itemLabel = `${unitCount} item${unitCount === 1 ? '' : 's'}`;
  const delivery = isDeliveryManifest(manifest) ? manifest : null;
  const resolvedMethod = paymentMethod ?? delivery?.paymentMethod;
  const isCod = resolvedMethod === 'COD';
  const resolvedCollect = collectCashAmount ?? delivery?.collectCashAmount;
  const collectAmount =
    isCod && resolvedCollect != null && resolvedCollect > 0 ? resolvedCollect : null;
  const amountLabel =
    isCod && collectAmount != null
      ? formatRupee(collectAmount)
      : formatRupee(manifest.subtotal);

  return (
    <div style={styles.wrap}>
      <button type="button" style={styles.headerBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span style={styles.headerLeft}>
          <span style={styles.bagIcon} aria-hidden>
            🛍️
          </span>
          <span style={styles.headerText}>
            <span style={styles.title}>{title}</span>
            <span style={styles.itemCount}>
              {isCod && collectAmount != null ? 'COD · collect at door · ' : ''}
              {itemLabel}
            </span>
          </span>
        </span>
        <span style={styles.headerRight}>
          <span
            style={isCod ? { ...styles.amountProminent, ...styles.amountCod } : styles.amountProminent}
            aria-label={isCod ? `Collect cash ${amountLabel}` : `Order total ${amountLabel}`}
          >
            {amountLabel}
          </span>
          <span style={styles.chevron} aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </span>
      </button>

      {open ? (
        <>
          {legend ? <p style={styles.legend}>{legend}</p> : null}
          <ul style={styles.list}>
            {lines.map((item, index) => {
              const unit = formatUnit(item.unitCode);
              const metaParts = [
                showShop && item.shopName ? item.shopName : null,
                unit ? unit.short : null,
              ].filter(Boolean);
              return (
                <li key={`${item.shopName ?? ''}-${item.name}-${index}`} style={styles.row}>
                  <div style={styles.nameBlock}>
                    <span style={styles.name}>{item.name}</span>
                    {metaParts.length > 0 ? (
                      <span style={styles.unitHint}>{metaParts.join(' · ')}</span>
                    ) : !unit ? (
                      <span style={styles.unitMissing}>Unit missing</span>
                    ) : null}
                  </div>
                  <strong style={styles.qty}>×{item.quantity}</strong>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    border: '1.5px solid var(--border)',
    overflow: 'hidden',
  },
  headerBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
    margin: 0,
    padding: '0.4rem 0.55rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 36,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: '1 1 auto' },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
  },
  bagIcon: { fontSize: '0.9rem', lineHeight: 1 },
  headerText: { display: 'grid', gap: '0.08rem', minWidth: 0 },
  title: { fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.15 },
  itemCount: {
    fontSize: '0.68rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    lineHeight: 1.15,
  },
  amountProminent: {
    fontSize: '1.22rem',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  amountCod: {
    color: '#92400e',
  },
  chevron: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
  },
  legend: {
    margin: '0 0.7rem 0.3rem',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  list: {
    margin: 0,
    padding: '0 0.55rem 0.45rem',
    listStyle: 'none',
    display: 'grid',
    gap: 0,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    alignItems: 'center',
    fontSize: '0.86rem',
    padding: '0.35rem 0',
    borderTop: '1px solid var(--border)',
  },
  nameBlock: { display: 'grid', gap: 1, minWidth: 0 },
  name: { fontWeight: 700, lineHeight: 1.2 },
  unitHint: { fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.2 },
  unitMissing: { fontSize: '0.68rem', color: '#b45309', fontWeight: 700, lineHeight: 1.2 },
  qty: {
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    fontWeight: 800,
    color: 'var(--text)',
    flexShrink: 0,
  },
  loading: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 },
  missingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.35rem 0.15rem',
  },
  missingText: { margin: 0, color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.78rem' },
  retryLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: '0.25rem 0.35rem',
    minHeight: 36,
  },
  missingBox: {
    padding: '0.55rem 0.7rem',
    borderRadius: 12,
    background: 'rgba(255, 183, 77, 0.12)',
    border: '1px solid rgba(255, 183, 77, 0.45)',
    display: 'grid',
    gap: '0.2rem',
  },
  missingTitle: { margin: 0, color: '#92400e', fontWeight: 800, fontSize: '0.85rem' },
  missingHelp: { margin: 0, color: '#92400e', fontWeight: 600, fontSize: '0.78rem' },
  retry: {
    justifySelf: 'start',
    border: 'none',
    borderRadius: 8,
    padding: '0.4rem 0.7rem',
    background: '#ea580c',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 40,
  },
};
