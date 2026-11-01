import { useEffect, useId, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Optional block below description — e.g. local-shop thank-you on checkout. */
  note?: string;
  /** Short kicker above `note` (e.g. brand · town). */
  noteLead?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Single OK button for post-action alerts (not yes/no). */
  alertOnly?: boolean;
  /** Extra block above action buttons (e.g. payment gateway picker). */
  beforeActions?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

/** Themed yes/no dialog — never use window.alert / window.confirm in portal UI. */
export function ConfirmDialog({
  open,
  title,
  description,
  note,
  noteLead,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  danger,
  busy,
  alertOnly,
  beforeActions,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={styles.title}>
          {title}
        </h2>
        <p style={styles.description}>{description}</p>
        {noteLead || note ? (
          <div style={styles.noteWrap} role="note">
            {noteLead ? <p style={styles.noteLead}>{noteLead}</p> : null}
            {note ? <p style={styles.note}>{note}</p> : null}
          </div>
        ) : null}
        {beforeActions ? <div style={styles.beforeActions}>{beforeActions}</div> : null}
        <div style={alertOnly ? styles.actionsSingle : styles.actions}>
          {alertOnly ? null : (
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose} style={styles.actionBtn}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
            style={styles.actionBtn}
          >
            {busy ? 'Placing order…' : alertOnly ? confirmLabel || 'OK' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 130,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(28rem, 100%)',
    maxHeight: 'min(90dvh, 100%)',
    overflowY: 'auto',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.25rem',
    display: 'grid',
    gap: '0.85rem',
    animation: 'hlm-fade-up 180ms ease both',
  },
  beforeActions: {
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.2rem',
    color: 'var(--text)',
  },
  description: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
    lineHeight: 1.45,
  },
  noteWrap: {
    margin: 0,
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    background: 'color-mix(in srgb, var(--accent-soft) 88%, var(--highlight-soft))',
    borderLeft: '3px solid var(--accent)',
    display: 'grid',
    gap: '0.28rem',
  },
  noteLead: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.78rem',
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
    color: 'var(--accent)',
    textTransform: 'none',
  },
  note: {
    margin: 0,
    fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
    fontStyle: 'italic',
    fontWeight: 600,
    fontSize: '0.86rem',
    lineHeight: 1.42,
    color: 'color-mix(in srgb, var(--accent) 78%, #3d2914)',
    letterSpacing: '0.01em',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.55rem',
  },
  actionsSingle: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.55rem',
  },
  actionBtn: {
    width: '100%',
    minHeight: 44,
    whiteSpace: 'nowrap',
  },
};
