import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type Tone = 'success' | 'info' | 'danger';

type Placement = 'bottom' | 'center';

type Props = {
  open: boolean;
  message: string;
  /** Shown prominently below message — e.g. platform name on save confirmations. */
  brandName?: string;
  tone?: Tone;
  durationMs?: number;
  /** Bottom bar (default) or viewport center — center uses a light scrim and portals to body. */
  placement?: Placement;
  /** Distance from viewport bottom when placement is bottom — raise when a sticky footer is present. */
  bottom?: string;
  onClose: () => void;
};

const tones: Record<Tone, CSSProperties> = {
  success: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid color-mix(in srgb, var(--success) 45%, var(--border))',
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

/** Themed transient pop-up — use instead of native alert or unthemed banners for quick feedback. */
export function Toast({
  open,
  message,
  brandName,
  tone = 'success',
  durationMs = 3500,
  placement = 'bottom',
  bottom = '1.25rem',
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose, message]);

  if (!open || !message) return null;

  const wrapStyle: CSSProperties =
    placement === 'center'
      ? styles.wrapCenter
      : { ...styles.wrapBottom, bottom };

  const body = (
    <>
      {placement === 'center' ? (
        <div style={styles.scrim} role="presentation" onClick={onClose} aria-hidden />
      ) : null}
      <div style={wrapStyle} role="status" aria-live="polite">
        <div
          style={{
            ...styles.toast,
            ...tones[tone],
            ...(placement === 'center' ? styles.toastCenter : null),
            ...(brandName ? styles.toastWithBrand : null),
          }}
        >
          <div style={brandName ? styles.messageBlock : styles.messageRow}>
            <span style={brandName ? styles.lead : styles.message}>{message}</span>
            {brandName ? (
              <span style={styles.brand} aria-label={`Platform: ${brandName}`}>
                {brandName}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            style={brandName ? styles.closeOverlay : styles.closeInline}
            onClick={onClose}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );

  if (placement === 'center' && typeof document !== 'undefined') {
    return createPortal(body, document.body);
  }

  return body;
}

const wrapBase: CSSProperties = {
  position: 'fixed',
  left: '50%',
  zIndex: 1200,
  width: 'min(22rem, calc(100vw - 2rem))',
  pointerEvents: 'none',
};

const styles: Record<string, CSSProperties> = {
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 1190,
    background: 'color-mix(in srgb, var(--text) 18%, transparent)',
    pointerEvents: 'auto',
  },
  wrapBottom: {
    ...wrapBase,
    bottom: '1.25rem',
    transform: 'translateX(-50%)',
  },
  wrapCenter: {
    ...wrapBase,
    top: '50%',
    transform: 'translate(-50%, -50%)',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.85rem 0.95rem',
    borderRadius: 'var(--radius-lg)',
    fontSize: '0.9rem',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  toastCenter: {
    padding: '1.1rem 1.15rem 1rem',
    textAlign: 'center',
  },
  toastWithBrand: {
    position: 'relative',
    alignItems: 'center',
  },
  messageRow: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
  },
  messageBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.55rem',
  },
  message: { flex: 1, minWidth: 0 },
  lead: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  brand: {
    display: 'block',
    fontFamily: 'var(--font-display, inherit)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--accent)',
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
  },
  closeInline: {
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
  closeOverlay: {
    position: 'absolute',
    top: '0.45rem',
    right: '0.45rem',
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
