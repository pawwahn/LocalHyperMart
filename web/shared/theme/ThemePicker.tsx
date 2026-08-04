import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { ACCENT_PRESETS } from './presets';
import { useTheme } from './ThemeContext';

type Props = {
  /** Compact circular icon (default). Pass false for a text “Theme” pill. */
  compact?: boolean;
};

type PanelPos = { top: number; left: number };

export function ThemePicker({ compact = true }: Props) {
  const { preference, setMode, setAccent, personalized } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos>({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function place() {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const panelW = panelRef.current?.offsetWidth || 240;
      const panelH = panelRef.current?.offsetHeight || 220;
      const gap = 8;
      let left = trigger.right - panelW;
      left = Math.min(Math.max(8, left), window.innerWidth - panelW - 8);
      let top = trigger.bottom + gap;
      if (top + panelH > window.innerHeight - 8) {
        top = Math.max(8, trigger.top - panelH - gap);
      }
      setPos((prev) => (prev.top === top && prev.left === left ? prev : { top, left }));
    }

    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
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

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Choose theme"
            style={{
              ...styles.panel,
              top: pos.top,
              left: pos.left,
            }}
          >
            {!personalized ? (
              <p style={styles.hint}>Preview only — sign in to save.</p>
            ) : null}
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
                      boxShadow: active
                        ? `0 0 0 2px var(--bg-elevated, #fff), 0 0 0 4px ${preset.accent}`
                        : '0 0 0 1px rgba(15, 23, 20, 0.2)',
                    }}
                  />
                );
              })}
            </div>
            <p style={styles.hint}>
              {ACCENT_PRESETS.find((p) => p.id === preference.accent)?.label} ·{' '}
              {preference.mode === 'dark' ? 'Dark' : 'Light'}
            </p>
          </div>,
          document.body,
        )
      : null;

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
      {panel}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { position: 'relative', flexShrink: 0, zIndex: 2 },
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
    width: 'var(--touch-min, 44px)',
    height: 'var(--touch-min, 44px)',
    minWidth: 'var(--touch-min, 44px)',
    minHeight: 'var(--touch-min, 44px)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated, var(--bg-muted))',
    color: 'var(--text)',
    borderRadius: '999px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    boxSizing: 'border-box',
  },
  panel: {
    position: 'fixed',
    width: 240,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated, 0 12px 40px rgba(15, 23, 20, 0.18))',
    padding: '0.85rem',
    zIndex: 10000,
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(28px, 1fr))',
    gap: '0.45rem',
    justifyItems: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
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
