import { useEffect, useId, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ApiError } from '@/shared/api/http';
import { Button } from '@/shared/ui';
import { createSettlement, formatMoney } from '@/features/settlements/api/settlementsApi';
import { settlementsVendorCollectUrl } from '@/features/dues/accountsDeepLinks';
import type { AdminCancellationRow } from '../api/cancellationsApi';
import { penaltyPeriodForRow, penaltyReasonForRow, suggestedPenaltyAmount } from '../lib/penaltyDraft';

type PenaltyMode = 'bill' | 'paid';

type Props = {
  open: boolean;
  row: AdminCancellationRow | null;
  token: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function VendorPenaltyDialog({ open, row, token, onClose, onSuccess }: Props) {
  const titleId = useId();
  const [mode, setMode] = useState<PenaltyMode>('bill');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('UPI');
  const [transactionReference, setTransactionReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setMode('bill');
    setAmount(String(suggestedPenaltyAmount(row) || ''));
    setReason(penaltyReasonForRow(row));
    setPayoutMethod('UPI');
    setTransactionReference('');
    setError(null);
    setBusy(false);
  }, [open, row]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open || !row?.vendorId || row.vendorPenaltySent) return null;

  const amountNum = roundMoney(Math.max(0, Number(amount || 0)));
  const canSubmit =
    amountNum > 0 &&
    reason.trim().length > 0 &&
    (mode === 'bill' || transactionReference.trim().length > 0);

  async function submit() {
    if (!token || !row?.vendorId || !canSubmit) return;
    setBusy(true);
    setError(null);
    const { periodStart, periodEnd } = penaltyPeriodForRow(row);
    try {
      const created = await createSettlement(token, {
        townId: row.townId,
        vendorId: row.vendorId,
        vendorName: row.counterpartyName ?? undefined,
        periodStart,
        periodEnd,
        periodType: 'CUSTOM',
        direction: 'COLLECTION',
        subOrderIds: [],
        otherChargesAmount: amountNum,
        otherChargesReason: reason.trim(),
        cancellationPenaltyOrderId: row.orderId,
        markPaid: mode === 'paid',
        sendBill: mode === 'bill',
        payoutMethod: mode === 'paid' ? payoutMethod : undefined,
        transactionReference: mode === 'paid' ? transactionReference.trim() : undefined,
        transactionNotes:
          mode === 'paid'
            ? `Cancellation penalty · order ${row.orderNumber}`
            : undefined,
      });
      const shop = row.counterpartyName ?? 'Vendor';
      if (mode === 'bill') {
        onSuccess(
          `Bill ${created.serviceInvoiceNumber ?? ''} for ${formatMoney(created.netAmount)} sent to ${shop}. ` +
            'It appears under Town dues → Collect and in Settlements records; vendor sees it in Payouts.',
        );
      } else {
        onSuccess(
          `Recorded ${formatMoney(created.netAmount)} penalty from ${shop} · ${created.payoutMethod} · ref ${transactionReference.trim()}. ` +
            'Logged in audit, company ledger, and vendor payout history.',
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to apply penalty');
    } finally {
      setBusy(false);
    }
  }

  const settlementsUrl = settlementsVendorCollectUrl({
    townId: row.townId,
    vendorId: row.vendorId,
    paysSubTab: 'records',
  });

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
        <h2 id={titleId} style={styles.title}>
          Vendor penalty
        </h2>
        <p style={styles.meta}>
          {row.counterpartyName ?? 'Vendor'} · {row.orderNumber} · lost {formatMoney(row.cancelledAmount)}
        </p>
        <p style={styles.hint}>
          Posts a vendor collection (OTHER_CHARGE) — same rails as Settlements. Every rupee is billed or recorded with
          audit.
        </p>

        <div style={styles.modeRow} role="group" aria-label="How to collect">
          <button
            type="button"
            className={mode === 'bill' ? 'vpen-chip on' : 'vpen-chip'}
            disabled={busy}
            onClick={() => setMode('bill')}
          >
            Send bill
          </button>
          <button
            type="button"
            className={mode === 'paid' ? 'vpen-chip on' : 'vpen-chip'}
            disabled={busy}
            onClick={() => setMode('paid')}
          >
            Already paid
          </button>
        </div>

        <div style={styles.grid2}>
          <label style={styles.label}>
            Amount (₹)
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {mode === 'paid' ? (
            <label style={styles.label}>
              Method
              <select
                style={styles.input}
                value={payoutMethod}
                disabled={busy}
                onChange={(e) => setPayoutMethod(e.target.value)}
              >
                <option value="UPI">UPI</option>
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
          ) : (
            <span />
          )}
        </div>

        <label style={styles.label}>
          Reason (required)
          <input
            style={styles.input}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shown on bill, payouts, and audit"
          />
        </label>

        {mode === 'paid' ? (
          <label style={styles.label}>
            Txn ref (UTR / UPI id)
            <input
              style={styles.input}
              value={transactionReference}
              disabled={busy}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="Required when marking received"
            />
          </label>
        ) : null}

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.footerLinks}>
          <Link to={settlementsUrl} style={styles.link}>
            Open settlements
          </Link>
        </div>

        <div style={styles.actions}>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={busy || !canSubmit} onClick={() => void submit()}>
            {busy ? 'Saving…' : mode === 'bill' ? 'Send penalty bill' : 'Record penalty'}
          </Button>
        </div>
      </div>
      <style>{CHIP_CSS}</style>
    </div>,
    document.body,
  );
}

const CHIP_CSS = `
.vpen-chip {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 999px;
  min-height: 2rem;
  padding: 0.2rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
.vpen-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
}
.vpen-chip:disabled { opacity: 0.6; cursor: wait; }
`;

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1300,
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
    borderTop: '4px solid var(--brand, #009111)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1rem 1.05rem',
    display: 'grid',
    gap: '0.45rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.1rem',
  },
  meta: { margin: 0, fontSize: '0.82rem', fontWeight: 700 },
  hint: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  modeRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
    gap: '0.45rem',
    alignItems: 'end',
  },
  label: {
    display: 'grid',
    gap: '0.15rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '2.5rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.86rem',
    fontWeight: 650,
  },
  error: { margin: 0, color: 'var(--danger, #dc2626)', fontSize: '0.82rem', fontWeight: 650 },
  footerLinks: { fontSize: '0.76rem' },
  link: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', marginTop: '0.15rem' },
};