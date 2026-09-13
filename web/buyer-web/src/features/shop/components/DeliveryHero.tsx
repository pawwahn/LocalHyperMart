import type { CSSProperties } from 'react';

type Props = {
  townLabel: string;
  showPlans?: boolean;
  onOpenPlans?: () => void;
};

/** Compact Instamart-style home hero — same-day grocery, not a fake 10-min claim. */
export function DeliveryHero({ townLabel, showPlans, onOpenPlans }: Props) {
  const place = townLabel === 'Choose your town' ? 'your town' : townLabel;

  return (
    <aside style={styles.hero} aria-label="Delivery promise">
      <div style={styles.copy}>
        <span style={styles.chip}>Same-day</span>
        <p style={styles.title}>Groceries from shops in {place}</p>
        <p style={styles.sub}>Neighbourhood vendors · pay on delivery</p>
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
    padding: '0.7rem 0.8rem',
    borderRadius: 14,
    background: 'linear-gradient(115deg, #0C831F 0%, #149A2C 55%, #F7CE46 160%)',
    color: '#fff',
    minWidth: 0,
    overflow: 'hidden',
    boxShadow: '0 8px 20px rgba(12, 131, 31, 0.22)',
  },
  copy: { display: 'grid', gap: '0.22rem', minWidth: 0 },
  chip: {
    justifySelf: 'start',
    background: '#F7CE46',
    color: '#1A1C1A',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderRadius: 999,
    padding: '0.14rem 0.45rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.02rem',
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
  },
  sub: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 600,
    opacity: 0.92,
  },
  plans: {
    justifySelf: 'start',
    marginTop: '0.12rem',
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
