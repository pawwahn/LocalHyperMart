import type { CSSProperties, ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

type Props = {
  tone?: Tone;
  children: ReactNode;
};

const tones: Record<Tone, CSSProperties> = {
  neutral: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  success: { background: 'var(--success-soft)', color: '#047857' },
  warning: { background: 'var(--warning-soft)', color: '#92400e' },
  danger: { background: 'var(--danger-soft)', color: '#b91c1c' },
  brand: { background: 'var(--accent-soft)', color: 'var(--accent-hover)' },
};

export function Badge({ tone = 'neutral', children }: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.65rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}
