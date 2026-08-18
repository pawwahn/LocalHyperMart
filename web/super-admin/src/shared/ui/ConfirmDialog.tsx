import { useEffect, useId, type CSSProperties } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Single OK button — use for errors after a failed action. */
  alertOnly?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy,
  alertOnly,
  onConfirm,
  onClose,
}: Props) {
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

  return (
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
        <div style={styles.actions}>
          {alertOnly ? null : (
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={alertOnly ? 'primary' : danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={alertOnly ? onClose : onConfirm}
          >
            {busy ? 'Deleting…' : alertOnly ? confirmLabel || 'OK' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.1rem 1.15rem',
    display: 'grid',
    gap: '0.7rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.12rem',
  },
  description: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    lineHeight: 1.4,
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', flexWrap: 'wrap' },
};
