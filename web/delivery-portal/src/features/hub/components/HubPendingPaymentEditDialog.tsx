import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { updateHubPaymentSubmission, type HubPaymentSubmission } from '../api/hubPaymentApi';
import { HubDateInput } from './HubDateInput';
import { HubPaymentConfirmDialog } from './HubPaymentConfirmDialog';

type Props = {
  open: boolean;
  token: string;
  row: HubPaymentSubmission | null;
  onSaved: () => void;
  onClose: () => void;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

export function HubPendingPaymentEditDialog({ open, token, row, onSaved, onClose }: Props) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [hubNotes, setHubNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setStep('form');
    setPaymentDate(row.paymentDate?.slice(0, 10) ?? '');
    setPaymentReference(row.paymentReference ?? '');
    setHubNotes(row.hubNotes ?? '');
    setBusy(false);
    setError(null);
  }, [open, row]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open || !row) return null;

  const rejected = row.status === 'REJECTED';
  const rejectWhy = row.adminNotes?.trim() ?? '';
  const canReview = paymentDate.trim().length > 0 && paymentReference.trim().length > 0;

  async function save() {
    if (!row || !canReview) return;
    setBusy(true);
    setError(null);
    try {
      await updateHubPaymentSubmission(token, row.submissionId, {
        paymentDate,
        paymentReference: paymentReference.trim(),
        hubNotes: hubNotes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update payment');
      setStep('form');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'confirm') {
    return (
      <HubPaymentConfirmDialog
        open
        title={rejected ? 'Submit corrected payment?' : 'Submit these details?'}
        hint={
          rejected
            ? 'KoyaKart will review again. After Submit you cannot edit unless they reject it.'
            : 'After Submit you cannot edit UTR, date, or note. Amount stays locked to the bill.'
        }
        amount={row.totalAmount}
        paymentDate={paymentDate}
        paymentReference={paymentReference.trim()}
        notes={hubNotes}
        confirmLabel="Submit"
        busy={busy}
        error={error}
        onConfirm={() => void save()}
        onBack={() => {
          if (!busy) setStep('form');
        }}
      />
    );
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
        aria-label={rejected ? 'Correct rejected payment' : 'Edit pending payment'}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h2 style={styles.title}>{rejected ? 'Correct and resubmit' : 'Edit pending payment'}</h2>
          <p style={styles.amt}>{money(row.totalAmount)}</p>
        </div>
        {rejected && rejectWhy ? <p style={styles.reject}>Rejected: {rejectWhy}</p> : null}
        <p style={styles.hint}>
          {rejected
            ? 'Fix UTR, date, or note, then Save and Submit for KoyaKart to confirm again.'
            : 'Edit UTR, date, or note, then Save and Submit. Amount is locked to the bill.'}
        </p>
        <div style={styles.row2}>
          <label style={styles.field}>
            Paid date
            <HubDateInput value={paymentDate} onChange={setPaymentDate} />
          </label>
          <label style={styles.field}>
            UTR / ref
            <input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              maxLength={120}
              style={styles.input}
            />
          </label>
        </div>
        <label style={styles.field}>
          Note
          <textarea
            value={hubNotes}
            onChange={(e) => setHubNotes(e.target.value)}
            rows={3}
            style={styles.textarea}
          />
        </label>
        {error ? <p style={styles.error}>{error}</p> : null}
        <div style={styles.actions}>
          <button type="button" style={styles.backBtn} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={styles.yesBtn}
            disabled={!canReview || busy}
            onClick={() => {
              setError(null);
              setStep('confirm');
            }}
          >
            Save
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
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
    background: 'rgba(12, 18, 24, 0.55)',
  },
  dialog: {
    width: 'min(34rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-elevated)',
    padding: '0.85rem',
    display: 'grid',
    gap: '0.4rem',
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  amt: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  hint: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  reject: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 750,
    color: 'var(--danger)',
    lineHeight: 1.35,
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    background: 'var(--danger-soft, #fee2e2)',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(13.25rem, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  field: { display: 'grid', gap: '0.18rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    padding: '0.4rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    minHeight: 40,
  },
  textarea: {
    padding: '0.4rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 64,
    lineHeight: 1.35,
  },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 700 },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.4rem' },
  backBtn: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    minHeight: 44,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 750,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  yesBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    minHeight: 44,
    background: '#059669',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
