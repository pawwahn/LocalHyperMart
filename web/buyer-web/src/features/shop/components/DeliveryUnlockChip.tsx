import type { CSSProperties } from 'react';

export function formatRupees(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

type Props = {
  addMore: number;
  nextFee: number;
  progress: number;
  /** `inline` = one text line for tight bars. `compact` = smaller ring + 1-line copy. */
  layout?: 'stacked' | 'inline' | 'compact';
};

/** Compact “Add ₹X more / to get delivery at ₹1” chip with scooter progress ring. */
export function DeliveryUnlockChip({ addMore, nextFee, progress, layout = 'stacked' }: Props) {
  const pct = Math.min(0.96, Math.max(0.08, progress));
  const c = 2 * Math.PI * 13;
  const dash = `${pct * c} ${c}`;
  const title = `Add ₹${formatRupees(addMore)} more`;
  const sub = nextFee <= 0 ? 'for free delivery' : `to get delivery at ₹${formatRupees(nextFee)}`;
  const inlineLine =
    nextFee <= 0
      ? `${title} for free delivery`
      : `${title} · delivery ₹${formatRupees(nextFee)}`;
  const compact = layout === 'compact';
  const inline = layout === 'inline' || compact;
  const ringSize = compact ? 22 : layout === 'inline' ? 28 : 32;
  return (
    <div
      className={`cart-unlock${inline ? ' cart-unlock--inline' : ''}${compact ? ' cart-unlock--compact' : ''}`}
      title={`${title} ${sub}`}
    >
      <style>{CHIP_CSS}</style>
      <div style={{ ...styles.ring, width: ringSize, height: ringSize }} aria-hidden>
        <svg viewBox="0 0 32 32" width={ringSize} height={ringSize}>
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
      {inline ? (
        <span className="cart-unlock-inline">{inlineLine}</span>
      ) : (
        <span style={styles.copy}>
          <strong style={styles.title}>{title}</strong>
          <span style={styles.sub}>{sub}</span>
        </span>
      )}
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
  .cart-unlock--inline {
    flex: 1 1 auto;
    gap: 0.3rem;
  }
  .cart-unlock--inline .cart-unlock-inline {
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.2;
    color: #fff;
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cart-unlock--compact .cart-unlock-inline {
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1.15;
    -webkit-line-clamp: 1;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    display: block;
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
