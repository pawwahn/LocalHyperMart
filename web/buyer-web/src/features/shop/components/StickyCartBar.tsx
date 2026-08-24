import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { DeliveryUnlockChip } from './DeliveryUnlockChip';
import { useDeliveryQuote } from '../hooks/useDeliveryQuote';
import { useShop } from '../hooks/useShop';

type Props = {
  itemCount?: number;
  totalLabel?: string;
  to?: string;
  label?: string;
};

/** Floating bottom cart CTA — items + delivery unlock + Next. Hidden on basket. */
export function StickyCartBar({
  itemCount: itemCountProp,
  totalLabel: totalLabelProp,
  to = '/cart',
  label = 'Next',
}: Props) {
  const { cart } = useShop();
  const itemCount = itemCountProp ?? cart?.itemCount ?? 0;
  const itemsPayable = cart?.payableSubtotal ?? 0;
  const totalLabel = totalLabelProp ?? cart?.payableLabel;
  const { nudge, progress } = useDeliveryQuote(itemsPayable, itemCount > 0);

  if (itemCount <= 0) return null;

  return (
    <div style={styles.wrap} role="region" aria-label="Cart summary">
      <style>{BAR_CSS}</style>
      <Link to={to} className="hlm-cart-bar" style={styles.bar}>
        <div style={styles.left}>
          <span style={styles.count}>
            {itemCount} item{itemCount === 1 ? '' : 's'} in bag
          </span>
          {totalLabel ? <span style={styles.total}>{totalLabel}</span> : null}
        </div>
        {nudge ? (
          <DeliveryUnlockChip addMore={nudge.addMore} nextFee={nudge.nextFee} progress={progress} />
        ) : (
          <span style={styles.spacer} />
        )}
        <span style={styles.cta}>
          {label} <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
  );
}

const BAR_CSS = `
  @media (max-width: 400px) {
    .hlm-cart-bar .cart-unlock {
      flex: 1 1 6.5rem;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    zIndex: 40,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0.85rem 0.55rem',
    pointerEvents: 'none',
    animation: 'hlm-slide-up 220ms ease both',
  },
  bar: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    background: 'linear-gradient(105deg, #0C831F 0%, #0A6B1A 55%, #085516 100%)',
    color: 'var(--text-inverse)',
    textDecoration: 'none',
    borderRadius: 16,
    padding: '0.55rem 0.55rem 0.55rem 0.85rem',
    boxShadow: '0 12px 30px rgba(12, 131, 31, 0.38)',
    border: '1px solid color-mix(in srgb, var(--highlight) 35%, transparent)',
  },
  left: { display: 'grid', gap: '0.08rem', flex: '0 0 auto', minWidth: '4.6rem' },
  count: {
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  total: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.02em' },
  spacer: { flex: '1 1 auto', minWidth: 0 },
  cta: {
    fontWeight: 800,
    fontSize: '0.9rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: 'var(--highlight)',
    color: '#0a1a08',
    padding: '0.45rem 0.75rem',
    borderRadius: 999,
    flex: '0 0 auto',
    minHeight: 36,
  },
};
