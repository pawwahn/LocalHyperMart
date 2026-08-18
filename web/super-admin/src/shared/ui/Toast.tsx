import { useEffect, type CSSProperties } from 'react';

type Tone = 'success' | 'info' | 'danger';

type Props = {
  open: boolean;
  message: string;
  tone?: Tone;
  durationMs?: number;
  /** Distance from viewport bottom — raise when a sticky footer is present. */
  bottom?: string;
  onClose: () => void;
};

const tones: Record<Tone, CSSProperties> = {
  success: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border))',
    boxShadow: 'var(--shadow-elevated)',
  },
  info: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-elevated)',
  },
  danger: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))',
    boxShadow: 'var(--shadow-elevated)',
  },
};

/** Themed transient pop-up — use instead of success banners for quick feedback. */
export function Toast({
  open,
  message,
  tone = 'success',
  durationMs = 3500,
  bottom = '1.25rem',
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose, message]);

  if (!open || !message) return null;

  return (
    <div style={{ ...styles.wrap, bottom }} role="status" aria-live="polite">
      <div style={{ ...styles.toast, ...tones[tone] }}>
        <span style={styles.message}>{message}</span>
        <button type="button" style={styles.close} onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: '50%',
    bottom: '1.25rem',
    transform: 'translateX(-50%)',
    zIndex: 1100,
    width: 'min(28rem, calc(100vw - 2rem))',
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.85rem 0.95rem',
    borderRadius: 'var(--radius-lg)',
    fontSize: '0.9rem',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  message: { flex: 1, minWidth: 0 },
  close: {
    flexShrink: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.95rem',
    lineHeight: 1,
    padding: '0.15rem',
    fontFamily: 'inherit',
  },
};
