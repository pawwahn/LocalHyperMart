import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type LaundryAgentConfirmStep = 'pickup_customer' | 'at_shop' | 'drop_deliver';

type Props = {
  open: boolean;
  step: LaundryAgentConfirmStep;
  orderNumber?: string;
  customerName?: string | null;
  shopName?: string | null;
  /** e.g. "Cash collected · ₹500" or "Cash not collected" */
  cashSummary?: string | null;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function copyFor(step: LaundryAgentConfirmStep): { title: string; warn: string; yes: string } {
  switch (step) {
    case 'pickup_customer':
      return {
        title: 'Confirm pickup from customer?',
        warn: 'Tap YES only if you have the laundry bag and your cash choice above is correct. This is sent to the shop and customer.',
        yes: 'YES — picked up laundry',
      };
    case 'at_shop':
      return {
        title: 'Confirm at the shop?',
        warn: 'Tap YES only if you handed the bag to the shop and you are at the shop now.',
        yes: 'YES — items at shop',
      };
    case 'drop_deliver':
      return {
        title: 'Finish delivery?',
        warn: 'Tap YES only if the customer got their laundry and you collected cash if shown above.',
        yes: 'YES — finish delivery',
      };
  }
}

export function ConfirmLaundryAgentStepDialog({
  open,
  step,
  orderNumber,
  customerName,
  shopName,
  cashSummary,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const text = copyFor(step);

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
        aria-label={text.title}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={styles.title}>{text.title}</h2>
        <p style={styles.description}>
          {customerName ? (
            <>
              Customer: <strong>{customerName}</strong>
              <br />
            </>
          ) : null}
          {shopName ? (
            <>
              Shop: <strong>{shopName}</strong>
              <br />
            </>
          ) : null}
          {orderNumber ? (
            <>
              Order: <strong>{orderNumber}</strong>
            </>
          ) : null}
        </p>
        {cashSummary ? (
          <p style={styles.cashLine}>
            Payment: <strong>{cashSummary}</strong>
          </p>
        ) : null}
        <p style={styles.warn}>{text.warn}</p>
        <p style={styles.hint}>Wrong tap? Choose NO and fix the dropdown first.</p>

        <div style={styles.actions}>
          <button type="button" style={styles.noBtn} disabled={busy} onClick={onClose}>
            NO — not yet
          </button>
          <button type="button" style={styles.yesBtn} disabled={busy} onClick={onConfirm}>
            {busy ? 'Saving…' : text.yes}
          </button>
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
  cashLine: {
    margin: 0,
    fontSize: '0.95rem',
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
