import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Card, ConfirmDialog } from '@/shared/ui';
import { getPlatformSettings, type PlatformSettingsVm } from '@/features/settings/api/settingsApi';
import type { TownVm } from '@/features/towns/api/townsApi';
import type { VendorVm } from '@/features/vendors/api/vendorsApi';
import {
  collectSubscriptionBill,
  confirmSubscriptionPayment,
  correctSubscriptionPayment,
  formatMoney,
  listSubscriptionBills,
  rejectSubscriptionPayment,
  sendSubscriptionBill,
  type SubscriptionBill,
} from '../api/settlementsApi';
import { openSubscriptionBill, subscriptionBillHtml } from '../subscriptionBill';

type Props = {
  token: string;
  townId: string;
  vendorId: string;
  vendorName?: string;
  vendor?: VendorVm | null;
  town?: TownVm | null;
  payoutMethod: string;
  transactionReference: string;
  transactionNotes: string;
  onCollected: (message: string) => void;
  onError: (message: string) => void;
  onDueCount?: (count: number) => void;
};

type PendingAction = { kind: 'send' | 'confirm' | 'reject' | 'record'; bill: SubscriptionBill };

type EditDraft = {
  bill: SubscriptionBill;
  bankPaidOn: string;
  payoutMethod: string;
  transactionReference: string;
  transactionNotes: string;
};

