import type { CSSProperties, ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'brand';

type Props = {
  tone?: Tone;
  children: ReactNode;
  style?: CSSProperties;
};

const tones: Record<Tone, CSSProperties> = {
  brand: { background: 'var(--accent)', color: 'var(--text-inverse)' },
  info: { background: 'var(--bg-tint)', color: 'var(--accent-hover)', border: '1px solid #c6e9d4' },
  success: { background: 'var(--success-soft)', color: '#047857', border: '1px solid #a7f3d0' },
  warning: { background: 'var(--warning-soft)', color: '#92400e', border: '1px solid #fde68a' },
  danger: { background: 'var(--danger-soft)', color: '#b91c1c', border: '1px solid #fecaca' },
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
