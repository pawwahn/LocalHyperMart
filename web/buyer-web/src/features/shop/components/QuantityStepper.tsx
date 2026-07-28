import type { CSSProperties } from 'react';

type Props = {
  quantity: number;
  disabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  /** xs = 4-up product grid; sm/md for cart etc. */
  size?: 'xs' | 'sm' | 'md';
};

/** ADD when qty is 0; otherwise filled green − qty + (Blinkit pattern). */
export function QuantityStepper({
  quantity,
  disabled,
  onIncrease,
  onDecrease,
  size = 'sm',
}: Props) {
  if (quantity <= 0) {
    return (
      <button
        type="button"
        style={size === 'md' ? styles.addMd : size === 'xs' ? styles.addXs : styles.add}
        disabled={disabled}
        onClick={onIncrease}
      >
        ADD
      </button>
    );
  }

  return (
    <div
      style={size === 'md' ? styles.stepperMd : size === 'xs' ? styles.stepperXs : styles.stepper}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        style={size === 'xs' ? styles.stepBtnXs : styles.stepBtn}
        disabled={disabled}
        aria-label="Decrease quantity"
        onClick={onDecrease}
      >
        −
      </button>
      <span style={size === 'xs' ? styles.qtyXs : styles.qty}>{quantity}</span>
      <button
        type="button"
        style={size === 'xs' ? styles.stepBtnXs : styles.stepBtn}
        disabled={disabled}
        aria-label="Increase quantity"
        onClick={onIncrease}
      >
        +
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  addXs: {
    minWidth: 40,
    padding: '0.22rem 0.28rem',
    border: '1.5px solid var(--accent)',
    borderRadius: 5,
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.55rem',
    letterSpacing: '0.03em',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(12, 131, 31, 0.12)',
  },
  add: {
    minWidth: 68,
    padding: '0.42rem 0.7rem',
    border: '1.5px solid var(--accent)',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(12, 131, 31, 0.12)',
  },
  addMd: {
    minWidth: 84,
    padding: '0.55rem 0.9rem',
    border: '1.5px solid var(--accent)',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.88rem',
    letterSpacing: '0.06em',
    cursor: 'pointer',
  },
  stepperXs: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 52,
    borderRadius: 5,
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    overflow: 'hidden',
    boxShadow: '0 3px 8px rgba(12, 131, 31, 0.25)',
  },
  stepper: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 88,
    borderRadius: 8,
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(12, 131, 31, 0.28)',
  },
  stepperMd: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 104,
    borderRadius: 10,
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    overflow: 'hidden',
  },
  stepBtnXs: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 800,
    fontSize: '0.8rem',
    lineHeight: 1,
    padding: '0.2rem 0.28rem',
    cursor: 'pointer',
  },
  stepBtn: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 800,
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '0.4rem 0.55rem',
    cursor: 'pointer',
  },
  qtyXs: {
    minWidth: 12,
    textAlign: 'center',
    fontWeight: 800,
    fontSize: '0.65rem',
  },
  qty: {
    minWidth: 22,
    textAlign: 'center',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
};
