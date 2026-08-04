import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name (also used as title). */
  label: string;
  tone?: Tone;
  children: ReactNode;
};

const toneStyles: Record<Tone, CSSProperties> = {
  neutral: {
    background: 'var(--bg-elevated, #fff)',
    color: 'var(--text, #111)',
    border: '1px solid var(--border, #d8dde3)',
  },
  accent: {
    background: 'var(--accent, #1B8B4C)',
    color: 'var(--text-inverse, #fff)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--danger-soft, #fee2e2)',
    color: 'var(--danger, #b91c1c)',
    border: '1px solid transparent',
  },
};

/** Compact circular header control — Theme / Refresh / counts / sign-out. */
export function HeaderIconButton({
  label,
  tone = 'neutral',
  children,
  style,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      style={{
        ...styles.base,
        ...toneStyles[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  base: {
    width: 'var(--touch-min, 44px)',
    height: 'var(--touch-min, 44px)',
    minWidth: 'var(--touch-min, 44px)',
    minHeight: 'var(--touch-min, 44px)',
    padding: 0,
    borderRadius: '999px',
    display: 'inline-grid',
    placeItems: 'center',
    fontSize: '0.95rem',
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    flexShrink: 0,
    boxSizing: 'border-box',
    touchAction: 'manipulation',
  },
};
