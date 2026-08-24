import type { CSSProperties } from 'react';

export function formatRupees(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

type Props = {
  addMore: number;
  nextFee: number;
  progress: number;
};

/** Compact “Add ₹X more / to get delivery at ₹1” chip with scooter progress ring. */
export function DeliveryUnlockChip({ addMore, nextFee, progress }: Props) {
  const pct = Math.min(0.96, Math.max(0.08, progress));
  const c = 2 * Math.PI * 13;
  const dash = `${pct * c} ${c}`;
  const title = `Add ₹${formatRupees(addMore)} more`;
  const sub = nextFee <= 0 ? 'for free delivery' : `to get delivery at ₹${formatRupees(nextFee)}`;
  return (
    <div className="cart-unlock" title={`${title} ${sub}`}>
      <style>{CHIP_CSS}</style>
      <div style={styles.ring} aria-hidden>
        <svg viewBox="0 0 32 32" width="32" height="32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.4" />
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={dash}
            transform="rotate(-90 16 16)"
          />
        </svg>
        <span style={styles.scooter}>🛵</span>
      </div>
      <span style={styles.copy}>
        <strong style={styles.title}>{title}</strong>
        <span style={styles.sub}>{sub}</span>
      </span>
    </div>
  );
}

const CHIP_CSS = `
  .cart-unlock {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    min-width: 0;
    flex: 1 1 8rem;
  }
`;

const styles: Record<string, CSSProperties> = {
  ring: {
    position: 'relative',
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  scooter: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.78rem',
    lineHeight: 1,
  },
  copy: {
    minWidth: 0,
    display: 'grid',
    gap: 1,
  },
  title: {
    fontSize: '0.72rem',
    fontWeight: 800,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#fff',
  },
  sub: {
    fontSize: '0.62rem',
    fontWeight: 600,
    opacity: 0.78,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#fff',
  },
};
