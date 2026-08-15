import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';
import {
  FEE_MODEL_OPTIONS,
  quoteVendorCommercialTerms,
  type CommercialTermsQuote,
} from '@/features/vendors/api/commercialTermsApi';
import {
  createSettlement,
  fetchSettlementCandidates,
  formatMoney,
  listSettlements,
  settlementClaimAmount,
  settlementOtherChargesAmount,
  type PendingSettlementClaim,
  type SettlementCandidate,
  type SettlementVm,
} from '../api/settlementsApi';

type PeriodPreset = 'day' | 'week' | 'month' | 'custom';

const IST = 'Asia/Kolkata';

/** Calendar YYYY-MM-DD in Asia/Kolkata — matches Billing / settlement day bounds. */
function isoDateInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function placedDateInIst(placedAt?: string | null): string | null {
  if (!placedAt) return null;
  return isoDateInIst(new Date(placedAt));
}

function isPlacedInRange(placedAt: string | null | undefined, from: string, to: string): boolean {
  const day = placedDateInIst(placedAt);
  if (!day) return false;
  return day >= from && day <= to;
}

function rangeForPreset(preset: PeriodPreset): { from: string; to: string; periodType: 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM' } {
  const to = isoDateInIst();
  if (preset === 'day') return { from: to, to, periodType: 'DAY' };
  if (preset === 'week') {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: isoDateInIst(from), to, periodType: 'WEEK' };
  }
  if (preset === 'month') {
    const [y, m] = to.split('-');
    return { from: `${y}-${m}-01`, to, periodType: 'MONTH' };
  }
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: isoDateInIst(from), to, periodType: 'CUSTOM' };
}

const PAYOUT_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'];

function feeModelLabel(model?: string | null): string {
  return FEE_MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model ?? 'Billing';
}

