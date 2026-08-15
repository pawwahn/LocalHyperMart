import { useEffect, type CSSProperties } from 'react';

type Props = {
  open: boolean;
  shopName: string;
  orderNumber?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirm before agent marks bag taken from shop. */
export function ConfirmTookBagDialog({
  open,
  shopName,
  orderNumber,
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
        aria-label="Confirm took bag"
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={styles.title}>Did you take the bag?</h2>
        <p style={styles.description}>
          Shop: <strong>{shopName}</strong>
          {orderNumber ? (
            <>
              <br />
              Order: <strong>{orderNumber}</strong>
            </>
          ) : null}
        </p>
        <p style={styles.warn}>
          Tap YES only if the bag is in your hand now.
        </p>
        <p style={styles.hint}>If you are still at the shop packing, tap NO.</p>

        <div style={styles.actions}>
          <button type="button" style={styles.noBtn} disabled={busy} onClick={onClose}>
            NO — not yet
          </button>
          <button type="button" style={styles.yesBtn} disabled={busy} onClick={onConfirm}>
            {busy ? '…' : 'YES — I took the bag'}
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
    fontSize: '1.35rem',
  },
  description: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1.4,
  },
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
