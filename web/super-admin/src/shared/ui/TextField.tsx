import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode };

export function TextField({ label, style, id, ...rest }: Props) {
  const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label style={styles.label} htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <input id={inputId} style={{ ...styles.input, ...style }} {...rest} />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  label: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
    maxWidth: '100%',
  },
  input: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
};
