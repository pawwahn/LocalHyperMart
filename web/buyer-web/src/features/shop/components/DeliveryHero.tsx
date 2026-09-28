import type { CSSProperties } from 'react';

type Props = {
  showPlans?: boolean;
  onOpenPlans?: () => void;
};

/** Compact home hero — headline + optional membership CTA. */
export function DeliveryHero({ showPlans, onOpenPlans }: Props) {
  return (
    <aside style={styles.hero} aria-label="Local stores">
      <div style={styles.copy}>
        <p style={styles.title}>Everything from your local stores</p>
        {showPlans && onOpenPlans ? (
          <button type="button" style={styles.plans} onClick={onOpenPlans}>
            Free delivery plans ›
          </button>
        ) : null}
      </div>
      <div style={styles.art} aria-hidden>
        <span>🥦</span>
        <span>🥛</span>
        <span>🍞</span>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.75rem',
    borderRadius: 14,
    background: 'linear-gradient(115deg, #0C831F 0%, #149A2C 55%, #F7CE46 160%)',
    color: '#fff',
    minWidth: 0,
    overflow: 'hidden',
    boxShadow: '0 8px 20px rgba(12, 131, 31, 0.22)',
  },
  copy: { display: 'grid', gap: '0.28rem', minWidth: 0 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.02rem',
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
  },
  plans: {
    justifySelf: 'start',
    border: 'none',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 800,
    borderRadius: 999,
    padding: '0.28rem 0.55rem',
    minHeight: 32,
    cursor: 'pointer',
  },
  art: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.15rem',
    fontSize: '1.25rem',
    lineHeight: 1,
    flexShrink: 0,
  },
};