const PAY_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function monthShort(ym: string): string {
  const [y, m] = ym.split('-');
  const name = MONTHS[Number(m) - 1];
  return name && y ? `${name} ${y.slice(2)}` : ym;
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" strokeLinejoin="round" />
    </svg>
  );
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dayLabel(isoDay?: string | null): string {
  if (!isoDay) return '—';
  const d = new Date(`${isoDay.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? isoDay
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function istDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

const STATUS_LABEL: Record<string, string> = {
  NOT_SENT: 'Due',
  SENT: 'Sent',
  PAYMENT_SUBMITTED: 'To confirm',
  REJECTED: 'Rejected',
  PAID: 'Received',
};

/** Monthly subscription: admin sends bill → vendor pays and submits ref → admin confirms. */
export function SubscriptionBillsPanel({
  token,
  townId,
  vendorId,
  vendorName,
  vendor,
  town,
  payoutMethod,
  transactionReference,
  transactionNotes,
  onCollected,
  onError,
  onDueCount,
}: Props) {
  const [bills, setBills] = useState<SubscriptionBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const settingsRef = useRef<PlatformSettingsVm | null>(null);
  const callbacks = useRef({ onDueCount, onError });
  callbacks.current = { onDueCount, onError };

  const load = useCallback(async () => {
    if (!token || !vendorId) return;
    setLoading(true);
    try {
      const list = await listSubscriptionBills(token, vendorId);
      setBills(list);
      callbacks.current.onDueCount?.(list.filter((b) => b.status !== 'PAID').length);
    } catch (err) {
      callbacks.current.onError(err instanceof Error ? err.message : 'Could not load subscription bills');
    } finally {
      setLoading(false);
    }
  }, [token, vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const due = bills.filter((b) => b.status !== 'PAID');
  const dueTotal = due.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
  const toConfirm = bills.filter((b) => b.status === 'PAYMENT_SUBMITTED').length;
  const txnReady = transactionReference.trim().length > 0;
  const shopName = vendor?.shopName || vendor?.businessName || vendorName || 'vendor';

  async function openBill(b: SubscriptionBill) {
    setBilling(b.month);
    try {
      if (!settingsRef.current) {
        settingsRef.current = await getPlatformSettings(token).catch(() => null);
      }
      openSubscriptionBill(
        subscriptionBillHtml(b, vendor, town, settingsRef.current),
        `KoyaKart-subscription-${shopName.replace(/[^A-Za-z0-9]+/g, '-')}-${b.month}.html`,
      );
    } finally {
      setBilling(null);
    }
  }

  async function runPending() {
    if (!pending) return;
    const { kind, bill } = pending;
    setSaving(true);
    try {
      if (kind === 'send') {
        const sent = await sendSubscriptionBill(token, { townId, vendorId, vendorName, month: bill.month });
        onCollected(`Bill ${sent.invoiceNumber ?? ''} sent to ${shopName} for ${monthLabel(bill.month)} · ${formatMoney(sent.amount)}`);
      } else if (kind === 'reject' && bill.settlementId) {
        await rejectSubscriptionPayment(token, bill.settlementId, (rejectNotes[bill.month] ?? '').trim());
        setRejectNotes((m) => ({ ...m, [bill.month]: '' }));
        onCollected(`Payment for ${monthLabel(bill.month)} rejected · ${shopName} can pay and resubmit`);
      } else if (kind === 'confirm' && bill.settlementId) {
        const done = await confirmSubscriptionPayment(token, bill.settlementId);
        onCollected(
          `Subscription ${monthLabel(bill.month)} confirmed · ${formatMoney(done.amount)} · ${done.payoutMethod} · ref ${done.transactionReference}`,
        );
      } else {
        const saved = await collectSubscriptionBill(token, {
          townId,
          vendorId,
          vendorName,
          month: bill.month,
          payoutMethod,
          transactionReference: transactionReference.trim(),
          transactionNotes: transactionNotes.trim() || undefined,
        });
        onCollected(
          `Subscription ${monthLabel(bill.month)} recorded · ${formatMoney(saved.netAmount)} · ${saved.payoutMethod} · ref ${saved.transactionReference}`,
        );
      }
      setPending(null);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update subscription bill');
      setPending(null);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!edit?.bill.settlementId) return;
    const bankPaidOn = edit.bankPaidOn.trim();
    const transactionReference = edit.transactionReference.trim();
    if (!bankPaidOn || !transactionReference) {
      onError('Bank date and UTR are required');
      return;
    }
    if (bankPaidOn > todayIst()) {
      onError('Bank date cannot be in the future');
      return;
    }
    setSaving(true);
    try {
      const done = await correctSubscriptionPayment(token, edit.bill.settlementId, {
        bankPaidOn,
        payoutMethod: edit.payoutMethod,
        transactionReference,
        transactionNotes: edit.transactionNotes.trim() || undefined,
      });
      onCollected(
        `Bank date for ${monthLabel(done.month)} set to ${dayLabel(done.bankPaidOn)} · ${done.invoiceNumber ?? ''} · ref ${transactionReference}`,
      );
      setEdit(null);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the bank date');
    } finally {
      setSaving(false);
    }
  }

  const dialog: { title: string; description: ReactNode; confirmLabel: string; danger: boolean } | null = pending
    ? pending.kind === 'send'
      ? {
          title: 'Send subscription bill',
          description: `${monthLabel(pending.bill.month)} · ${formatMoney(pending.bill.amount)} to ${shopName}. A KK invoice number is issued now and the vendor sees it on their Payouts page to pay.`,
          confirmLabel: 'Send bill',
          danger: false,
        }
      : pending.kind === 'reject'
        ? {
            title: 'Reject vendor payment?',
            description: `${monthLabel(pending.bill.month)} · ${pending.bill.vendorPaymentMethod ?? '—'} · ref ${pending.bill.vendorPaymentReference ?? '—'}. Reason: "${(rejectNotes[pending.bill.month] ?? '').trim()}". The vendor sees this reason and can pay / resubmit.`,
            confirmLabel: 'Yes, reject',
            danger: true,
          }
        : pending.kind === 'confirm'
          ? {
              title: 'Confirm payment received?',
              description: (
                <div style={styles.dlgBody}>
                  <div style={styles.dlgHero}>
                    <span style={styles.dlgHeroLabel}>{pending.bill.invoiceNumber || monthLabel(pending.bill.month)}</span>
                    <strong style={styles.dlgHeroValue}>{formatMoney(pending.bill.amount)}</strong>
                    <span>{shopName}</span>
                  </div>
                  <div style={styles.dlgRow}>
                    <span>Vendor paid by</span>
                    <strong>
                      {pending.bill.vendorPaymentMethod ?? '—'} · {pending.bill.vendorPaymentReference ?? '—'}
                    </strong>
                  </div>
                  <div style={styles.dlgRow}>
                    <span>Acknowledged</span>
                    <strong>{formatWhen(pending.bill.vendorPaidAt)}</strong>
                  </div>
                  <p style={styles.dlgNote}>Check the money reached KoyaKart&apos;s account before confirming.</p>
                </div>
              ),
              confirmLabel: 'Yes, received',
              danger: false,
            }
          : {
              title: 'Record payment directly',
              description: `${monthLabel(pending.bill.month)} · ${formatMoney(pending.bill.amount)} · ${payoutMethod} · ref ${transactionReference.trim()}. Use this when the vendor paid you outside the portal.`,
              confirmLabel: 'Record received',
              danger: false,
            }
    : null;

  return (
    <Card padding="sm" style={styles.card}>
      <div style={styles.head}>
        <div style={styles.headText}>
          <p style={styles.title}>Monthly subscription bills</p>
          <p style={styles.muted}>
            Send the bill → vendor pays and enters the UTR in their portal → you confirm. Separate from order commission
            and payouts.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      <div style={styles.hero}>
        <span style={styles.label}>Outstanding</span>
        <strong style={styles.amount}>{formatMoney(dueTotal)}</strong>
        <span style={styles.muted}>
          {due.length} month{due.length === 1 ? '' : 's'} unpaid
          {toConfirm > 0 ? ` · ${toConfirm} waiting for your confirmation` : ''}
        </span>
      </div>

      {loading && bills.length === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : bills.length === 0 ? (
        <p style={styles.muted}>No monthly subscription on this vendor&apos;s terms in the last 12 months.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Month</th>
                <th style={styles.thNum}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Payment</th>
                <th style={styles.th}>Bank</th>
                <th style={styles.th}>Ack</th>
                <th style={styles.th}>Bill</th>
                <th style={styles.th}>Confirm</th>
                <th style={styles.th}>Reject</th>
                <th style={styles.thIcon} aria-label="Edit" />
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const s = b.status;
                const reason = (rejectNotes[b.month] ?? '').trim();
                const payment =
                  s === 'PAID'
                    ? [b.payoutMethod, b.transactionReference].filter(Boolean).join(' · ') || '—'
                    : s === 'PAYMENT_SUBMITTED' || s === 'REJECTED'
                      ? [b.vendorPaymentMethod, b.vendorPaymentReference].filter(Boolean).join(' · ') || '—'
                      : '—';
                const canEdit = (s === 'PAYMENT_SUBMITTED' || s === 'PAID') && !!b.settlementId;
                const ack = canEdit ? formatWhen(b.vendorPaidAt) : '—';
                return (
                  <tr key={b.month}>
                    <td style={styles.tdStrong} title={monthLabel(b.month)}>
                      {monthShort(b.month)}
                    </td>
                    <td style={styles.tdNum}>{formatMoney(b.amount)}</td>
                    <td style={styles.td}>
                      <span
                        style={
                          s === 'PAID'
                            ? styles.paid
                            : s === 'PAYMENT_SUBMITTED'
                              ? styles.submitted
                              : s === 'REJECTED'
                                ? styles.rejected
                                : styles.due
                        }
                      >
                        {STATUS_LABEL[s] ?? s}
                      </span>
                    </td>
                    <td style={styles.td}>{b.invoiceNumber ?? '—'}</td>
                    <td style={s === 'REJECTED' ? { ...styles.td, ...styles.struck } : styles.td} title={b.vendorPaymentNotes || b.rejectReason || undefined}>
                      {payment}
                    </td>
                    <td style={b.bankPaidOn ? styles.td : styles.tdMuted}>{dayLabel(b.bankPaidOn)}</td>
                    <td style={styles.tdMuted}>{ack}</td>
                    <td style={styles.td}>
                      <button type="button" style={styles.cellBtn} disabled={billing === b.month} onClick={() => void openBill(b)}>
                        {billing === b.month ? '…' : s === 'NOT_SENT' ? 'Preview' : 'Bill'}
                      </button>
                    </td>
                    <td style={styles.td}>
                      {s === 'NOT_SENT' ? (
                        <button type="button" style={styles.cellBtnPrimary} disabled={saving} onClick={() => setPending({ kind: 'send', bill: b })}>
                          Send bill
                        </button>
                      ) : s === 'PAYMENT_SUBMITTED' ? (
                        <button
                          type="button"
                          style={styles.cellBtnPrimary}
                          disabled={saving}
                          title="Confirm received"
                          onClick={() => setPending({ kind: 'confirm', bill: b })}
                        >
                          Confirm
                        </button>
                      ) : s === 'SENT' || s === 'REJECTED' ? (
                        <button
                          type="button"
                          style={styles.cellBtn}
                          disabled={!txnReady || saving}
                          title={txnReady ? 'Vendor paid outside the portal' : 'Enter Txn ref at the top first'}
                          onClick={() => setPending({ kind: 'record', bill: b })}
                        >
                          Record paid
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={styles.td}>
                      {s === 'PAYMENT_SUBMITTED' ? (
                        <div style={styles.rejectRow}>
                          <input
                            style={styles.rejectInput}
                            placeholder="Reason"
                            maxLength={500}
                            aria-label={`Reject reason for ${monthLabel(b.month)}`}
                            value={rejectNotes[b.month] ?? ''}
                            onChange={(e) => setRejectNotes((m) => ({ ...m, [b.month]: e.target.value }))}
                          />
                          <button
                            type="button"
                            style={styles.cellBtn}
                            disabled={saving || !reason}
                            title={reason ? undefined : 'Enter a reason first'}
                            onClick={() => setPending({ kind: 'reject', bill: b })}
                          >
                            Reject
                          </button>
                        </div>
                      ) : s === 'REJECTED' ? (
                        <span style={styles.rejectWhy}>{b.rejectReason || '—'}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={styles.td}>
                      {canEdit ? (
                        <button
                          type="button"
                          style={styles.iconBtn}
                          disabled={saving}
                          aria-label={`Edit bank date for ${monthLabel(b.month)}`}
                          title="Edit bank date"
                          onClick={() =>
                            setEdit({
                              bill: b,
                              bankPaidOn: (b.bankPaidOn ?? '').slice(0, 10) || istDay(b.vendorPaidAt) || istDay(b.paidAt),
                              payoutMethod: (s === 'PAID' ? b.payoutMethod : b.vendorPaymentMethod) || 'UPI',
                              transactionReference:
                                (s === 'PAID' ? b.transactionReference : b.vendorPaymentReference) || '',
                              transactionNotes: b.vendorPaymentNotes || '',
                            })
                          }
                        >
                          <EditIcon />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {bills.some((b) => b.status === 'SENT' || b.status === 'REJECTED') && !txnReady ? (
        <p style={styles.hint}>Vendor paid outside the portal? Enter Txn ref at the top to use Record paid.</p>
      ) : null}

      {edit ? (
        <div style={styles.overlay} role="presentation" onClick={() => !saving && setEdit(null)}>
          <form
            style={styles.sheet}
            role="dialog"
            aria-label={`Bank date for ${monthLabel(edit.bill.month)}`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            <div style={styles.sheetHead}>
              <strong>Bank statement · {monthLabel(edit.bill.month)}</strong>
              <span style={styles.muted}>
                Vendor acknowledged {formatWhen(edit.bill.vendorPaidAt)}. Invoice {edit.bill.invoiceNumber || '—'} stays the same.
              </span>
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.field}>
                Bank date
                <input
                  type="date"
                  required
                  max={todayIst()}
                  style={styles.fieldInput}
                  value={edit.bankPaidOn}
                  onChange={(e) => setEdit({ ...edit, bankPaidOn: e.target.value })}
                />
              </label>
              <label style={styles.field}>
                Mode
                <select
                  style={styles.fieldInput}
                  value={edit.payoutMethod}
                  onChange={(e) => setEdit({ ...edit, payoutMethod: e.target.value })}
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...styles.field, flex: '1 1 8rem' }}>
                UTR
                <input
                  required
                  maxLength={128}
                  style={styles.fieldInput}
                  value={edit.transactionReference}
                  onChange={(e) => setEdit({ ...edit, transactionReference: e.target.value })}
                />
              </label>
            </div>
            <div style={styles.sheetActions}>
              <button type="button" style={styles.dialogBtn} disabled={saving} onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="submit" style={styles.dialogBtnPrimary} disabled={saving}>
                {saving ? 'Saving…' : 'Save bank date'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmLabel={dialog?.confirmLabel ?? 'OK'}
        cancelLabel="Cancel"
        danger={dialog?.danger ?? false}
        busy={saving}
        onConfirm={() => void runPending()}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}

const pill: CSSProperties = { fontSize: '0.68rem', fontWeight: 800, borderRadius: 999, padding: '0.1rem 0.45rem' };

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.5rem', border: '1px solid #c4b5fd', background: 'color-mix(in srgb, #f5f3ff 45%, var(--bg-elevated))' },
  head: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.45rem' },
  headText: { flex: '1 1 12rem', display: 'grid', gap: '0.25rem', minWidth: 0 },
  title: { margin: 0, fontWeight: 900, fontSize: '0.9rem' },
  muted: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  hero: { display: 'grid', gap: '0.12rem' },
  label: { fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  amount: { fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#5b21b6' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' },
  th: {
    textAlign: 'left',
    padding: '0.32rem 0.45rem',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted, var(--bg-elevated))',
    fontWeight: 800,
  },
  thIcon: {
    width: 36,
    padding: '0.32rem 0.3rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted, var(--bg-elevated))',
  },
  thNum: {
    textAlign: 'right',
    padding: '0.32rem 0.45rem',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted, var(--bg-elevated))',
    fontWeight: 800,
  },
  td: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdStrong: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontWeight: 800 },
  tdNum: {
    padding: '0.28rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  tdMuted: { padding: '0.28rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', color: 'var(--text-muted)' },
  iconBtn: {
    width: 28,
    height: 28,
    padding: 0,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  cellBtn: {
    height: 28,
    padding: '0 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  cellBtnPrimary: {
    height: 28,
    padding: '0 0.55rem',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent, #0C831F)',
    color: '#fff',
    font: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  paid: { ...pill, color: '#047857', background: '#d1fae5' },
  due: { ...pill, color: '#9a3412', background: '#ffedd5' },
  submitted: { ...pill, color: '#1d4ed8', background: '#dbeafe' },
  rejected: { ...pill, color: 'var(--danger)', background: 'var(--danger-soft)' },
  struck: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  rejectWhy: { fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 },
  rejectRow: { display: 'flex', gap: '0.3rem', alignItems: 'center' },
  rejectInput: {
    width: '7rem',
    height: 28,
    font: 'inherit',
    fontSize: '0.72rem',
    padding: '0 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 },
  dlgBody: { display: 'grid', gap: '0.3rem' },
  dlgHero: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md, 10px)',
    background: 'color-mix(in srgb, var(--brand, #0C831F) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--brand, #0C831F) 25%, transparent)',
    color: 'var(--text)',
    marginBottom: '0.2rem',
  },
  dlgHeroLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  },
  dlgHeroValue: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand, #0C831F)', lineHeight: 1.15 },
  dlgRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.2rem 0',
    borderBottom: '1px dashed var(--border)',
  },
  dlgNote: { margin: '0.25rem 0 0', fontSize: '0.8rem' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 40,
    padding: '0.75rem',
  },
  sheet: {
    width: 'min(34rem, 100%)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.65rem 0.75rem',
    display: 'grid',
    gap: '0.45rem',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
  },
  sheetHead: { display: 'grid', gap: '0.15rem' },
  fieldRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'end' },
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)' },
  fieldInput: {
    height: 32,
    padding: '0 0.4rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.8rem',
  },
  sheetActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' },
  dialogBtn: {
    height: 44,
    padding: '0 0.85rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  },
  dialogBtnPrimary: {
    height: 44,
    padding: '0 0.85rem',
    borderRadius: 8,
    border: '1px solid #0C831F',
    background: '#0C831F',
    color: '#fff',
    font: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
