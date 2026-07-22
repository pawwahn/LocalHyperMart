import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
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

const CLAIM_TYPES: Array<{ value: ClaimType; label: string; hint: string }> = [
  { value: 'MISSING', label: 'Missing from bag', hint: 'Ordered but not received' },
  { value: 'WRONG_ITEM', label: 'Wrong item / quantity', hint: 'Different product or wrong qty' },
  { value: 'DAMAGED', label: 'Damaged / unusable', hint: 'Broken, spoiled, or unusable' },
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
  const typeRef = useRef<HTMLSelectElement>(null);
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
    const t = window.setTimeout(() => typeRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
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
    const typeLabel = typeMeta?.label ?? claimType;
    const itemLabel = selected
      ? `${selected.quantity}× ${selected.name}${selected.shopName ? ` (${selected.shopName})` : ''}`
      : 'item';
    const trimmed = comment.trim();
    const reason = trimmed ? `${typeLabel} — ${itemLabel} — ${trimmed}` : `${typeLabel} — ${itemLabel}`;
    onConfirm({ claimType, orderItemId, reason });
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
              Report an issue
            </h2>
            <p style={styles.desc}>
              Tell us what went wrong and which item. The town hub will review and may credit your
              wallet.
            </p>
          </div>

          {claimable.length === 0 ? (
            <p style={styles.error}>No claimable items left on this order.</p>
          ) : (
            <>
              <label style={styles.label}>
                What went wrong?
                <select
                  ref={typeRef}
                  value={claimType}
                  disabled={busy}
                  onChange={(e) => setClaimType(e.target.value as ClaimType)}
                  style={styles.select}
                >
                  {CLAIM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span style={styles.hint}>{typeMeta?.hint}</span>
              </label>

              <label style={styles.label}>
                Which item?
                <select
                  value={orderItemId}
                  disabled={busy}
                  onChange={(e) => setOrderItemId(e.target.value)}
                  style={styles.select}
                >
                  {claimable.map((item) => (
                    <option key={item.orderItemId} value={item.orderItemId!}>
                      {item.quantity}× {item.name}
                      {item.shopName ? ` · ${item.shopName}` : ''}
                      {` · ${money(item.lineTotal)}`}
                    </option>
                  ))}
                </select>
              </label>

              {selected ? (
                <p style={styles.suggest}>
                  If approved, hub can credit up to <strong>{money(selected.lineTotal)}</strong> to
                  your wallet for this line.
                </p>
              ) : null}

              <label style={styles.label}>
                Extra detail (optional)
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
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Go back
            </Button>
            <Button type="submit" disabled={busy || claimable.length === 0}>
              {busy ? 'Submitting…' : 'Submit claim'}
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
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    zIndex: 80,
  },
  dialog: {
    width: 'min(440px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
    padding: '1.15rem 1.2rem',
  },
  form: { display: 'grid', gap: '0.85rem' },
  title: { margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-display)', fontWeight: 800 },
  desc: { margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.45 },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' },
  select: {
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  input: {
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  hint: { fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' },
  suggest: {
    margin: 0,
    padding: '0.65rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontSize: '0.88rem',
    lineHeight: 1.4,
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' },
};
