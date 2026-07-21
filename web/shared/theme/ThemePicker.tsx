import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ACCENT_PRESETS } from './presets';
import { useTheme } from './ThemeContext';

type Props = {
  /** Compact icon control for mobile headers */
  compact?: boolean;
};

export function ThemePicker({ compact = false }: Props) {
  const { preference, setMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={styles.wrap}>
      <button
        type="button"
        style={compact ? styles.triggerCompact : styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title="Theme & colors"
        onClick={() => setOpen((v) => !v)}
      >
        {compact ? '◐' : 'Theme'}
      </button>
      {open ? (
        <div id={panelId} role="dialog" aria-label="Choose theme" style={styles.panel}>
          <p style={styles.heading}>Appearance</p>
          <div style={styles.modeRow}>
            <button
              type="button"
              style={preference.mode === 'light' ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode('light')}
            >
              Light
            </button>
            <button
              type="button"
              style={preference.mode === 'dark' ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode('dark')}
            >
              Dark
            </button>
          </div>
          <p style={styles.heading}>Color</p>
          <div style={styles.swatches}>
            {ACCENT_PRESETS.map((preset) => {
              const active = preference.accent === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={active}
                  onClick={() => setAccent(preset.id)}
                  style={{
                    ...styles.swatch,
                    background: preset.accent,
                    outline: active ? `2px solid ${preset.accentHover}` : '2px solid transparent',
                    boxShadow: active ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${preset.accent}` : 'none',
                  }}
                />
              );
            })}
          </div>
          <p style={styles.hint}>
            {ACCENT_PRESETS.find((p) => p.id === preference.accent)?.label} ·{' '}
            {preference.mode === 'dark' ? 'Dark' : 'Light'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { position: 'relative' },
  trigger: {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.85rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  triggerCompact: {
    width: 36,
    height: 36,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-full)',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 0.4rem)',
    width: 220,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-soft)',
    padding: '0.75rem',
    zIndex: 80,
    display: 'grid',
    gap: '0.55rem',
  },
  heading: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  modeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' },
  modeBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.5rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modeActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.5rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  swatches: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.35rem',
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  hint: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
};
