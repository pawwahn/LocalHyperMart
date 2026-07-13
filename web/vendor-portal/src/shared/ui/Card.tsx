import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  elevated?: boolean;
  style?: CSSProperties;
};

const pads = { sm: '0.75rem', md: '1rem', lg: '1.25rem' } as const;

export function Card({ children, padding = 'md', elevated, style }: Props) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: elevated ? 'var(--shadow-elevated)' : 'var(--shadow-card)',
        padding: pads[padding],
        animation: 'hlm-fade-up 220ms ease both',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
