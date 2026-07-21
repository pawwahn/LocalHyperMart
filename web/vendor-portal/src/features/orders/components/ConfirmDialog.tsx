import { useEffect, useId, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Single OK button for post-action alerts (not yes/no). */
  alertOnly?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Themed yes/no dialog — never use window.alert / window.confirm in portal UI. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  danger,
  busy,
  alertOnly,
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
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '…' : alertOnly ? confirmLabel || 'OK' : confirmLabel}
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
    width: 'min(28rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.25rem',
    display: 'grid',
    gap: '0.85rem',
    animation: 'hlm-fade-up 180ms ease both',
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
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
};
