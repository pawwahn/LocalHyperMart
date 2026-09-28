import { useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui';
import type { ClaimType, OrderItemDetailDto } from '../api/shopApi';

export type ClaimableItem = Pick<
  OrderItemDetailDto,
  'orderItemId' | 'name' | 'shopName' | 'quantity' | 'unitCode' | 'lineTotal' | 'canFileClaim'
>;

export type ClaimDialogProps = {
  open: boolean;
  items: ClaimableItem[];
  /** When opened from a line, pre-select that item. */
  presetItemId?: string | null;
  busy?: boolean;
  onConfirm: (payload: { claimType: ClaimType; orderItemId: string; reason: string }) => void;
  onClose: () => void;
};

const CLAIM_TYPES: Array<{ value: ClaimType; label: string; stored: string; hint: string }> = [
  { value: 'MISSING', label: 'Missing', stored: 'Missing from bag', hint: 'Ordered, not in the bag' },
  { value: 'WRONG_ITEM', label: 'Wrong item', stored: 'Wrong item / quantity', hint: 'Different product or quantity' },
  { value: 'DAMAGED', label: 'Damaged', stored: 'Damaged / unusable', hint: 'Broken, spoiled, or unusable' },
];

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

export function ClaimDialog({
  open,
  items,
  presetItemId,
  busy,
  onConfirm,
  onClose,
}: ClaimDialogProps) {
  const titleId = useId();
  const claimable = useMemo(
    () => items.filter((i) => i.canFileClaim && i.orderItemId),
    [items],
  );
  const [claimType, setClaimType] = useState<ClaimType>('MISSING');
  const [orderItemId, setOrderItemId] = useState('');
  const [comment, setComment] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClaimType('MISSING');
    setComment('');
    setLocalError(null);
    const preset =
      presetItemId && claimable.some((i) => i.orderItemId === presetItemId)
        ? presetItemId
        : (claimable[0]?.orderItemId ?? '');
    setOrderItemId(preset);
  }, [open, presetItemId, claimable]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const selected = claimable.find((i) => i.orderItemId === orderItemId);
  const typeMeta = CLAIM_TYPES.find((t) => t.value === claimType);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!orderItemId) {
      setLocalError('Select which item has the problem.');
      return;
    }
    if (!claimType) {
      setLocalError('Select what went wrong.');
      return;
    }
    const typeLabel = typeMeta?.stored ?? claimType;
    const itemLabel = selected
      ? `${selected.name} × ${selected.quantity}${selected.shopName ? ` (${selected.shopName})` : ''}`
      : 'item';
    const trimmed = comment.trim();
    const reason = trimmed ? `${typeLabel} — ${itemLabel} — ${trimmed}` : `${typeLabel} — ${itemLabel}`;
    onConfirm({ claimType, orderItemId, reason });
  }

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
        <form onSubmit={submit} style={styles.form}>
          <div style={styles.handle} aria-hidden />
          <div>
            <h2 id={titleId} style={styles.title}>
              Report an issue
            </h2>
            <p style={styles.desc}>The hub reviews this and can credit your wallet.</p>
          </div>

          {claimable.length === 0 ? (
            <p style={styles.error}>No claimable items left on this order.</p>
          ) : (
            <>
              <div style={styles.block}>
                <span style={styles.label}>What went wrong?</span>
                <div style={styles.chips} role="radiogroup" aria-label="What went wrong?">
                  {CLAIM_TYPES.map((t) => {
                    const on = claimType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={busy}
                        style={on ? styles.chipOn : styles.chip}
                        onClick={() => setClaimType(t.value)}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <span style={styles.hint}>{typeMeta?.hint}</span>
              </div>

              <div style={styles.block}>
                <span style={styles.label}>{claimable.length > 1 ? 'Which item?' : 'Item'}</span>
                <div style={styles.items}>
                  {claimable.map((item) => {
                    const on = item.orderItemId === orderItemId;
                    return (
                      <button
                        key={item.orderItemId}
                        type="button"
                        disabled={busy}
                        style={on ? styles.itemOn : styles.item}
                        onClick={() => setOrderItemId(item.orderItemId!)}
                      >
                        <span style={styles.itemText}>
                          <span style={styles.itemName}>{item.name}</span>
                          <span style={styles.itemMeta}>
                            {item.shopName ? `${item.shopName} · ` : ''}×{item.quantity}
                          </span>
                        </span>
                        <strong style={styles.itemPrice}>{money(item.lineTotal)}</strong>
                      </button>
                    );
                  })}
                </div>
                {selected ? (
                  <p style={styles.suggest}>
                    Up to <strong>{money(selected.lineTotal)}</strong> wallet credit if approved
                  </p>
                ) : null}
              </div>

              <label style={styles.block}>
                <span style={styles.label}>Note (optional)</span>
                <input
                  value={comment}
                  disabled={busy}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. only 1 kg arrived instead of 2"
                  style={styles.input}
                />
              </label>
            </>
          )}

          {localError ? <p style={styles.error}>{localError}</p> : null}

          <div style={styles.actions}>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose} style={styles.actionBtn}>
              Go back
            </Button>
            <Button type="submit" disabled={busy || claimable.length === 0} style={styles.actionBtn}>
              {busy ? 'Submitting…' : 'Submit claim'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.48)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 480px)',
    justifyContent: 'center',
    alignItems: 'end',
    padding: 0,
    zIndex: 80,
    boxSizing: 'border-box',
  },
  dialog: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    maxHeight: 'min(88dvh, 100%)',
    overflow: 'auto',
    background: 'var(--bg-elevated)',
    borderRadius: '22px 22px 0 0',
    boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.18)',
    padding: '0.35rem 0.9rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    background: 'var(--border)',
    margin: '0.15rem auto 0.35rem',
  },
  form: { display: 'grid', gap: '0.55rem', minWidth: 0, maxWidth: '100%' },
  title: {
    margin: 0,
    fontSize: '1.12rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  desc: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.35 },
  block: { display: 'grid', gap: '0.28rem', minWidth: 0, maxWidth: '100%' },
  label: { fontSize: '0.75rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.01em' },
  chips: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' },
  chip: {
    minHeight: 44,
    minWidth: 0,
    padding: '0.35rem 0.3rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.78rem',
    lineHeight: 1.15,
    cursor: 'pointer',
  },
  chipOn: {
    minHeight: 44,
    minWidth: 0,
    padding: '0.35rem 0.3rem',
    borderRadius: 12,
    border: '1px solid transparent',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.78rem',
    lineHeight: 1.15,
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(12, 131, 31, 0.22)',
  },
  hint: { fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem' },
  items: { display: 'grid', gap: '0.3rem', minWidth: 0, maxHeight: '9.5rem', overflow: 'auto' },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    width: '100%',
    minWidth: 0,
    textAlign: 'left',
    padding: '0.45rem 0.6rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
  },
  itemOn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    width: '100%',
    minWidth: 0,
    textAlign: 'left',
    padding: '0.45rem 0.6rem',
    borderRadius: 12,
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    cursor: 'pointer',
  },
  itemText: { display: 'grid', gap: '0.05rem', minWidth: 0 },
  itemName: {
    fontWeight: 800,
    fontSize: '0.86rem',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  itemPrice: { fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  input: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    minHeight: 44,
    padding: '0.55rem 0.7rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  suggest: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--accent-hover)',
    lineHeight: 1.3,
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 700 },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)',
    gap: '0.4rem',
    minWidth: 0,
    maxWidth: '100%',
    marginTop: '0.1rem',
  },
  actionBtn: { width: '100%', minWidth: 0, minHeight: 46, paddingLeft: '0.5rem', paddingRight: '0.5rem' },
};
