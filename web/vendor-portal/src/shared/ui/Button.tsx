import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
};

const sizeStyles: Record<Size, CSSProperties> = {
  sm: { padding: '0.45rem 0.75rem', fontSize: '0.85rem' },
  md: { padding: '0.65rem 1rem', fontSize: '0.95rem' },
  lg: { padding: '0.85rem 1.25rem', fontSize: '1rem' },
};

const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    border: 'none',
    boxShadow: '0 4px 12px rgba(27, 139, 76, 0.22)',
  },
  secondary: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    border: '1px solid transparent',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  children,
  style,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        borderRadius: 'var(--radius-md)',
        fontWeight: 700,
        cursor: 'pointer',
        ...sizeStyles[size],
        ...variantStyles[variant],
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
