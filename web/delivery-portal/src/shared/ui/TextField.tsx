import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  /** Tighter padding/gaps for dense forms. */
  compact?: boolean;
};

export function TextField({ label, style, id, compact, ...rest }: Props) {
  const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label style={compact ? styles.labelCompact : styles.label} htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <input id={inputId} style={{ ...(compact ? styles.inputCompact : styles.input), ...style }} {...rest} />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  labelCompact: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
  },
  input: {
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  inputCompact: {
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.92rem',
    minHeight: 'var(--touch-min)',
    boxSizing: 'border-box',
  },
};
