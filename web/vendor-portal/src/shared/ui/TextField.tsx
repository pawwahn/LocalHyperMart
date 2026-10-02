import { useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode };

export function TextField({ label, style, id, type, ...rest }: Props) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <label style={styles.label} htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <div style={styles.inputWrap}>
        <input
          id={inputId}
          type={inputType}
          style={{ ...styles.input, ...(isPassword ? styles.inputWithToggle : null), ...style }}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            style={styles.toggle}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'stretch' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  inputWithToggle: {
    paddingRight: '4.25rem',
  },
  toggle: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    fontWeight: 750,
    fontSize: '0.78rem',
    padding: '0.35rem 0.55rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
