import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  itemCount: number;
  totalLabel?: string;
  to?: string;
  label?: string;
};

/** Floating bottom cart CTA — Blinkit-style “X ITEMS · Next”. */
export function StickyCartBar({
  itemCount,
  totalLabel,
  to = '/cart',
  label = 'Next',
}: Props) {
  if (itemCount <= 0) return null;

  return (
    <div style={styles.wrap} role="region" aria-label="Cart summary">
      <Link to={to} className="hlm-cart-bar" style={styles.bar}>
        <div style={styles.left}>
          <span style={styles.count}>
            {itemCount} item{itemCount === 1 ? '' : 's'} in bag
          </span>
          {totalLabel ? <span style={styles.total}>{totalLabel}</span> : null}
        </div>
        <span style={styles.cta}>
          {label} <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
  );
}

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
    justifyContent: 'space-between',
    gap: '0.75rem',
    background: 'linear-gradient(105deg, #0C831F 0%, #0A6B1A 55%, #085516 100%)',
    color: 'var(--text-inverse)',
    textDecoration: 'none',
    borderRadius: 16,
    padding: '0.8rem 1rem',
    boxShadow: '0 12px 30px rgba(12, 131, 31, 0.38)',
    border: '1px solid color-mix(in srgb, var(--highlight) 35%, transparent)',
  },
  left: { display: 'grid', gap: '0.08rem' },
  count: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  total: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.08rem', letterSpacing: '-0.02em' },
  cta: {
    fontWeight: 800,
    fontSize: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: 'var(--highlight)',
    color: '#0a1a08',
    padding: '0.4rem 0.75rem',
    borderRadius: 999,
  },
};
