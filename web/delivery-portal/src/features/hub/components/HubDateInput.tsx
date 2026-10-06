import { useId, type CSSProperties, type ChangeEvent } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
};

export function HubDateInput({ value, onChange, max }: Props) {
  const uid = useId();
  const className = 'hlm-date-input';

  return (
    <span style={styles.wrap}>
      <style>{`
        input.${className}::-webkit-calendar-picker-indicator {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          opacity: 0;
          cursor: pointer;
        }
        input.${className}::-webkit-datetime-edit-fields-wrapper { padding: 0; }
      `}</style>
      <input
        id={uid}
        className={className}
        type="date"
        value={value}
        max={max}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={styles.input}
      />
      <span style={styles.icon} aria-hidden>
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
          <rect x="2.75" y="4.25" width="14.5" height="13" rx="2.2" stroke="#334155" strokeWidth="1.7" />
          <path d="M3 8.25h14" stroke="#334155" strokeWidth="1.7" />
          <path d="M7 2.75v3.1M13 2.75v3.1" stroke="#334155" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'relative',
    display: 'block',
    minWidth: '13.25rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.4rem 2.15rem 0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    minHeight: 40,
    color: 'var(--text)',
    background: 'var(--bg)',
    colorScheme: 'light',
  },
  icon: {
    position: 'absolute',
    right: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
  },
};
