import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import {
  fetchHubPaymentRequests,
  submitHubPaymentRequest,
  type HubPaymentRequest,
} from '../api/hubPaymentRequestApi';
import { fetchHubPaymentSubmissions, type HubPaymentSubmission } from '../api/hubPaymentApi';
import { formatIsoDateRange } from '../lib/codFormat';
import { HubDateInput } from './HubDateInput';
import { HubPaymentConfirmDialog } from './HubPaymentConfirmDialog';
import { HubPendingPaymentEditDialog } from './HubPendingPaymentEditDialog';

type Props = {
  token: string;
  kind: 'COD' | 'FRANCHISE';
  onSubmitted: () => void;
};

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function mergeNotesPreview(method: string, bankName: string, notes: string): string {
  const parts = [method.trim(), method === 'BANK' ? bankName.trim() : '', notes.trim()].filter(Boolean);
  return parts.join(' · ');
}

export function HubPaymentRequestsPanel({ token, kind, onSubmitted }: Props) {
  const [rows, setRows] = useState<HubPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(todayIso);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [bankName, setBankName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [hubNotes, setHubNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<HubPaymentSubmission | null>(null);
  const [editableIds, setEditableIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchHubPaymentRequests(token, kind);
      setRows(list);
      const open = list.find((r) => r.status === 'ISSUED');
      setSelectedId((prev) => prev ?? open?.requestId ?? null);
      try {
        const subs = await fetchHubPaymentSubmissions(token);
        setEditableIds(new Set(subs.filter((s) => s.editable !== false && s.status === 'PENDING_VERIFICATION').map((s) => s.submissionId)));
      } catch {
        setEditableIds(new Set());
      }
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load bills');
    } finally {
      setLoading(false);
    }
  }, [token, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.requestId === selectedId) ?? null,
    [rows, selectedId],
  );

  const openRows = rows.filter((r) => r.status === 'ISSUED' || r.status === 'PAYMENT_PENDING');
  const canSubmit =
    selected?.status === 'ISSUED' &&
    paymentReference.trim() &&
    (paymentMethod !== 'BANK' || bankName.trim());

  async function confirmSubmit() {
    if (!selected || !canSubmit) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await submitHubPaymentRequest(token, selected.requestId, {
        paymentDate,
        paymentReference: paymentReference.trim(),
        paymentMethod,
        bankName: paymentMethod === 'BANK' ? bankName.trim() : undefined,
        hubNotes: hubNotes.trim() || undefined,
        totalAmount: Number(selected.totalAmount),
      });
      setConfirmOpen(false);
      setNotice('Submitted. This payment can no longer be edited.');
      setPaymentReference('');
      setHubNotes('');
      onSubmitted();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not submit payment');
    } finally {
      setBusy(false);
    }
  }

  async function openPendingEdit() {
    if (!selected?.submissionId) return;
    setBusy(true);
    setError(null);
    try {
      const list = await fetchHubPaymentSubmissions(token);
      const found = list.find((s) => s.submissionId === selected.submissionId) ?? null;
      if (!found || found.editable === false) {
        setError('This payment is already submitted and cannot be edited.');
        return;
      }
      setEditing(found);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load payment details');
    } finally {
      setBusy(false);
    }
  }

  const title = kind === 'COD' ? 'COD to KoyaKart' : 'Franchise to KoyaKart';

  if (loading && rows.length === 0) {
    return <p style={styles.muted}>Loading {title} bills…</p>;
  }

  return (
    <div style={styles.root}>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.muted}>
        {kind === 'COD'
          ? 'Pay only against a KoyaKart COD statement (order list + total).'
          : 'Pay franchise for the calendar month on the bill — including past months if still due.'}
      </p>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      {openRows.length === 0 ? (
        <p style={styles.muted}>No open bills. KoyaKart Accounts will issue a statement when payment is due.</p>
      ) : (
        <div style={styles.openList}>
          {openRows.map((r) => (
            <button
              key={r.requestId}
              type="button"
              style={r.requestId === selectedId ? styles.billOn : styles.billOff}
              onClick={() => setSelectedId(r.requestId)}
            >
              <span style={styles.billRef}>{r.documentRef}</span>
              <strong>{money(r.totalAmount)}</strong>
              <span style={styles.billMeta}>
                {formatIsoDateRange(r.periodStart, r.periodEnd)}
                {' · '}
                {r.statusLabel}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected?.status === 'PAYMENT_PENDING' ? (
        <div style={styles.pendingCard}>
          <strong>{money(selected.totalAmount)}</strong>
          <p style={styles.mutedSmall}>Payment approval pending — KoyaKart is checking your bank transfer.</p>
          {selected.submissionId && editableIds.has(selected.submissionId) ? (
            <button type="button" style={styles.editBtn} disabled={busy} onClick={() => void openPendingEdit()}>
              {busy ? 'Loading…' : 'Edit'}
            </button>
          ) : null}
        </div>
      ) : null}

      {selected?.status === 'ISSUED' ? (
        <div style={styles.form}>
          <p style={styles.dueLine}>
            Pay <strong>{money(selected.totalAmount)}</strong> offline, then record details below.
          </p>
          {kind === 'FRANCHISE' && selected.franchiseLabel ? (
            <p style={styles.mutedSmall}>{selected.franchiseLabel}</p>
          ) : null}
          {kind === 'COD' && selected.codLines.length > 0 ? (
            <ul style={styles.orderList}>
              {selected.codLines.slice(0, 12).map((l) => (
                <li key={l.orderId}>
                  <span>{l.orderNumber ?? l.orderId.slice(0, 8)}</span>
                  <span>{money(l.amount)}</span>
                </li>
              ))}
              {selected.codLines.length > 12 ? (
                <li style={styles.mutedSmall}>+ {selected.codLines.length - 12} more orders on this bill</li>
              ) : null}
            </ul>
          ) : null}

          <div style={styles.row2}>
            <label style={styles.field}>
              Method
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={styles.input}
              >
                <option value="UPI">UPI</option>
                <option value="GPAY">GPay</option>
                <option value="BANK">Bank transfer</option>
              </select>
            </label>
            <label style={styles.field}>
              Payment date
              <HubDateInput value={paymentDate} onChange={setPaymentDate} />
            </label>
          </div>
          {paymentMethod === 'BANK' ? (
            <label style={styles.field}>
              Bank name
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} style={styles.input} />
            </label>
          ) : null}
          <label style={styles.field}>
            UTR / reference
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            Notes (optional)
            <input value={hubNotes} onChange={(e) => setHubNotes(e.target.value)} style={styles.input} />
          </label>
          <button
            type="button"
            style={styles.primaryBtn}
            disabled={!canSubmit || busy}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            Save
          </button>
        </div>
      ) : null}

      {rows.some((r) => r.status === 'APPROVED') ? (
        <>
          <p style={styles.subHead}>Paid bills</p>
          <ul style={styles.history}>
            {rows
              .filter((r) => r.status === 'APPROVED')
              .slice(0, 5)
              .map((r) => (
                <li key={r.requestId}>
                  {r.documentRef} · {money(r.totalAmount)} · {formatIsoDateRange(r.periodStart, r.periodEnd)}
                </li>
              ))}
          </ul>
        </>
      ) : null}

      <HubPaymentConfirmDialog
        open={confirmOpen && selected?.status === 'ISSUED'}
        title="Submit payment?"
        hint="After Submit you cannot edit UTR, date, or note. KoyaKart still verifies the credit."
        amount={Number(selected?.totalAmount ?? 0)}
        paymentDate={paymentDate}
        paymentReference={paymentReference.trim()}
        notes={mergeNotesPreview(paymentMethod, bankName, hubNotes)}
        confirmLabel="Submit"
        busy={busy}
        error={error}
        onConfirm={() => void confirmSubmit()}
        onBack={() => {
          if (!busy) setConfirmOpen(false);
        }}
      />

      <HubPendingPaymentEditDialog
        open={editing != null}
        token={token}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setNotice('Submitted. This payment can no longer be edited.');
          onSubmitted();
          void load();
        }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.45rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  mutedSmall: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.82rem' },
  notice: { margin: 0, color: '#166534', fontSize: '0.82rem', fontWeight: 600 },
  openList: { display: 'grid', gap: '0.35rem' },
  billOn: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.15rem',
    padding: '0.5rem 0.6rem',
    borderRadius: 10,
    border: '2px solid #059669',
    background: '#ecfdf5',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  billOff: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.15rem',
    padding: '0.5rem 0.6rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  billRef: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  billMeta: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  pendingCard: {
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    display: 'grid',
    gap: '0.35rem',
    justifyItems: 'start',
  },
  editBtn: {
    padding: '0.35rem 0.65rem',
    minHeight: 40,
    borderRadius: 8,
    border: '1px solid #f59e0b',
    background: '#fff',
    color: '#92400e',
    fontWeight: 750,
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  form: { display: 'grid', gap: '0.4rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)' },
  dueLine: { margin: 0, fontSize: '0.88rem' },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(13.25rem, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 600 },
  input: {
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    justifySelf: 'start',
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    border: 'none',
    background: '#059669',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  orderList: {
    margin: 0,
    padding: '0 0 0 1rem',
    fontSize: '0.78rem',
    maxHeight: 140,
    overflow: 'auto',
    display: 'grid',
    gap: '0.15rem',
  },
  subHead: { margin: '0.35rem 0 0', fontSize: '0.78rem', fontWeight: 700 },
  history: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' },
};
