import { useEffect, type CSSProperties } from 'react';

type Props = {
  open: boolean;
  shopName: string;
  bagNumber?: string | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirm before ringing the vendor shop — sound keeps going until they tap Noticed order. */
export function ConfirmVendorAlertDialog({
  open,
  shopName,
  bagNumber,
  busy,
  error,
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
        aria-label="Alert vendor"
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={styles.title}>Ring this shop?</h2>
        <p style={styles.description}>
          Shop: <strong>{shopName}</strong>
          {bagNumber ? (
            <>
              <br />
              Bag: <strong>{bagNumber}</strong>
            </>
          ) : null}
        </p>
        <p style={styles.warn}>
          Their portal will pop up and keep sounding until they tap <strong>Noticed order</strong>.
        </p>
        <p style={styles.hint}>Sound only plays if their vendor portal is open with sound enabled.</p>
        {error ? <p style={styles.error}>{error}</p> : null}
        <div style={styles.actions}>
          <button type="button" style={styles.noBtn} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={styles.yesBtn} disabled={busy} onClick={onConfirm}>
            {busy ? '…' : 'Yes — alert vendor'}
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
    padding: '1.1rem 1.15rem',
    display: 'grid',
    gap: '0.55rem',
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
  },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 800 },
  description: { margin: 0, fontSize: '0.88rem', lineHeight: 1.4 },
  warn: { margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#b45309', lineHeight: 1.35 },
  hint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
  error: {
    margin: 0,
    padding: '0.5rem 0.6rem',
    borderRadius: 8,
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '0.8rem',
    fontWeight: 700,
    lineHeight: 1.35,
  },
  actions: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.2rem' },
  noBtn: {
    flex: '1 1 7rem',
    minHeight: 44,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  yesBtn: {
    flex: '1 1 8rem',
    minHeight: 44,
    borderRadius: 10,
    border: 'none',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
