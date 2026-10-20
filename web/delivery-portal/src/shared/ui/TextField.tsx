import { useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  /** Tighter padding/gaps for dense forms. */
  compact?: boolean;
};

export function TextField({ label, style, id, type, compact, className, ...rest }: Props) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const inputType = isPassword && revealed ? 'text' : type;
  const baseInput = compact ? styles.inputCompact : styles.input;

  return (
    <label style={compact ? styles.labelCompact : styles.label} htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <div style={styles.inputWrap}>
        <input
          id={inputId}
          type={inputType}
          className={[className, isPassword ? 'hlm-pw' : null].filter(Boolean).join(' ') || undefined}
          style={{
            ...baseInput,
            ...(isPassword ? styles.inputWithToggle : null),
            ...style,
          }}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            style={compact ? styles.toggleCompact : styles.toggle}
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

const toggleBase: CSSProperties = {
  position: 'absolute',
  right: 2,
  top: '50%',
  transform: 'translateY(-50%)',
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontWeight: 800,
  lineHeight: 1,
  padding: '0 0.45rem',
  minHeight: 44,
  minWidth: 44,
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

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
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'stretch', minWidth: 0, width: '100%' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  inputCompact: {
    width: '100%',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.92rem',
    minHeight: 'var(--touch-min)',
    boxSizing: 'border-box',
  },
  inputWithToggle: {
    paddingRight: '3.4rem',
  },
  toggle: {
    ...toggleBase,
    fontSize: '0.76rem',
  },
  toggleCompact: {
    ...toggleBase,
    fontSize: '0.72rem',
  },
};
