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
      <Link to={to} style={styles.bar}>
        <div style={styles.left}>
          <span style={styles.count}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
          {totalLabel ? <span style={styles.total}>{totalLabel}</span> : null}
        </div>
        <span style={styles.cta}>
          {label} <span aria-hidden>›</span>
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
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    textDecoration: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    boxShadow: '0 10px 28px rgba(12, 131, 31, 0.35)',
  },
  left: { display: 'grid', gap: '0.1rem' },
  count: {
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    opacity: 0.92,
  },
  total: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' },
  cta: { fontWeight: 800, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' },
};
