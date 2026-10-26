import { useId, useRef, type CSSProperties, type ChangeEvent, type KeyboardEvent } from 'react';

const STYLE_ID = 'hlm-picker-date-styles';

const PICKER_DATE_CSS = `
.hlm-picker-date-wrap {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  color-scheme: light;
  cursor: pointer;
}
.hlm-picker-date-input {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  caret-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  color-scheme: light;
}
.hlm-picker-date-input:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
/* Clicks pass through to the full-size calendar hit target (Chrome/Edge). */
.hlm-picker-date-input::-webkit-datetime-edit,
.hlm-picker-date-input::-webkit-datetime-edit-fields-wrapper,
.hlm-picker-date-input::-webkit-datetime-edit-text,
.hlm-picker-date-input::-webkit-datetime-edit-month-field,
.hlm-picker-date-input::-webkit-datetime-edit-day-field,
.hlm-picker-date-input::-webkit-datetime-edit-year-field {
  pointer-events: none;
  user-select: none;
}
.hlm-picker-date-input::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;
  z-index: 1;
}
.hlm-picker-date-input:disabled::-webkit-calendar-picker-indicator {
  cursor: not-allowed;
}
.hlm-picker-date-hit {
  position: absolute;
  inset: 0;
  z-index: 2;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: inherit;
}
.hlm-picker-date-hit:disabled {
  cursor: not-allowed;
}
.hlm-picker-date-icon {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  pointer-events: none;
  color: var(--text-muted, #64748b);
}
.hlm-picker-date-wrap:focus-within .hlm-picker-date-icon {
  color: var(--accent, #0c831f);
}
`;

function injectPickerDateStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PICKER_DATE_CSS;
  document.head.appendChild(style);
}

/** Open native date picker (Chrome/Edge/Safari 16+); fallback for older browsers. */
export function openDatePicker(input: HTMLInputElement | null | undefined): void {
  if (!input || input.disabled) return;

  const run = () => {
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return true;
      } catch {
        /* user gesture or readonly — retry without readonly below */
      }
    }
    return false;
  };

  if (run()) return;

  const hadReadOnly = input.readOnly;
  input.readOnly = false;
  if (run()) {
    input.readOnly = hadReadOnly;
    return;
  }
  input.readOnly = hadReadOnly;

  input.focus({ preventScroll: true });
  input.click();
}

export type PickerDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
  wrapClassName?: string;
  className?: string;
  style?: CSSProperties;
  showIcon?: boolean;
};

export function PickerDateField({
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  id,
  'aria-label': ariaLabel,
  wrapClassName,
  className,
  style,
  showIcon = true,
}: PickerDateFieldProps) {
  injectPickerDateStyles();
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    openDatePicker(inputRef.current);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  function blockTextEntry(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === 'Tab') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
      return;
    }
    e.preventDefault();
  }

  const wrapClass = ['hlm-picker-date-wrap', wrapClassName].filter(Boolean).join(' ');
  const inputClass = ['hlm-picker-date-field', 'hlm-picker-date-input', className].filter(Boolean).join(' ');
  const padRight = showIcon ? { paddingRight: '2.35rem' } : null;

  return (
    <div className={wrapClass} role="group" aria-label={ariaLabel}>
      <input
        ref={inputRef}
        id={inputId}
        type="date"
        tabIndex={-1}
        className={inputClass}
        style={{ ...defaultInputStyle, ...padRight, ...style, position: 'relative' }}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        required={required}
        onChange={handleChange}
        onKeyDown={blockTextEntry}
        onMouseDown={(e) => e.preventDefault()}
        onFocus={(e) => e.currentTarget.blur()}
      />
      <button
        type="button"
        className="hlm-picker-date-hit"
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel ?? 'Choose date'}
        aria-haspopup="dialog"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => openPicker()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
      />
      {showIcon ? (
        <span className="hlm-picker-date-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

const defaultInputStyle: CSSProperties = {
  border: '1px solid var(--border, #e2e8f0)',
  borderRadius: 8,
  padding: '0.4rem 0.5rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  minHeight: 40,
  color: 'var(--text, #0f172a)',
  background: 'var(--bg, #fff)',
};
