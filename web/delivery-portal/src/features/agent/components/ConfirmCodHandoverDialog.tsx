import { useEffect, type CSSProperties } from 'react';

type Props = {
  open: boolean;
  amountLabel: string;
  orderCount: number;
  handoverDate: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirm before agent declares COD cash handed to hub or shop. */
export function ConfirmCodHandoverDialog({
  open,
  amountLabel,
  orderCount,
  handoverDate,
  busy,
  onConfirm,
  onClose,
}: Props) {
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
        aria-label="Confirm COD handover"
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={styles.title}>Did you hand over this cash?</h2>
        <p style={styles.description}>
          <strong>{amountLabel}</strong>
          <span style={styles.meta}>
            {' '}
            · {orderCount} order{orderCount === 1 ? '' : 's'} · {handoverDate} (IST)
          </span>
        </p>
        <p style={styles.warn}>
          Tap YES only if you already gave the full collected amount to the hub or shop. They must confirm receipt in
          their app.
        </p>
        <p style={styles.hint}>If you still have the cash, tap NO and hand it over first.</p>

        <div style={styles.actions}>
          <button type="button" style={styles.noBtn} disabled={busy} onClick={onClose}>
            NO — not yet
          </button>
          <button type="button" style={styles.yesBtn} disabled={busy} onClick={onConfirm}>
            {busy ? 'Saving…' : 'YES — I handed over cash'}
          </button>
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
    background: 'rgba(12, 18, 24, 0.55)',
  },
  dialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.15rem',
    display: 'grid',
    gap: '0.65rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.3rem',
  },
  description: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1.4,
  },
  meta: { fontWeight: 650, color: 'var(--text-muted)', fontSize: '0.92rem' },
  warn: {
    margin: 0,
    padding: '0.65rem 0.75rem',
    borderRadius: 10,
    background: 'rgba(255, 183, 77, 0.18)',
    border: '1px solid rgba(255, 183, 77, 0.5)',
    fontWeight: 700,
    fontSize: '0.95rem',
    lineHeight: 1.4,
  },
  hint: {
    margin: 0,
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.35rem',
  },
  noBtn: {
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.85rem 1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  yesBtn: {
    border: 'none',
    borderRadius: 12,
    padding: '0.85rem 1rem',
    minHeight: 'var(--touch-min)',
    background: '#10B981',
    color: '#0f1a10',
    fontWeight: 800,
    fontSize: '1.05rem',
    cursor: 'pointer',
  },
};
