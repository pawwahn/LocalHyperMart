import type { CSSProperties, ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'brand';

type Props = {
  tone?: Tone;
  children: ReactNode;
  style?: CSSProperties;
};

const tones: Record<Tone, CSSProperties> = {
  brand: { background: 'var(--accent)', color: 'var(--text-inverse)' },
  info: {
    background: 'var(--accent-soft)',
    color: 'var(--text)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
  },
  success: { background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border))' },
  warning: { background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 35%, var(--border))' },
  danger: { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))' },
};

export function Banner({ tone = 'info', children, style }: Props) {
  return (
    <div
      role="status"
      style={{
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        fontSize: '0.92rem',
        fontWeight: 600,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