export function SettlementsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const initial = rangeForPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [periodType, setPeriodType] = useState<'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>(initial.periodType);
  const [candidates, setCandidates] = useState<SettlementCandidate[]>([]);
  const [pendingClaimChargebacks, setPendingClaimChargebacks] = useState(0);
  const [pendingClaims, setPendingClaims] = useState<PendingSettlementClaim[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<SettlementVm[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState('UPI');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');
  const [otherChargesAmount, setOtherChargesAmount] = useState('');
  const [otherChargesReason, setOtherChargesReason] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('0');
  const [feeQuote, setFeeQuote] = useState<CommercialTermsQuote | null>(null);
  const [feeQuoteError, setFeeQuoteError] = useState<string | null>(null);
  const [feeQuoteLoading, setFeeQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmPayOpen, setConfirmPayOpen] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const openCandidates = useMemo(
    () => candidates.filter((c) => !c.alreadySettled),
    [candidates],
  );

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const c of candidates) {
      if (selected.has(c.subOrderId)) sum += Number(c.subtotal ?? 0);
    }
    return sum;
  }, [candidates, selected]);

  const commissionNum = Number(commissionAmount || 0);
  const otherChargesNum = Math.max(0, Number(otherChargesAmount || 0));
  const expectedNet = Math.max(
    0,
    selectedTotal - commissionNum - pendingClaimChargebacks - otherChargesNum,
  );

  useEffect(() => {
    if (!token || !vendorId || selected.size === 0) {
      setFeeQuote(null);
      setFeeQuoteError(null);
      setFeeQuoteLoading(false);
      setCommissionAmount('0');
      return;
    }
    let cancelled = false;
    void (async () => {
      setFeeQuoteLoading(true);
      setFeeQuoteError(null);
      try {
        const orderLines = candidates
          .filter((c) => selected.has(c.subOrderId))
          .map((c) => ({
            amount: Number(c.subtotal ?? 0),
            placedAt: c.placedAt ?? undefined,
          }));
        const quote = await quoteVendorCommercialTerms(token, vendorId, {
          grossAmount: selectedTotal,
          orderCount: selected.size,
          periodStart: from,
          periodEnd: to,
          markSubscriptionCharged: false,
          orderLines,
        });
        if (cancelled) return;
        setFeeQuote(quote);
        setCommissionAmount(String(Number(quote.totalFeeAmount ?? 0)));
      } catch (err) {
        if (!cancelled) {
          setFeeQuote(null);
          setCommissionAmount('0');
          setFeeQuoteError(
            err instanceof ApiError || err instanceof Error
              ? err.message
              : 'Could not load billing fees for this payout',
          );
        }
      } finally {
        if (!cancelled) setFeeQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, vendorId, selectedTotal, selected, candidates, from, to]);

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    const range = rangeForPreset(next);
    setFrom(range.from);
    setTo(range.to);
    setPeriodType(range.periodType);
  };

  const reloadMeta = useCallback(async () => {
    if (!token) return;
    const townList = await listTowns(token);
    setTowns(townList);
  }, [token]);

  const reloadCandidates = useCallback(async () => {
    if (!token || !townId || !vendorId) {
      setCandidates([]);
      setPendingClaimChargebacks(0);
      setPendingClaims([]);
      setSelected(new Set());
      return;
    }
    const data = await fetchSettlementCandidates(token, { townId, vendorId, from, to });
    // Strict placed-date filter (IST calendar day) so UI matches the From/To pickers.
    const items = (data.items ?? []).filter((i) => isPlacedInRange(i.placedAt, from, to));
    setCandidates(items);
    setPendingClaimChargebacks(Number(data.pendingClaimChargebacks ?? 0));
    setPendingClaims(data.pendingClaims ?? []);
    setSelected(new Set(items.filter((i) => !i.alreadySettled).map((i) => i.subOrderId)));
  }, [token, townId, vendorId, from, to]);

  const reloadHistory = useCallback(async () => {
    if (!token) return;
    const items = await listSettlements(token, {
      townId: townId || undefined,
      payeeId: vendorId || undefined,
    });
    // Show payouts whose settlement period overlaps the selected From/To range.
    const inRange = items.filter((s) => {
      const start = s.periodStart ?? '';
      const end = s.periodEnd ?? '';
      if (!start || !end) return true;
      return start <= to && end >= from;
    });
    setHistory(inRange);
  }, [token, townId, vendorId, from, to]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await reloadMeta();
      const vendorList = townId ? await listVendors(token, townId) : [];
      setVendors(vendorList);
      if (vendorId && !vendorList.some((v) => v.id === vendorId)) {
        setVendorId('');
      }
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [token, townId, vendorId, reloadMeta, reloadCandidates, reloadHistory]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function toggleAllOpen(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(openCandidates.map((c) => c.subOrderId)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submitPayout() {
    if (!token || !townId || !vendorId || selected.size === 0) return;
    const txnRef = transactionReference.trim();
    if (!txnRef) {
      setError('Txn ref is required (UTR / UPI / cheque number)');
      setConfirmPayOpen(false);
      return;
    }
    if (feeQuoteLoading) {
      setError('Wait for billing fees to finish calculating');
      setConfirmPayOpen(false);
      return;
    }
    if (feeQuoteError || !feeQuote) {
      setError(feeQuoteError || 'Billing fees are required before payout. Refresh and try again.');
      setConfirmPayOpen(false);
      return;
    }
    if (otherChargesNum > 0 && !otherChargesReason.trim()) {
      setError('Add a reason for the penalty / other charge');
      setConfirmPayOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // commissionAmount is ignored server-side; payment-service re-quotes Billing and enforces it.
      const created = await createSettlement(token, {
        townId,
        vendorId,
        vendorName: selectedVendor?.shopName || selectedVendor?.businessName,
        periodStart: from,
        periodEnd: to,
        periodType,
        subOrderIds: Array.from(selected),
        commissionAmount: Number(commissionAmount || 0),
        markPaid: true,
        payoutMethod,
        transactionReference: txnRef,
        transactionNotes: transactionNotes.trim() || undefined,
        otherChargesAmount: otherChargesNum > 0 ? otherChargesNum : undefined,
        otherChargesReason: otherChargesNum > 0 ? otherChargesReason.trim() : undefined,
      });
      const claimsTaken = settlementClaimAmount(created);
      const otherTaken = settlementOtherChargesAmount(created);
      const parts = [
        `gross ${formatMoney(created.grossAmount)}`,
        `fees ${formatMoney(created.commissionAmount)}`,
      ];
      if (claimsTaken > 0) parts.push(`claims ${formatMoney(claimsTaken)}`);
      if (otherTaken > 0) parts.push(`other ${formatMoney(otherTaken)}`);
      setSuccess(
        `Paid ${formatMoney(created.netAmount)} (${parts.join(' − ')}) to ${created.payeeName ?? 'vendor'} · ${created.payoutMethod} · ref ${txnRef}`,
      );
      setTransactionReference('');
      setTransactionNotes('');
      setOtherChargesAmount('');
      setOtherChargesReason('');
      setConfirmPayOpen(false);
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  }

  function requestMarkPaid() {
    if (!transactionReference.trim()) {
      setError('Txn ref is required (UTR / UPI / cheque number)');
      return;
    }
    if (otherChargesNum > 0 && !otherChargesReason.trim()) {
      setError('Add a reason for the penalty / other charge');
      return;
    }
    setError(null);
    setConfirmPayOpen(true);
  }

  const canPay =
    !saving &&
    selected.size > 0 &&
    !!townId &&
    !!vendorId &&
    !feeQuoteLoading &&
    !feeQuoteError &&
    !!feeQuote &&
    transactionReference.trim().length > 0;

  const showSummary = !!townId && !!vendorId && (selected.size > 0 || pendingClaimChargebacks > 0);

  return (
    <PortalShell title="Vendor payouts" onRefresh={() => void reload()}>
      <style>{layoutCss}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {success ? <Banner tone="success">{success}</Banner> : null}

      <div className="sp-layout">
        <div className="sp-main">
          <Card padding="sm" style={styles.cardPad}>
            <div style={styles.toolbar}>
              <div style={styles.presets}>
                {(
                  [
                    ['day', 'Today'],
                    ['week', 'This week'],
                    ['month', 'This month'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    style={preset === id ? styles.presetActive : styles.preset}
                    onClick={() => applyPreset(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-filters">
              <label style={styles.label}>
                Town
                <select
                  style={styles.input}
                  value={townId}
                  onChange={(e) => {
                    setTownId(e.target.value);
                    setVendorId('');
                  }}
                >
                  <option value="">Select town</option>
                  {towns.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                Vendor
                <select
                  style={styles.input}
                  value={vendorId}
                  disabled={!townId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.shopName || v.businessName} ({v.phone})
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                From
                <input
                  style={styles.input}
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPreset('custom');
                    setPeriodType('CUSTOM');
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label style={styles.label}>
                To
                <input
                  style={styles.input}
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPreset('custom');
                    setPeriodType('CUSTOM');
                    setTo(e.target.value);
                  }}
                />
              </label>
              <label style={styles.label}>
                Mode
                <select
                  style={styles.input}
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  {PAYOUT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                Txn ref <span style={styles.req}>*</span>
                <input
                  style={styles.input}
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="UTR / UPI / cheque (required)"
                  required
                />
              </label>
              <label style={styles.label} className="sp-notes">
                Notes
                <input
                  style={styles.input}
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  placeholder="Optional remark"
                />
              </label>
            </div>
          </Card>

          <Card padding="sm" style={styles.cardPad}>
            <div style={styles.tableHead}>
              <h2 style={styles.sectionTitle}>
                Orders{' '}
                <span style={styles.count}>
                  {candidates.length} · {selected.size} selected
                </span>
              </h2>
              <label style={styles.checkInline}>
                <input
                  type="checkbox"
                  checked={openCandidates.length > 0 && selected.size === openCandidates.length}
                  onChange={(e) => toggleAllOpen(e.target.checked)}
                  disabled={openCandidates.length === 0}
                />
                All unsettled
              </label>
            </div>
            {!townId || !vendorId ? (
              <p style={styles.muted}>Select a town and vendor to load orders.</p>
            ) : loading ? (
              <p style={styles.muted}>Loading…</p>
            ) : candidates.length === 0 ? (
              <p style={styles.muted}>No delivered unsettled orders in this range.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th} />
                      <th style={styles.th}>Placed</th>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Buyer pay</th>
                      <th style={styles.thRight}>Amount</th>
                      <th style={styles.th}>Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((row) => (
                      <tr
                        key={row.subOrderId}
                        style={
                          selected.has(row.subOrderId) && !row.alreadySettled
                            ? styles.rowSelected
                            : undefined
                        }
                      >
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            disabled={row.alreadySettled}
                            checked={selected.has(row.subOrderId)}
                            onChange={(e) => toggleOne(row.subOrderId, e.target.checked)}
                          />
                        </td>
                        <td style={styles.tdMuted}>
                          {row.placedAt
                            ? new Date(row.placedAt).toLocaleString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td style={styles.td}>
                          <strong>{row.orderNumber}</strong>
                          <div style={styles.sub}>{row.subOrderNumber}</div>
                        </td>
                        <td style={styles.tdMuted}>{row.status}</td>
                        <td style={styles.tdMuted}>{row.paymentStatus ?? '—'}</td>
                        <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                        <td style={styles.td}>
                          {row.alreadySettled ? (
                            <span style={styles.settled}>Settled</span>
                          ) : (
                            <span style={styles.openBadge}>Open</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <aside className="sp-side">
          <Card padding="sm" elevated style={{ ...styles.cardPad, ...styles.summaryCard }}>
            <h2 style={styles.sectionTitle}>Summary</h2>
            {!showSummary ? (
              <p style={styles.muted}>Select a vendor and orders to see net pay.</p>
            ) : (
              <>
                <div style={styles.netHero}>
                  <span style={styles.netLabel}>Net to vendor</span>
                  <strong style={styles.netValue}>{formatMoney(expectedNet)}</strong>
                </div>

                <div style={styles.mathStack}>
                  <div style={styles.mathRow}>
                    <span>Gross · {selected.size} orders</span>
                    <strong>{formatMoney(selectedTotal)}</strong>
                  </div>
                  <div style={styles.mathRow}>
                    <span>Billing fees</span>
                    <strong>− {formatMoney(commissionNum)}</strong>
                  </div>
                  <div style={styles.mathRow}>
                    <span>Claim deductions</span>
                    <strong style={pendingClaimChargebacks > 0 ? styles.claimAmt : undefined}>
                      − {formatMoney(pendingClaimChargebacks)}
                    </strong>
                  </div>
                  <div style={styles.mathRow}>
                    <span>Penalty / other</span>
                    <strong>− {formatMoney(otherChargesNum)}</strong>
                  </div>
                </div>

                <div style={styles.chargePanel}>
                  <label style={styles.label}>
                    Penalty / other charge (₹)
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={otherChargesAmount}
                      onChange={(e) => setOtherChargesAmount(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label style={styles.label}>
                    Reason
                    <input
                      style={styles.input}
                      value={otherChargesReason}
                      onChange={(e) => setOtherChargesReason(e.target.value)}
                      placeholder="Required if amount > 0"
                      disabled={otherChargesNum <= 0}
                    />
                  </label>
                </div>

                <div style={styles.feePanel}>
                  <div style={styles.feePanelHead}>
                    <span style={styles.feePanelTitle}>Billing</span>
                    {feeQuote ? (
                      <span style={styles.feePill}>{feeModelLabel(feeQuote.feeModel)}</span>
                    ) : null}
                  </div>
                  {feeQuoteLoading ? (
                    <p style={styles.feeHint}>Calculating…</p>
                  ) : feeQuoteError ? (
                    <p style={styles.feeError}>{feeQuoteError}</p>
                  ) : feeQuote?.breakdownLines?.length ? (
                    <ul style={styles.feeList}>
                      {feeQuote.breakdownLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={styles.feeHint}>Select orders to calculate fees.</p>
                  )}
                </div>

                {pendingClaims.length > 0 ? (
                  <ul style={styles.claimList}>
                    {pendingClaims.map((c) => (
                      <li key={c.claimId}>
                        {formatMoney(c.amount)}
                        {c.orderNumber ? ` · ${c.orderNumber}` : ''}
                        {c.reason ? ` — ${c.reason}` : ' — Claim chargeback'}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            <div style={styles.sideActions}>
              <Button size="sm" disabled={!canPay} onClick={requestMarkPaid}>
                {saving ? 'Saving…' : `Mark paid · ${formatMoney(expectedNet)}`}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void reload()} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {confirmPayOpen ? (
        <div
          style={styles.confirmOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setConfirmPayOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm mark paid"
            style={styles.confirmDialog}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 style={styles.confirmTitle}>Confirm payout?</h2>
            <p style={styles.confirmBody}>
              Pay <strong>{formatMoney(expectedNet)}</strong> to{' '}
              <strong>
                {selectedVendor?.shopName || selectedVendor?.businessName || 'vendor'}
              </strong>
              ?
            </p>
            <p style={styles.confirmMeta}>
              {selected.size} order{selected.size === 1 ? '' : 's'} · {payoutMethod} · ref{' '}
              <strong>{transactionReference.trim()}</strong>
            </p>
            <p style={styles.confirmWarn}>This cannot be undone from here. Check UTR / amount first.</p>
            <div style={styles.confirmActions}>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => setConfirmPayOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void submitPayout()}>
                {saving ? 'Paying…' : 'Yes, mark paid'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card padding="sm" style={styles.cardPad}>
        <h2 style={styles.sectionTitle}>
          History <span style={styles.count}>{history.length}</span>
        </h2>
        {history.length === 0 ? (
          <p style={styles.muted}>No payouts recorded yet.</p>
        ) : (
          <div style={styles.tableWrapWide}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Paid at</th>
                  <th style={styles.th}>Vendor</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.thRight}>Gross</th>
                  <th style={styles.thRight}>Fees</th>
                  <th style={styles.thRight}>Claims</th>
                  <th style={styles.thRight}>Other</th>
                  <th style={styles.thRight}>Net</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const claims = settlementClaimAmount(s);
                  const other = settlementOtherChargesAmount(s);
                  const orderLines = (s.lines ?? []).filter((l) => {
                    const t = (l.lineType ?? '').toUpperCase();
                    return t === 'ORDER' || t === '';
                  });
                  const adjLines = (s.lines ?? []).filter(
                    (l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT',
                  );
                  const otherLines = (s.lines ?? []).filter((l) => {
                    const t = (l.lineType ?? '').toUpperCase();
                    return t === 'OTHER_CHARGE' || t === 'PENALTY';
                  });
                  const open = expandedHistoryId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr>
                        <td style={styles.tdMuted}>
                          {s.paidAt
                            ? new Date(s.paidAt).toLocaleString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td style={styles.td}>{s.payeeName ?? s.payeeId}</td>
                        <td style={styles.tdMuted}>
                          {s.periodStart} → {s.periodEnd}
                          <div style={styles.sub}>
                            {s.periodType} · {orderLines.length} order
                            {orderLines.length === 1 ? '' : 's'}
                            {adjLines.length > 0 ? ` · ${adjLines.length} claim` : ''}
                            {otherLines.length > 0 ? ` · ${otherLines.length} other` : ''}
                          </div>
                          {(s.lines?.length ?? 0) > 0 ? (
                            <button
                              type="button"
                              style={styles.linkBtn}
                              onClick={() => setExpandedHistoryId(open ? null : s.id)}
                            >
                              {open ? 'Hide lines' : 'Why this net?'}
                            </button>
                          ) : null}
                        </td>
                        <td style={styles.tdMuted}>
                          {s.payoutMethod ?? '—'}
                          <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                        </td>
                        <td style={styles.tdRight}>{formatMoney(s.grossAmount)}</td>
                        <td style={styles.tdRight}>{formatMoney(s.commissionAmount)}</td>
                        <td style={{ ...styles.tdRight, ...(claims > 0 ? styles.claimAmt : {}) }}>
                          {formatMoney(claims)}
                        </td>
                        <td style={styles.tdRight}>{formatMoney(other)}</td>
                        <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                        <td style={styles.td}>
                          <span style={s.status === 'PAID' ? styles.settled : styles.openBadge}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={10} style={styles.detailCell}>
                            <div style={styles.detailTitle}>
                              {formatMoney(s.grossAmount)} − {formatMoney(s.commissionAmount)} fees −{' '}
                              {formatMoney(claims)} claims − {formatMoney(other)} other ={' '}
                              {formatMoney(s.netAmount)} net
                            </div>
                            <ul style={styles.claimList}>
                              {orderLines.map((l) => (
                                <li key={l.id}>
                                  + {formatMoney(l.amount)} · {l.orderNumber ?? l.subOrderNumber ?? 'Order'}
                                </li>
                              ))}
                              {adjLines.map((l) => (
                                <li key={l.id}>
                                  − {formatMoney(Math.abs(Number(l.amount ?? 0)))} ·{' '}
                                  {l.description || 'Claim chargeback'}
                                  {l.orderNumber ? ` (${l.orderNumber})` : ''}
                                </li>
                              ))}
                              {otherLines.map((l) => (
                                <li key={l.id}>
                                  − {formatMoney(Math.abs(Number(l.amount ?? 0)))} ·{' '}
                                  {l.description || 'Penalty / other charge'}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}

const layoutCss = `
.sp-layout {
  display: grid;
  gap: 0.55rem;
  align-items: start;
}
.sp-main {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}
.sp-side {
  min-width: 0;
}
.sp-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem 0.45rem;
}
.sp-notes {
  grid-column: span 2;
}
@media (max-width: 900px) {
  .sp-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sp-notes {
    grid-column: 1 / -1;
  }
}
@media (min-width: 1040px) {
  .sp-layout {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 270px);
  }
  .sp-side {
    position: sticky;
    top: 0.5rem;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  cardPad: { display: 'grid', gap: '0.45rem' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  sectionTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  count: { color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.8rem' },
  presets: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  preset: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.55rem',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  presetActive: {
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.55rem',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  label: {
    display: 'grid',
    gap: '0.15rem',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    minWidth: 0,
  },
  input: {
    padding: '0.32rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.82rem',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    minHeight: '1.9rem',
    fontFamily: 'inherit',
  },
  summaryCard: { gap: '0.5rem' },
  netHero: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  netLabel: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-hover)' },
  netValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  mathStack: { display: 'grid', gap: '0.25rem' },
  mathRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  chargePanel: {
    display: 'grid',
    gap: '0.35rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  feePanel: {
    display: 'grid',
    gap: '0.25rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  feePanelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
  },
  feePanelTitle: { fontSize: '0.72rem', fontWeight: 800, color: 'var(--text)' },
  feePill: {
    fontSize: '0.64rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
  },
  feeList: {
    margin: 0,
    paddingLeft: '0.95rem',
    display: 'grid',
    gap: '0.15rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  },
  feeHint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  feeError: { margin: 0, fontSize: '0.72rem', color: '#b91c1c', fontWeight: 650, lineHeight: 1.3 },
  sideActions: { display: 'grid', gap: '0.35rem' },
  req: { color: '#b91c1c', fontWeight: 800 },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.5)',
  },
  confirmDialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.1rem',
    display: 'grid',
    gap: '0.55rem',
  },
  confirmTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.15rem',
  },
  confirmBody: { margin: 0, fontSize: '0.92rem', fontWeight: 650, lineHeight: 1.4 },
  confirmMeta: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 650 },
  confirmWarn: {
    margin: 0,
    padding: '0.5rem 0.65rem',
    borderRadius: 8,
    background: 'rgba(255, 183, 77, 0.18)',
    border: '1px solid rgba(255, 183, 77, 0.45)',
    fontSize: '0.8rem',
    fontWeight: 700,
    lineHeight: 1.35,
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  claimAmt: { color: '#7c3aed' },
  claimList: {
    margin: 0,
    paddingLeft: '1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  linkBtn: {
    marginTop: '0.15rem',
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--accent)',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    fontFamily: 'inherit',
  },
  detailCell: {
    padding: '0.5rem 0.65rem',
    background: 'var(--bg-muted)',
    borderBottom: '1px solid var(--border)',
  },
  detailTitle: { fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.2rem', color: 'var(--text)' },
  tableHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  checkInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(52vh, 520px)',
    overflowY: 'auto',
  },
  tableWrapWide: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.35rem 0.45rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.35rem 0.45rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  td: { padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  tdRight: {
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 650,
    verticalAlign: 'top',
    fontVariantNumeric: 'tabular-nums',
  },
  rowSelected: { background: 'color-mix(in srgb, var(--accent-soft) 65%, transparent)' },
  sub: { color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 500 },
  settled: {
    fontSize: '0.64rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.35rem',
    fontWeight: 700,
  },
  openBadge: {
    fontSize: '0.64rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.35rem',
    fontWeight: 700,
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
};
