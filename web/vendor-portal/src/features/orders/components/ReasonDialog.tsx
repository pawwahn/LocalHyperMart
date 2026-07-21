import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Button } from '@/shared/ui';

export type ReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Label for dismiss / keep action (default: Go back). */
  cancelLabel?: string;
  defaultReason?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Go back',
  defaultReason = 'Out of stock',
  danger,
  busy,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState(defaultReason);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(defaultReason);
    setLocalError(null);
    // Focus reason field but do not select-all — avoids accidental Enter submitting immediately.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, defaultReason]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setLocalError('Please enter a reason.');
      inputRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  }

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
        <form onSubmit={submit} style={styles.form}>
          <div>
            <h2 id={titleId} style={styles.title}>
              {title}
            </h2>
            <p style={styles.description}>{description}</p>
          </div>

          <label style={styles.label} htmlFor="reason-dialog-input">
            <span>Reason</span>
            <input
              id="reason-dialog-input"
              ref={inputRef}
              style={styles.input}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (localError) setLocalError(null);
              }}
              disabled={busy}
              placeholder="e.g. Out of stock"
              autoComplete="off"
            />
          </label>

          {localError ? <p style={styles.error}>{localError}</p> : null}

          <div style={styles.actions}>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy}>
              {busy ? '…' : confirmLabel}
            </Button>
          </div>
        </form>
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
    animation: 'hlm-fade-up 180ms ease both',
  },
  form: { display: 'grid', gap: '1rem' },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.2rem',
    color: 'var(--text)',
  },
  description: {
    margin: '0.4rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
    lineHeight: 1.45,
  },
  label: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  input: {
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
};
