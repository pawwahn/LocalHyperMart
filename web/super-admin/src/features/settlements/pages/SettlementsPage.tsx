import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';
import {
  FEE_MODEL_OPTIONS,
  quoteVendorCommercialTerms,
  type CommercialTermsQuote,
} from '@/features/vendors/api/commercialTermsApi';
import {
  confirmVendorBillPayment,
  correctVendorPayout,
  createSettlement,
  fetchSettlementCandidates,
  rejectVendorBillPayment,
  formatMoney,
  listSettlements,
  listSubscriptionBills,
  remindSettlementAck,
  remindVendorBill,
  settlementClaimAmount,
  settlementOtherChargesAmount,
  type PendingSettlementClaim,
  type SettlementCandidate,
  type SettlementVm,
} from '../api/settlementsApi';
import { DeliveryPayoutPanel } from '../components/DeliveryPayoutPanel';
import { SubscriptionBillsPanel } from '../components/SubscriptionBillsPanel';
import { displayPayeeLabel } from '@/shared/display/displayNames';
import { ListPager } from '../components/ListPager';
import {
  CollectFeesCard,
  VendorPayoutWorkspace,
  type VendorAppSubTab,
  type VendorPaysSubTab,
  type VendorPayoutTab,
} from '../components/VendorPayoutWorkspace';
import {
  codCashLocationLabel,
  codCashStage,
  formatSettlementPayment,
  selectedCandidatesByCodStage,
  sumSelectedByCashStage,
  vendorSettlementBucket,
} from '../codCashLabels';
import { MoneyFlowSummary, buyerMoneyFromCashSplit } from '@hlm-money-flow';
import {
  SettlementAuditSection,
  type SettlementChangeLogProps,
} from '../components/SettlementAuditSection';
import {
  DEFAULT_REPORT_DATE_PRESET,
  isoIstDate,
  rangeForReportPreset,
  REPORT_DATE_PRESET_OPTIONS,
  settlementPeriodKind,
  type ReportDatePreset,
  type SettlementPeriodKind,
} from '@/shared/dates/istReportPresets';

const DEFAULT_ORDER_PAGE_SIZE = 50;
const DEFAULT_HISTORY_PAGE_SIZE = 50;

/** Calendar YYYY-MM-DD in Asia/Kolkata — matches Billing / settlement day bounds. */
function isoDateInIst(d: Date = new Date()): string {
  return isoIstDate(d);
}

function placedDateInIst(placedAt?: string | null): string | null {
  if (!placedAt) return null;
  return isoDateInIst(new Date(placedAt));
}

/** Vendor collections are booked on the day the vendor paid, not the day admin confirmed. */
function settlementCashAt(s: SettlementVm): string | null {
  const collection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
  if (collection && s.vendorPaidAt) return s.vendorPaidAt;
  return s.paidAt ?? null;
}

/** Payout windows go by delivered day (IST); placed time only when delivery time is missing. */
function payoutAt(c: SettlementCandidate): string | null | undefined {
  return c.deliveredAt || c.placedAt;
}

function isDeliveredInRange(c: SettlementCandidate, from: string, to: string): boolean {
  const day = placedDateInIst(payoutAt(c));
  if (!day) return false;
  return day >= from && day <= to;
}

function shortWhen(iso?: string | null): string {
  return iso
    ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/** Oldest delivery first so the list reads top to bottom through the range. */
function oldestFirst(a: SettlementCandidate, b: SettlementCandidate): number {
  const pa = payoutAt(a);
  const pb = payoutAt(b);
  const ta = pa ? Date.parse(pa) : Number.POSITIVE_INFINITY;
  const tb = pb ? Date.parse(pb) : Number.POSITIVE_INFINITY;
  const left = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
  const right = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
  if (left !== right) return left - right;
  return (a.orderNumber ?? '').localeCompare(b.orderNumber ?? '');
}

const PAYOUT_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'];

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function feeModelLabel(model?: string | null): string {
  return FEE_MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model ?? 'Billing';
}

function settlementChangeLog(
  tab: 'VENDOR' | 'HUB' | 'AGENT',
  token: string,
  townId: string | undefined,
  refreshTick: number,
): SettlementChangeLogProps {
  return {
    token,
    townId,
    refreshTick,
    actions:
      tab === 'AGENT'
        ? ['DELIVERY_PAYOUT', 'AGENT_PAYOUT']
        : tab === 'HUB'
          ? ['FRANCHISE_COLLECT', 'DELIVERY_PAYOUT', 'HUB_PAYOUT']
          : ['VENDOR_PAYOUT', 'VENDOR_COLLECTION', 'VENDOR_NOT_RECEIVED', 'VENDOR_PAYOUT_CORRECTED', 'VENDOR_BILL_REMINDED'],
    prefixes:
      tab === 'AGENT'
        ? ['Paid AGENT', 'Paid agent']
        : tab === 'HUB'
          ? ['Collected franchise', 'Paid HUB', 'Paid hub']
          : ['Paid vendor', 'Collected from vendor', 'Vendor not received', 'Corrected vendor payout', 'Vendor bill reminder'],
    emptyHint:
      tab === 'AGENT'
        ? 'No agent payout changes for this town.'
        : tab === 'HUB'
          ? 'No hub payout or franchise collection changes for this town.'
          : 'No vendor payout or fee-collection changes for this town.',
  };
}

/** "7.5000% of ₹977 [2026-09-01 → open]" → "7.5% of ₹977 (terms from 1 Sept 2026)". */
function tidyFeeLine(line: string): string {
  return line
    .replace(/(\d+\.\d*?)0+%/g, (_, n: string) => `${n.replace(/\.$/, '')}%`)
    .replace(/\s*\[(\d{4}-\d{2}-\d{2})\s*→\s*open\]/g, (_, d: string) =>
      ` (terms from ${new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`,
    )
    .replace(/\s*\(terms as of [^)]*\)/g, '');
}

export function SettlementsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const initial = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [periodType, setPeriodType] = useState<SettlementPeriodKind>(settlementPeriodKind('week'));
  const [candidates, setCandidates] = useState<SettlementCandidate[]>([]);
  const [pendingClaimChargebacks, setPendingClaimChargebacks] = useState(0);
  const [pendingClaims, setPendingClaims] = useState<PendingSettlementClaim[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<SettlementVm[]>([]);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [subscriptionDueCount, setSubscriptionDueCount] = useState(0);

  useEffect(() => {
    setSubscriptionDueCount(0);
    if (!session?.accessToken || !vendorId) return;
    let cancelled = false;
    void listSubscriptionBills(session.accessToken, vendorId)
      .then((list) => {
        if (!cancelled) setSubscriptionDueCount(list.filter((b) => b.status !== 'PAID').length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, vendorId]);

  function openCorrect(s: SettlementVm) {
    setCorrectId(s.id);
    setCorrectMethod(s.payoutMethod || 'UPI');
    setCorrectRef(s.transactionReference ?? '');
    setCorrectNotes(s.transactionNotes ?? '');
    setError(null);
  }

  async function saveCorrect(s: SettlementVm) {
    if (!session?.accessToken) return;
    if (!correctRef.trim()) {
      setError('Txn ref is required (UTR / UPI / cheque number)');
      setCorrectAsk(null);
      return;
    }
    setBillActionId(s.id);
    setError(null);
    try {
      const updated = await correctVendorPayout(session.accessToken, s.id, {
        payoutMethod: correctMethod,
        transactionReference: correctRef.trim(),
        transactionNotes: correctNotes.trim() || undefined,
      });
      setHistory((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)));
      setCorrectId(null);
      setCorrectAsk(null);
      setSuccess(
        `Updated payout for ${displayPayeeLabel(s.payeeName, s.payeeId, s.payeeType)} · ${updated.payoutMethod} · ref ${updated.transactionReference}. They'll be asked to check again.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update payout');
      setCorrectAsk(null);
    } finally {
      setBillActionId(null);
    }
  }

  function askConfirmVendorPayments() {
    const next = billsToConfirm[0];
    if (next) setBillAsk({ kind: 'confirm', s: next });
  }

  async function remindOpenBills() {
    if (!session?.accessToken) {
      setVendorPaysSubTab('records');
      return;
    }
    const due = openShopBills.filter((s) => !s.vendorPaidAt);
    setVendorPaysSubTab('records');
    if (due.length === 0) return;
    setRemindingId('bills');
    setError(null);
    try {
      for (const s of due) {
        const updated = await remindVendorBill(session.accessToken, s.id);
        setHistory((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)));
      }
      const shop = selectedVendor?.shopName || selectedVendor?.businessName || 'the vendor';
      setSuccess(`Reminder sent to ${shop} to pay ${formatMoney(outstandingCollect)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remind the vendor');
    } finally {
      setRemindingId(null);
    }
  }

  async function sendAckReminder(s: SettlementVm) {
    if (!session?.accessToken) return;
    setRemindingId(s.id);
    setError(null);
    try {
      const updated = await remindSettlementAck(session.accessToken, s.id);
      setHistory((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, ackReminderCount: updated.ackReminderCount, ackRemindedAt: updated.ackRemindedAt }
            : x,
        ),
      );
      setSuccess(
        `Reminder ${updated.ackReminderCount ?? 1} sent to ${displayPayeeLabel(s.payeeName, s.payeeId, s.payeeType)} · they'll see a popup to ack receipt`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reminder');
    } finally {
      setRemindingId(null);
    }
  }
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
  const [confirmBillOpen, setConfirmBillOpen] = useState(false);
  const [billAsk, setBillAsk] = useState<{ kind: 'confirm' | 'reject'; s: SettlementVm } | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [correctMethod, setCorrectMethod] = useState('UPI');
  const [correctRef, setCorrectRef] = useState('');
  const [correctNotes, setCorrectNotes] = useState('');
  const [correctAsk, setCorrectAsk] = useState<SettlementVm | null>(null);
  const [billActionId, setBillActionId] = useState<string | null>(null);
  const [billComments, setBillComments] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'VENDOR' | 'HUB' | 'AGENT'>('VENDOR');
  const [vendorTab, setVendorTab] = useState<VendorPayoutTab>('app-to-vendor');
  const [vendorAppSubTab, setVendorAppSubTab] = useState<VendorAppSubTab>('pay');
  const [vendorPaysSubTab, setVendorPaysSubTab] = useState<VendorPaysSubTab>('collect');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(DEFAULT_HISTORY_PAGE_SIZE);
  const collectFromVendor = vendorTab === 'vendor-to-app';
  const vendorTabRef = useRef(vendorTab);
  vendorTabRef.current = vendorTab;
  const [deliveryRefreshTick, setDeliveryRefreshTick] = useState(0);
  const [codRefreshTick, setCodRefreshTick] = useState(0);
  const [orderSearch, setOrderSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const [orderPage, setOrderPage] = useState(0);
  const [orderPageSize, setOrderPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const scopedCandidates = useMemo(
    () => candidates.filter((c) => vendorSettlementBucket(c) === vendorTab),
    [candidates, vendorTab],
  );

  const payOpenCount = useMemo(
    () =>
      candidates.filter((c) => !c.alreadySettled && vendorSettlementBucket(c) === 'app-to-vendor').length,
    [candidates],
  );

  const collectOpenCount = useMemo(
    () =>
      candidates.filter((c) => !c.alreadySettled && vendorSettlementBucket(c) === 'vendor-to-app').length,
    [candidates],
  );

  const openCandidates = useMemo(
    () => scopedCandidates.filter((c) => !c.alreadySettled),
    [scopedCandidates],
  );

  const filteredCandidates = useMemo(() => {
    const needle = orderSearch.trim().toLowerCase();
    if (!needle) return scopedCandidates;
    return scopedCandidates.filter((c) => {
      const stage = codCashStage(c);
      const hay = `${c.orderNumber ?? ''} ${c.subOrderNumber ?? ''} ${c.paymentMethod ?? ''} ${stage}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [scopedCandidates, orderSearch]);

  const listedCandidates = useMemo(
    () => (showSettled ? filteredCandidates : filteredCandidates.filter((c) => !c.alreadySettled)),
    [filteredCandidates, showSettled],
  );
  const settledInView = filteredCandidates.some((c) => c.alreadySettled);

  const payoutHistory = useMemo(
    () => history.filter((s) => (s.direction ?? 'PAYOUT').toUpperCase() !== 'COLLECTION'),
    [history],
  );

  const vendorNeedsAction = useMemo(
    () =>
      payoutHistory.filter(
        (s) => s.status === 'PAID' && !!s.vendorNotReceivedAt && !s.vendorAcknowledgedAt,
      ).length,
    [payoutHistory],
  );

  const collectionHistory = useMemo(
    () =>
      history.filter(
        (s) =>
          (s.direction ?? '').toUpperCase() === 'COLLECTION' &&
          !(s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION'),
      ),
    [history],
  );

  /** Shop-fee bills already sent and not yet confirmed received. */
  const openShopBills = useMemo(
    () =>
      collectionHistory.filter(
        (s) =>
          s.status !== 'PAID' &&
          !!s.billSentAt &&
          !(s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION'),
      ),
    [collectionHistory],
  );
  const outstandingCollect = useMemo(
    () => roundMoney(openShopBills.reduce((sum, s) => sum + Number(s.netAmount ?? 0), 0)),
    [openShopBills],
  );
  const billsAwaitingVendor = useMemo(() => openShopBills.filter((s) => !s.vendorPaidAt), [openShopBills]);
  const billsToConfirm = useMemo(() => openShopBills.filter((s) => !!s.vendorPaidAt), [openShopBills]);

  const visibleHistory = collectFromVendor ? collectionHistory : payoutHistory;
  const historyPageCount = Math.max(1, Math.ceil(visibleHistory.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, historyPageCount - 1);
  const pagedHistory = useMemo(() => {
    const start = safeHistoryPage * historyPageSize;
    return visibleHistory.slice(start, start + historyPageSize);
  }, [visibleHistory, safeHistoryPage, historyPageSize]);

  const selectedCashSplit = useMemo(
    () => sumSelectedByCashStage(candidates, selected),
    [candidates, selected],
  );

  const selectedStillWithAgent = useMemo(
    () => selectedCandidatesByCodStage(candidates, selected, 'WITH_AGENT'),
    [candidates, selected],
  );

  const codHeldByAgent = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; phone: string | null; amount: number }
    >();
    for (const c of selectedStillWithAgent) {
      const name = c.codDeliveringAgentName?.trim() || 'Unknown agent';
      const key = c.codDeliveringAgentId ?? name;
      const prev = totals.get(key);
      const phone = c.codDeliveringAgentPhone?.trim() || prev?.phone || null;
      totals.set(key, {
        name,
        phone,
        amount: (prev?.amount ?? 0) + Number(c.subtotal ?? 0),
      });
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  }, [selectedStillWithAgent]);

  const orderPageCount = Math.max(1, Math.ceil(listedCandidates.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderPageCount - 1);

  const pagedCandidates = useMemo(() => {
    const start = safeOrderPage * orderPageSize;
    return listedCandidates.slice(start, start + orderPageSize);
  }, [listedCandidates, safeOrderPage, orderPageSize]);

  const selectedFingerprint = useMemo(
    () => Array.from(selected).sort().join('\n'),
    [selected],
  );

  useEffect(() => {
    setOrderPage(0);
  }, [candidates.length, orderSearch, orderPageSize, townId, vendorId, from, to, showSettled]);

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const c of candidates) {
      if (selected.has(c.subOrderId)) sum += Number(c.subtotal ?? 0);
    }
    return roundMoney(sum);
  }, [candidates, selected]);

  const quoteGross =
    feeQuote?.grossAmount != null ? roundMoney(Number(feeQuote.grossAmount)) : null;
  const commissionNum = feeQuote
    ? roundMoney(Number(feeQuote.totalFeeAmount ?? 0))
    : roundMoney(Number(commissionAmount || 0));
  const otherChargesNum = Math.max(0, roundMoney(Number(otherChargesAmount || 0)));
  const grossMismatch =
    quoteGross != null && Math.abs(quoteGross - selectedTotal) > 0.009;

  const quoteMatches =
    selected.size > 0 &&
    feeQuote != null &&
    (quoteGross == null || Math.abs(quoteGross - selectedTotal) <= 0.009);
  /** Bags are selected but the fee quote is still for the other tab or not back yet. */
  const netPending = selected.size > 0 && !quoteMatches;

  const expectedNet = useMemo(() => {
    if (!quoteMatches) {
      return collectFromVendor ? roundMoney(otherChargesNum) : 0;
    }
    if (collectFromVendor) {
      return roundMoney(commissionNum + otherChargesNum);
    }
    const afterFees =
      feeQuote?.suggestedNet != null
        ? roundMoney(Number(feeQuote.suggestedNet))
        : roundMoney(selectedTotal - commissionNum);
    return Math.max(0, roundMoney(afterFees - pendingClaimChargebacks - otherChargesNum));
  }, [
    quoteMatches,
    collectFromVendor,
    feeQuote,
    selectedTotal,
    commissionNum,
    pendingClaimChargebacks,
    otherChargesNum,
  ]);

  useEffect(() => {
    if (!token || !vendorId) {
      setFeeQuote(null);
      setFeeQuoteError(null);
      setFeeQuoteLoading(false);
      setCommissionAmount('0');
      return;
    }
    if (selected.size === 0) {
      setFeeQuote(null);
      setFeeQuoteError(null);
      setFeeQuoteLoading(false);
      setCommissionAmount('0');
      return;
    }
    let cancelled = false;
    const debounceMs = selected.size > 40 ? 550 : 200;
    const timer = window.setTimeout(() => {
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
            includeSubscription: false,
            allowFeeExceedGross: collectFromVendor,
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
                : collectFromVendor
                  ? 'Could not load billing fees for this collection'
                : 'Could not load billing fees for this payout',
            );
          }
        } finally {
          if (!cancelled) setFeeQuoteLoading(false);
        }
      })();
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    token,
    vendorId,
    selectedTotal,
    selectedFingerprint,
    selected.size,
    candidates,
    from,
    to,
    collectFromVendor,
  ]);

  const applyPreset = (next: ReportDatePreset) => {
    setPreset(next);
    setPeriodType(settlementPeriodKind(next));
    if (next === 'custom') return;
    const range = rangeForReportPreset(next);
    setFrom(range.from);
    setTo(range.to);
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
    // Strict delivered-date filter (IST calendar day) so UI matches the From/To pickers.
    const items = (data.items ?? [])
      .filter((i) => isDeliveredInRange(i, from, to))
      .sort(oldestFirst);
    setCandidates(items);
    setPendingClaimChargebacks(Number(data.pendingClaimChargebacks ?? 0));
    setPendingClaims(data.pendingClaims ?? []);
    setSelected(
      new Set(
        items
          .filter((i) => !i.alreadySettled && vendorSettlementBucket(i) === vendorTabRef.current)
          .map((i) => i.subOrderId),
      ),
    );
  }, [token, townId, vendorId, from, to]);

  useEffect(() => {
    setSelected(
      new Set(
        candidates
          .filter((c) => !c.alreadySettled && vendorSettlementBucket(c) === vendorTab)
          .map((c) => c.subOrderId),
      ),
    );
  }, [vendorTab, candidates]);

  const reloadHistory = useCallback(async () => {
    if (!token) return;
    const items = await listSettlements(token, {
      townId: townId || undefined,
      payeeId: vendorId || undefined,
    });
    // Paid settlements by IST paid day (one period each); open ones by window overlap.
    const inRange = items.filter((s) => {
      const openShopBill =
        (s.direction ?? '').toUpperCase() === 'COLLECTION' &&
        s.status !== 'PAID' &&
        !!s.billSentAt &&
        !(s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION');
      if (openShopBill) return true;
      const paidDay = s.status === 'PAID' ? placedDateInIst(settlementCashAt(s)) : null;
      if (paidDay) return paidDay >= from && paidDay <= to;
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
      const candidateErr = await reloadCandidates().then(
        () => null,
        (err: unknown) =>
          err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payout orders',
      );
      const historyErr = await reloadHistory().then(
        () => null,
        (err: unknown) =>
          err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payout history',
      );
      if (candidateErr) {
        setCandidates([]);
        setPendingClaimChargebacks(0);
        setPendingClaims([]);
        setSelected(new Set());
      }
      if (candidateErr || historyErr) {
        setError([candidateErr, historyErr].filter(Boolean).join(' · '));
      }
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
    if (!token || !townId || !vendorId) return;
    if (!collectFromVendor && selected.size === 0) return;
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
      setError(
        feeQuoteError ||
          (collectFromVendor
            ? 'Billing fees are required before collection. Refresh and try again.'
            : 'Billing fees are required before payout. Refresh and try again.'),
      );
      setConfirmPayOpen(false);
      return;
    }
    if (otherChargesNum > 0 && !otherChargesReason.trim()) {
      setError('Add a reason for the penalty / other charge');
      setConfirmPayOpen(false);
      return;
    }
    if (collectFromVendor && expectedNet <= 0) {
      setError('Nothing to collect — no commission or extra charge on these bags. Monthly subscription is on the Subscription bill tab.');
      setConfirmPayOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createSettlement(token, {
        townId,
        vendorId,
        vendorName: selectedVendor?.shopName || selectedVendor?.businessName,
        periodStart: from,
        periodEnd: to,
        periodType,
        direction: collectFromVendor ? 'COLLECTION' : 'PAYOUT',
        subOrderIds: Array.from(selected),
        commissionAmount: Number(commissionAmount || 0),
        markPaid: true,
        payoutMethod,
        transactionReference: txnRef,
        transactionNotes: transactionNotes.trim() || undefined,
        otherChargesAmount: otherChargesNum > 0 ? otherChargesNum : undefined,
        otherChargesReason: otherChargesNum > 0 ? otherChargesReason.trim() : undefined,
      });
      const shop = displayPayeeLabel(
        created.payeeName,
        created.payeeId,
        created.payeeType ?? 'VENDOR',
      );
      if (collectFromVendor) {
        setSuccess(
          `Collected ${formatMoney(created.netAmount)} from ${shop} · fees ${formatMoney(created.commissionAmount)}${
            selected.size > 0 ? ` · ${selected.size} shop-held bag${selected.size === 1 ? '' : 's'} closed` : ''
          } · ${created.payoutMethod} · ref ${txnRef}`,
        );
      } else {
      const claimsTaken = settlementClaimAmount(created);
      const otherTaken = settlementOtherChargesAmount(created);
      const parts = [
        `gross ${formatMoney(created.grossAmount)}`,
        `fees ${formatMoney(created.commissionAmount)}`,
      ];
      if (claimsTaken > 0) parts.push(`claims ${formatMoney(claimsTaken)}`);
      if (otherTaken > 0) parts.push(`other ${formatMoney(otherTaken)}`);
      setSuccess(
          `Paid ${formatMoney(created.netAmount)} (${parts.join(' − ')}) to ${shop} · ${created.payoutMethod} · ref ${txnRef}`,
      );
      }
      setTransactionReference('');
      setTransactionNotes('');
      setOtherChargesAmount('');
      setOtherChargesReason('');
      setConfirmPayOpen(false);
      setDeliveryRefreshTick((n) => n + 1);
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : collectFromVendor
            ? 'Failed to record collection'
            : 'Failed to record payout',
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendCollectionBill() {
    if (!token || !townId || !vendorId || !feeQuote || expectedNet <= 0) return;
    if (otherChargesNum > 0 && !otherChargesReason.trim()) {
      setError('Add a reason for the extra charge');
      setConfirmBillOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createSettlement(token, {
        townId,
        vendorId,
        vendorName: selectedVendor?.shopName || selectedVendor?.businessName,
        periodStart: from,
        periodEnd: to,
        periodType,
        direction: 'COLLECTION',
        subOrderIds: Array.from(selected),
        markPaid: false,
        sendBill: true,
        transactionNotes: transactionNotes.trim() || undefined,
        otherChargesAmount: otherChargesNum > 0 ? otherChargesNum : undefined,
        otherChargesReason: otherChargesNum > 0 ? otherChargesReason.trim() : undefined,
      });
      const shop = displayPayeeLabel(created.payeeName, created.payeeId, created.payeeType ?? 'VENDOR');
      setSuccess(
        `Bill ${created.serviceInvoiceNumber ?? ''} for ${formatMoney(created.netAmount)} sent to ${shop}. ` +
          'They pay and enter the UTR in their portal — confirm or reject it in Records.',
      );
      setOtherChargesAmount('');
      setOtherChargesReason('');
      setConfirmBillOpen(false);
      setDeliveryRefreshTick((n) => n + 1);
      await Promise.all([reloadCandidates(), reloadHistory()]);
      setVendorPaysSubTab('records');
      openVendorRecords('collect');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to send bill');
    } finally {
      setSaving(false);
    }
  }

  async function confirmBillPayment(s: SettlementVm) {
    if (!token) return;
    setBillActionId(s.id);
    setError(null);
    try {
      const comment = (billComments[s.id] ?? '').trim();
      await confirmVendorBillPayment(token, s.id, comment ? { transactionNotes: comment } : {});
      setSuccess(`Payment ${formatMoney(s.netAmount)} confirmed · ref ${s.vendorPaymentReference ?? '—'}`);
      setBillComments((prev) => ({ ...prev, [s.id]: '' }));
      await reloadHistory();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setBillActionId(null);
    }
  }

  async function rejectBillPayment(s: SettlementVm) {
    if (!token) return;
    const reason = (billComments[s.id] ?? '').trim();
    if (!reason) {
      setError('Write a comment for the vendor before rejecting (what is wrong / what to send)');
      return;
    }
    setBillActionId(s.id);
    setError(null);
    try {
      await rejectVendorBillPayment(token, s.id, reason);
      setSuccess('Payment sent back to the vendor with your comment');
      setBillComments((prev) => ({ ...prev, [s.id]: '' }));
      await reloadHistory();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to reject payment');
    } finally {
      setBillActionId(null);
    }
  }

  const canSendBill =
    !saving && !!townId && !!vendorId && !feeQuoteLoading && !feeQuoteError && !!feeQuote && expectedNet > 0;
  const sendBillHint = saving
    ? null
    : !townId || !vendorId
      ? 'Pick a town and vendor'
      : feeQuoteLoading
        ? 'Calculating billing fees…'
        : feeQuoteError || !feeQuote
          ? feeQuoteError || 'Billing fees not available'
          : expectedNet <= 0
            ? outstandingCollect > 0
              ? null
              : 'Nothing to bill'
            : null;

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
    !!townId &&
    !!vendorId &&
    !feeQuoteLoading &&
    !feeQuoteError &&
    !!feeQuote &&
    transactionReference.trim().length > 0 &&
    (collectFromVendor ? expectedNet > 0 : selected.size > 0);

  const payBlockedReason = saving
    ? null
    : !townId || !vendorId
      ? 'Pick a town and vendor'
      : !collectFromVendor && selected.size === 0
        ? 'Select at least one unsettled bag'
        : feeQuoteLoading
          ? 'Calculating billing fees…'
          : feeQuoteError || !feeQuote
            ? feeQuoteError || 'Billing fees not available'
            : collectFromVendor && expectedNet <= 0
              ? 'Nothing to collect'
              : null;
  const payHint =
    payBlockedReason ??
    (transactionReference.trim().length === 0 ? 'Enter Txn ref (UTR / UPI / cheque) at the top to enable' : null);

  const showSummary =
    !!townId &&
    !!vendorId &&
    (selected.size > 0 || collectFromVendor || pendingClaimChargebacks > 0);

  function switchVendorTab(next: VendorPayoutTab) {
    setVendorTab(next);
    setFeeQuote(null);
    setFeeQuoteError(null);
    setCommissionAmount('0');
    if (next === 'subscription') {
      setFeeQuoteLoading(false);
      return;
    }
    const nextIds = candidates
      .filter((c) => !c.alreadySettled && vendorSettlementBucket(c) === next)
      .map((c) => c.subOrderId);
    setFeeQuoteLoading(nextIds.length > 0);
    setSelected(new Set(nextIds));
  }

  function openVendorRecords(which: 'pay' | 'collect') {
    if (which === 'pay') setVendorAppSubTab('records');
    else setVendorPaysSubTab('records');
    void reloadHistory();
  }

  useEffect(() => {
    setHistoryPage(0);
  }, [vendorTab, historyPageSize, vendorId, from, to]);

  const vendorRecordsSection = (
    <SettlementAuditSection
      collapsible={false}
      historyCount={visibleHistory.length}
      historyTabLabel={collectFromVendor ? 'Vendor → KK collections' : 'KK → vendor payouts'}
      historyHint={
        collectFromVendor
          ? 'Shop-held fee bills only. Monthly subscription is on the Subscription bill tab.'
          : 'Goods payouts to this shop (not fee collections).'
      }
      historyEmpty={
        collectFromVendor
          ? 'No collections from this vendor in this range.'
          : 'No payouts recorded yet.'
      }
      changeLog={settlementChangeLog('VENDOR', token, townId || undefined, deliveryRefreshTick)}
      historyContent={
        <div style={styles.tableInAudit}>
          {visibleHistory.length > 0 ? (
            <ListPager
              page={safeHistoryPage}
              pageCount={historyPageCount}
              total={visibleHistory.length}
              pageSize={historyPageSize}
              onPage={setHistoryPage}
              onPageSize={(size) => {
                setHistoryPageSize(size);
                setHistoryPage(0);
              }}
            />
          ) : null}
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
                <th style={styles.thRight}>{collectFromVendor ? 'Net in' : 'Net'}</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedHistory.map((s) => {
                const claims = settlementClaimAmount(s);
                const other = settlementOtherChargesAmount(s);
                const isCollection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
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
                const feeLines = (s.lines ?? []).filter((l) => {
                  const t = (l.lineType ?? '').toUpperCase();
                  return t === 'COMMISSION' || t === 'SUBSCRIPTION';
                });
                const open = expandedHistoryId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr>
                      <td style={styles.tdMuted}>
                        {settlementCashAt(s)
                          ? new Date(settlementCashAt(s)!).toLocaleString(undefined, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                        {isCollection && s.vendorPaidAt && s.paidAt ? (
                          <div style={styles.sub}>
                            Verified{' '}
                            {new Date(s.paidAt).toLocaleString(undefined, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td style={styles.td}>
                        {displayPayeeLabel(s.payeeName, s.payeeId, s.payeeType)}
                      </td>
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
                        {s.status !== 'PAID' && isCollection && s.vendorPaidAt ? (
                          <>
                            {s.vendorPaymentMethod ?? '—'}
                            <div style={styles.sub}>Vendor UTR {s.vendorPaymentReference || '—'}</div>
                            {s.vendorPaymentNotes ? <div style={styles.sub}>“{s.vendorPaymentNotes}”</div> : null}
                          </>
                        ) : (
                          <>
                            {s.payoutMethod ?? '—'}
                            <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                          </>
                        )}
                      </td>
                      <td style={styles.tdRight}>{formatMoney(s.grossAmount)}</td>
                      <td style={styles.tdRight}>{formatMoney(s.commissionAmount)}</td>
                      <td style={{ ...styles.tdRight, ...(claims > 0 ? styles.claimAmt : {}) }}>
                        {formatMoney(claims)}
                      </td>
                      <td style={styles.tdRight}>{formatMoney(other)}</td>
                      <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                      <td style={styles.td}>
                        {isCollection && s.status !== 'PAID' && s.billSentAt ? (
                          <div style={styles.billBox}>
                            <span
                              style={
                                s.vendorPaidAt
                                  ? styles.billPaidBadge
                                  : s.vendorPaymentRejectedAt
                                    ? styles.billRejectBadge
                                    : styles.openBadge
                              }
                            >
                              {s.vendorPaidAt
                                ? 'Vendor paid · check'
                                : s.vendorPaymentRejectedAt
                                  ? 'Rejected · vendor to resend'
                                  : 'Bill sent · awaiting vendor'}
                            </span>
                            <div style={styles.sub}>
                              {s.serviceInvoiceNumber ?? ''} · sent{' '}
                              {new Date(s.billSentAt).toLocaleString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            {(s.ackReminderCount ?? 0) > 0 ? (
                              <div style={styles.sub}>
                                Reminded {s.ackReminderCount}×
                                {s.ackRemindedAt
                                  ? ` · last ${new Date(s.ackRemindedAt).toLocaleString(undefined, {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : ''}
                              </div>
                            ) : null}
                            {s.vendorPaymentRejectedAt && s.vendorPaymentRejectReason ? (
                              <div style={styles.billReason}>Your comment: {s.vendorPaymentRejectReason}</div>
                            ) : null}
                            {s.vendorPaidAt ? (
                              <>
                                <input
                                  style={styles.billInput}
                                  placeholder="Comment to vendor (required to reject)"
                                  value={billComments[s.id] ?? ''}
                                  maxLength={500}
                                  onChange={(e) => setBillComments((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                />
                                <div style={styles.billActions}>
                                  <Button
                                    size="sm"
                                    disabled={billActionId === s.id}
                                    onClick={() => setBillAsk({ kind: 'confirm', s })}
                                  >
                                    {billActionId === s.id ? 'Saving…' : 'Confirm received'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={billActionId === s.id}
                                    onClick={() => {
                                      if (!(billComments[s.id] ?? '').trim()) {
                                        setError('Write a comment for the vendor before rejecting (what is wrong / what to send)');
                                        return;
                                      }
                                      setError(null);
                                      setBillAsk({ kind: 'reject', s });
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : (
                        <span style={s.status === 'PAID' ? styles.settled : styles.openBadge}>
                          {isCollection && s.status === 'PAID' ? 'RECEIVED' : s.status}
                        </span>
                        )}
                        {isCollection && s.status === 'PAID' && s.transactionNotes ? (
                          <div style={styles.sub}>“{s.transactionNotes}”</div>
                        ) : null}
                        {s.status === 'PAID' && !isCollection ? (
                          s.vendorNotReceivedAt && !s.vendorAcknowledgedAt ? (
                            <div style={styles.notReceived}>
                              {s.payeeType === 'HUB' ? 'Hub not received' : s.payeeType === 'AGENT' ? 'Agent not received' : 'Vendor not received'}
                              <div style={styles.sub}>
                                {new Date(s.vendorNotReceivedAt).toLocaleString(undefined, {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              {s.vendorNotReceivedNote ? (
                                <div style={styles.billReason}>
                                  {s.payeeType === 'HUB' ? 'Hub' : s.payeeType === 'AGENT' ? 'Agent' : 'Vendor'}: {s.vendorNotReceivedNote}
                                </div>
                              ) : null}
                              {correctId === s.id ? (
                                <div style={styles.correctBox}>
                                  <select
                                    style={styles.billInput}
                                    value={correctMethod}
                                    onChange={(e) => setCorrectMethod(e.target.value)}
                                  >
                                    {PAYOUT_METHODS.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    style={styles.billInput}
                                    value={correctRef}
                                    placeholder="UTR / UPI / cheque"
                                    onChange={(e) => setCorrectRef(e.target.value)}
                                  />
                                  <input
                                    style={styles.billInput}
                                    value={correctNotes}
                                    placeholder="Note (optional)"
                                    onChange={(e) => setCorrectNotes(e.target.value)}
                                  />
                                  <div style={styles.billActions}>
                                    <Button size="sm" disabled={billActionId === s.id} onClick={() => setCorrectAsk(s)}>
                                      Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCorrectId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" style={styles.remindBtn} onClick={() => openCorrect(s)}>
                                  Correct record
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={styles.sub}>
                              {s.vendorAcknowledgedAt
                                ? `${s.payeeType === 'HUB' ? 'Hub' : 'Vendor'} ack · ${new Date(s.vendorAcknowledgedAt).toLocaleString(undefined, {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : s.payeeType === 'HUB'
                                  ? 'Awaiting hub ack'
                                  : 'Awaiting vendor ack'}
                            </div>
                          )
                        ) : null}
                        {s.status === 'PAID' && !isCollection && !s.vendorAcknowledgedAt ? (
                          <>
                            <button
                              type="button"
                              style={styles.remindBtn}
                              disabled={remindingId === s.id}
                              onClick={() => void sendAckReminder(s)}
                            >
                              {remindingId === s.id
                                ? 'Sending…'
                                : (s.ackReminderCount ?? 0) > 0
                                  ? 'Remind again'
                                  : 'Remind'}
                            </button>
                            {(s.ackReminderCount ?? 0) > 0 ? (
                              <div style={styles.sub}>
                                Reminded {s.ackReminderCount}×
                                {s.ackRemindedAt
                                  ? ` · last ${new Date(s.ackRemindedAt).toLocaleString(undefined, {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : ''}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={10} style={styles.detailCell}>
                          <div style={styles.detailTitle}>
                            {isCollection
                              ? `${formatMoney(s.commissionAmount)} fees + ${formatMoney(other)} extra = ${formatMoney(s.netAmount)} received. Shop-held GMV ${formatMoney(s.grossAmount)} stayed at vendor.`
                              : `${formatMoney(s.grossAmount)} − ${formatMoney(s.commissionAmount)} fees − ${formatMoney(claims)} claims − ${formatMoney(other)} other = ${formatMoney(s.netAmount)} net`}
                          </div>
                          <ul style={styles.claimList}>
                            {orderLines.map((l) => (
                              <li key={l.id}>
                                {isCollection ? 'closed' : '+'} {formatMoney(l.amount)} ·{' '}
                                {l.orderNumber ?? l.subOrderNumber ?? 'Order'}
                                {l.description ? ` — ${l.description}` : ''}
                              </li>
                            ))}
                            {feeLines.map((l) => (
                              <li key={l.id}>
                                + {formatMoney(Math.abs(Number(l.amount ?? 0)))} ·{' '}
                                {l.description || 'Fee collected'}
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
                                {isCollection ? '+' : '−'}{' '}
                                {formatMoney(Math.abs(Number(l.amount ?? 0)))} ·{' '}
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
      }
    />
  );

  return (
    <PortalShell
      title="Payouts"
      onRefresh={() => {
        if (tab === 'VENDOR') void reload();
        else setDeliveryRefreshTick((n) => n + 1);
        setCodRefreshTick((n) => n + 1);
      }}
    >
      <style>{layoutCss}</style>
      <div style={styles.tabs}>
        {(
          [
            ['VENDOR', 'Vendor'],
            ['HUB', 'Hub'],
            ['AGENT', 'Agent'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            style={tab === id ? styles.tabActive : styles.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab !== 'VENDOR' ? (
        <DeliveryPayoutPanel
          token={token}
          payeeType={tab}
          refreshTick={deliveryRefreshTick}
          codRefreshTick={codRefreshTick}
          onSettled={() => setDeliveryRefreshTick((n) => n + 1)}
          changeLog={settlementChangeLog(tab, token, undefined, deliveryRefreshTick)}
        />
      ) : null}
      {tab === 'VENDOR' && error ? <Banner tone="danger">{error}</Banner> : null}
      {tab === 'VENDOR' && success ? <Banner tone="success">{success}</Banner> : null}

      {tab === 'VENDOR' ? (
      <>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
          <Card padding="sm" style={styles.cardPad}>
            <div style={styles.toolbar}>
              <div style={styles.presets}>
                {REPORT_DATE_PRESET_OPTIONS.map(({ id, label }) => (
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

          {!townId || !vendorId ? (
          <Card padding="sm" style={styles.cardPad}>
              <p style={styles.muted}>Select a town and vendor to open the vendor workspace.</p>
            </Card>
          ) : (
          <VendorPayoutWorkspace
            tab={vendorTab}
            onTab={switchVendorTab}
            appSubTab={vendorAppSubTab}
            onAppSubTab={(t) => {
              setVendorAppSubTab(t);
              if (t === 'records') openVendorRecords('pay');
            }}
            paysSubTab={vendorPaysSubTab}
            onPaysSubTab={(t) => {
              setVendorPaysSubTab(t);
              if (t === 'records') openVendorRecords('collect');
            }}
            onCheckRecords={() => void remindOpenBills()}
            remindingBills={remindingId === 'bills'}
            awaitingBillCount={billsAwaitingVendor.length}
            paidBillCount={billsToConfirm.length}
            onConfirmReceived={askConfirmVendorPayments}
            payOpenCount={payOpenCount}
            collectOpenCount={collectOpenCount + openShopBills.length}
            outstandingCollect={outstandingCollect}
            outstandingBillCount={openShopBills.length}
            selectedCount={selected.size}
            selectedGross={selectedTotal}
            expectedNet={expectedNet}
            netPending={netPending}
            loading={loading}
            saving={saving}
            canSubmit={canPay}
            submitHint={canPay ? null : payHint}
            onRefresh={() => void reload()}
            onSubmit={requestMarkPaid}
            canSendBill={canSendBill}
            sendBillHint={sendBillHint}
            onSendBill={() => {
              setError(null);
              setConfirmBillOpen(true);
            }}
            workSection={
      <div className="sp-layout">
        <div className={collectFromVendor ? 'sp-main sp-joined' : 'sp-main'}>
          {collectFromVendor ? (
            <CollectFeesCard
              attached
              loading={loading}
              saving={saving}
              canSubmit={canPay}
              canSendBill={canSendBill}
              sendBillHint={sendBillHint}
              selectedCount={selected.size}
              selectedGross={selectedTotal}
              expectedNet={expectedNet}
              netPending={netPending}
              outstandingCollect={outstandingCollect}
              outstandingBillCount={openShopBills.length}
              paysSubTab={vendorPaysSubTab}
              onPaysSubTab={setVendorPaysSubTab}
              onCheckRecords={() => void remindOpenBills()}
              remindingBills={remindingId === 'bills'}
              awaitingBillCount={billsAwaitingVendor.length}
              paidBillCount={billsToConfirm.length}
              onConfirmReceived={askConfirmVendorPayments}
              onRefresh={() => void reload()}
              onSubmit={requestMarkPaid}
              onSendBill={() => {
                setError(null);
                setConfirmBillOpen(true);
              }}
            />
          ) : null}
          <Card
            padding="sm"
            style={collectFromVendor ? { ...styles.cardPad, ...styles.joinedTable } : styles.cardPad}
          >
            <div style={styles.tableHead}>
              <h2 style={styles.sectionTitle}>
                {collectFromVendor ? 'Shop-held COD' : 'Pay bags'}{' '}
                <span style={styles.count}>
                  {listedCandidates.length} bag{listedCandidates.length === 1 ? '' : 's'} · {selected.size} selected ·{' '}
                  {formatMoney(selectedTotal)} gross
                </span>
              </h2>
              <span style={styles.headChecks}>
              {settledInView ? (
                <label style={styles.checkInline}>
                  <input
                    type="checkbox"
                    checked={showSettled}
                    onChange={(e) => setShowSettled(e.target.checked)}
                  />
                  Show settled
                </label>
              ) : null}
              <label style={styles.checkInline}>
                <input
                  type="checkbox"
                  checked={openCandidates.length > 0 && selected.size === openCandidates.length}
                  onChange={(e) => toggleAllOpen(e.target.checked)}
                  disabled={openCandidates.length === 0}
                />
                All unsettled
              </label>
              </span>
            </div>
            {!townId || !vendorId ? (
              <p style={styles.muted}>Select a town and vendor to load orders.</p>
            ) : loading ? (
              <p style={styles.muted}>Loading…</p>
            ) : scopedCandidates.length === 0 ? (
              <p style={styles.muted}>
                {collectFromVendor
                  ? outstandingCollect > 0
                    ? `No new shop-held bags. ${formatMoney(outstandingCollect)} is already billed and still to receive — confirm it in Records.`
                    : 'No shop-held COD in this range. Monthly subscription is on the Subscription bill tab.'
                  : 'No bags where KoyaKart or the hub holds cash in this range.'}
              </p>
            ) : listedCandidates.length === 0 ? (
              <p style={styles.muted}>
                {orderSearch.trim()
                  ? 'No bags match your search.'
                  : 'Settled bags are hidden. Tick Show settled to see them.'}
              </p>
            ) : (
              <>
                <div style={styles.ordersToolbar}>
                  <input
                    style={styles.searchInput}
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search order or bag #…"
                    aria-label="Search orders"
                  />
                  <ListPager
                    page={safeOrderPage}
                    pageCount={orderPageCount}
                    total={listedCandidates.length}
                    pageSize={orderPageSize}
                    onPage={setOrderPage}
                    onPageSize={(size) => {
                      setOrderPageSize(size);
                      setOrderPage(0);
                    }}
                  />
                </div>
                <div style={styles.tableWrapPaged}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th} />
                      <th style={styles.th}>Delivered</th>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Payment</th>
                      <th style={styles.thRight}>Bag total</th>
                      <th style={styles.th}>Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCandidates.map((row) => (
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
                          {shortWhen(row.deliveredAt || row.placedAt)}
                          <div style={styles.sub}>Placed {shortWhen(row.placedAt)}</div>
                        </td>
                        <td style={styles.td}>
                          <strong>{row.orderNumber}</strong>
                          <div style={styles.sub}>{row.subOrderNumber}</div>
                        </td>
                        <td style={styles.tdMuted}>{row.status}</td>
                        <td style={styles.td}>
                          <div>{formatSettlementPayment(row)}</div>
                          {(() => {
                            const stage = codCashStage(row);
                            if (stage === 'ONLINE') {
                              return (
                                <span style={styles.onlinePayHint}>{codCashLocationLabel('ONLINE')}</span>
                              );
                            }
                            const label = codCashLocationLabel(stage);
                            const badgeStyle =
                              stage === 'AT_HUB'
                                ? styles.codHubBadge
                                : stage === 'WITH_COMPANY'
                                  ? styles.onlinePayHint
                                  : stage === 'WITH_VENDOR'
                                  ? styles.codVendorBadge
                                  : stage === 'DECLARED_TO_VENDOR' || stage === 'DECLARED_TO_HUB'
                                    ? styles.codDeclaredBadge
                                    : styles.codAgentBadge;
                            const title =
                              stage === 'AT_HUB'
                                ? 'Hub recorded agent remittance (close-day)'
                                : stage === 'WITH_COMPANY'
                                  ? 'This COD is already with KoyaKart'
                                  : stage === 'WITH_VENDOR'
                                  ? 'Shop confirmed COD receipt from their agent'
                                  : stage === 'DECLARED_TO_VENDOR'
                                    ? 'Agent declared to shop — shop has not confirmed yet'
                                    : stage === 'DECLARED_TO_HUB'
                                      ? 'Agent declared to hub — hub has not confirmed yet'
                                      : row.codDeliveringAgentName
                                        ? `Cash still with ${row.codDeliveringAgentName}`
                                        : 'Cash still with the delivery agent';
                            return (
                              <span style={badgeStyle} title={title}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
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
              </>
            )}
                {scopedCandidates.length > 0 ? (
              <p style={styles.tableHint}>
                {collectFromVendor
                  ? 'Shop-held COD — collect fees on Vendor pays KoyaKart; do not pay GMV here.'
                  : 'KoyaKart pays vendor: online UPI + hub close-day COD. Use Money map (right) for who holds cash and who pays whom.'}
              </p>
            ) : null}
          </Card>
        </div>

        <aside className="sp-side">
          <Card padding="sm" elevated style={{ ...styles.cardPad, ...styles.summaryCard }}>
            <h2 style={styles.sectionTitle}>Summary</h2>
            {!showSummary ? (
              <p style={styles.muted}>
                {collectFromVendor ? 'Select a vendor to see fees due.' : 'Select a vendor and orders to see net pay.'}
              </p>
            ) : (
              <>
                <div style={styles.netHero}>
                  <span style={styles.netLabel}>
                    {collectFromVendor ? 'Collect from vendor' : 'Net to vendor'}
                  </span>
                  <strong style={styles.netValue}>
                    {netPending
                      ? '…'
                      : formatMoney(collectFromVendor ? roundMoney(expectedNet + outstandingCollect) : expectedNet)}
                  </strong>
                </div>
                {collectFromVendor && outstandingCollect > 0 ? (
                  <div style={styles.mathRow}>
                    <span>
                      Billed, not received · {openShopBills.length} bill{openShopBills.length === 1 ? '' : 's'}
                    </span>
                    <strong>{formatMoney(outstandingCollect)}</strong>
                  </div>
                ) : null}

                {grossMismatch ? (
                  <p style={styles.feeError}>
                    Selected bags total ({formatMoney(selectedTotal)}) does not match billing gross (
                    {formatMoney(quoteGross)}). Refresh or re-select orders.
                  </p>
                ) : null}

                {(selectedCashSplit.codWithAgent > 0 ||
                  selectedCashSplit.codAtHub > 0 ||
                  selectedCashSplit.codAlreadyIn > 0 ||
                  selectedCashSplit.codWithVendor > 0 ||
                  selectedCashSplit.codDeclaredToVendor > 0 ||
                  selectedCashSplit.codDeclaredToHub > 0 ||
                  selectedCashSplit.online > 0) && (
                  <MoneyFlowSummary
                    held={buyerMoneyFromCashSplit(selectedCashSplit)}
                    gross={quoteGross ?? selectedTotal}
                    fees={commissionNum}
                    netToVendor={expectedNet}
                    collectFromVendor={collectFromVendor}
                    extraCharges={collectFromVendor ? otherChargesNum : 0}
                    footnote={
                      !collectFromVendor && selectedCashSplit.codAtHub > 0
                        ? 'Hub COD remittance is a separate hub → KoyaKart step (Issue COD statement). Vendor payout does not pull cash from agents.'
                        : null
                    }
                    style={{ marginBottom: '0.35rem' }}
                  />
                )}

                    {selectedCashSplit.codWithAgent > 0 ? (
                  <div style={styles.cashSplit}>
                    <span style={styles.cashSplitTitle}>COD still with agent</span>
                        {codHeldByAgent.length > 0 ? (
                          <div style={styles.codAgentHeldBy}>
                        {codHeldByAgent.map((row) => (
                          <p key={`${row.name}-${row.phone ?? ''}`} style={styles.codAgentHeldRow}>
                                <span>Held by</span>
                            <strong>{row.name}</strong>
                            {row.phone ? (
                              <a href={`tel:${row.phone}`} style={styles.agentPhoneLink}>
                                {row.phone}
                              </a>
                            ) : null}
                            <span>{formatMoney(row.amount)}</span>
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {selectedStillWithAgent.length > 0 ? (
                          <ul style={styles.codAgentOrderList}>
                            {selectedStillWithAgent.map((c) => (
                              <li key={c.subOrderId}>
                                <strong>{c.orderNumber}</strong> · {formatMoney(c.subtotal)}
                                <span style={styles.codAgentOrderHint}>
                                  {c.codDeliveringAgentName
                                    ? ` · ${c.codDeliveringAgentName}`
                                    : c.vendorAgentDelivery
                                      ? ` · shop agent (unknown)`
                                      : ' · hub agent (unknown)'}
                              {c.codDeliveringAgentPhone ? (
                                <>
                                  {' · '}
                                  <a href={`tel:${c.codDeliveringAgentPhone}`} style={styles.agentPhoneLink}>
                                    {c.codDeliveringAgentPhone}
                                  </a>
                                </>
                              ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      <p style={styles.cashSplitHint}>
                      Confirm handover or hub close-day before paying vendor on these bags.
                      </p>
                  </div>
                ) : null}

                <div style={styles.mathStack}>
                  <div style={styles.mathRow}>
                    <span>
                      {collectFromVendor ? 'Shop-held GMV' : 'Gross'} · {selected.size} bag
                      {selected.size === 1 ? '' : 's'}
                    </span>
                    <strong>{formatMoney(quoteGross ?? selectedTotal)}</strong>
                  </div>
                  <div style={styles.mathRow}>
                    <span>{collectFromVendor ? 'Commission to collect' : 'Billing fees'}</span>
                    <strong>
                      {collectFromVendor ? '' : '− '}
                      {formatMoney(commissionNum)}
                    </strong>
                  </div>
                  {!collectFromVendor ? (
                  <div style={styles.mathRow}>
                    <span>Claim deductions</span>
                    <strong style={pendingClaimChargebacks > 0 ? styles.claimAmt : undefined}>
                      − {formatMoney(pendingClaimChargebacks)}
                    </strong>
                  </div>
                  ) : null}
                  <div style={styles.mathRow}>
                    <span>{collectFromVendor ? 'Extra charge' : 'Penalty / other'}</span>
                    <strong>
                      {collectFromVendor ? '' : '− '}
                      {formatMoney(otherChargesNum)}
                    </strong>
                  </div>
                </div>

                <div style={styles.chargePanel}>
                  <label style={styles.label}>
                    {collectFromVendor ? 'Extra to collect (₹)' : 'Penalty / other charge (₹)'}
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
                        <li key={line}>{tidyFeeLine(line)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={styles.feeHint}>
                      {collectFromVendor
                        ? 'Fees include monthly subscription when due, plus commission / slabs on shop-held bags.'
                        : 'Select orders to calculate order commission / slabs. Monthly fee is on the other tab.'}
                    </p>
                  )}
                </div>

                {!collectFromVendor && pendingClaims.length > 0 ? (
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
              {collectFromVendor ? (
                <Button size="sm" disabled={!canSendBill} onClick={() => setConfirmBillOpen(true)}>
                  {saving ? 'Saving…' : `Send bill to vendor · ${formatMoney(expectedNet)}`}
              </Button>
              ) : null}
              <Button
                size="sm"
                variant={collectFromVendor ? 'secondary' : undefined}
                disabled={!canPay}
                onClick={requestMarkPaid}
              >
                {saving
                  ? 'Saving…'
                  : netPending
                    ? 'Calculating…'
                    : collectFromVendor
                      ? `Mark received · ${formatMoney(expectedNet)}`
                      : `Mark paid · ${formatMoney(expectedNet)}`}
              </Button>
              {!canPay && payHint ? <p style={styles.payHint}>{payHint}</p> : null}
              <Button size="sm" variant="secondary" onClick={() => void reload()} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </Card>
        </aside>
      </div>
            }
            payRecords={vendorRecordsSection}
            collectRecords={vendorRecordsSection}
            subscriptionDueCount={subscriptionDueCount}
            needsActionCount={vendorNeedsAction}
            subscriptionSection={
              <SubscriptionBillsPanel
                key={vendorId}
                token={token}
                townId={townId}
                vendorId={vendorId}
                vendorName={selectedVendor?.shopName || selectedVendor?.businessName}
                vendor={selectedVendor}
                town={towns.find((t) => t.id === townId) ?? null}
                payoutMethod={payoutMethod}
                transactionReference={transactionReference}
                transactionNotes={transactionNotes}
                onDueCount={setSubscriptionDueCount}
                onCollected={(msg) => {
                  setError(null);
                  setSuccess(msg);
                  setTransactionReference('');
                  setTransactionNotes('');
                }}
                onError={(msg) => setError(msg)}
              />
            }
          />
          )}
      </div>

      <ConfirmDialog
        open={confirmPayOpen}
        title={collectFromVendor ? 'Confirm collection from vendor?' : 'Confirm vendor payout?'}
        description={
          collectFromVendor
            ? `Receive ${formatMoney(expectedNet)} from ${selectedVendor?.shopName || selectedVendor?.businessName || 'vendor'}${selected.size > 0 ? ` · close ${selected.size} shop-held bag${selected.size === 1 ? '' : 's'}` : ' · monthly / extra only'}.\n\n${payoutMethod} · ref ${transactionReference.trim()}\n\nThis cannot be undone from here.`
            : `Pay ${formatMoney(expectedNet)} to ${selectedVendor?.shopName || selectedVendor?.businessName || 'vendor'} for ${selected.size} bag${selected.size === 1 ? '' : 's'}.\n\n${payoutMethod} · ref ${transactionReference.trim()}\n\nThis cannot be undone from here. Check UTR and amount before confirming.`
        }
        confirmLabel={collectFromVendor ? 'Yes, mark received' : 'Yes, mark paid'}
        cancelLabel="Cancel"
        danger={false}
        busy={saving}
        onClose={() => {
          if (!saving) setConfirmPayOpen(false);
        }}
        onConfirm={() => void submitPayout()}
      />
      <ConfirmDialog
        open={confirmBillOpen}
        title="Send bill to vendor?"
        description={
          <div style={styles.dlgBody}>
            <div style={styles.dlgHero}>
              <span style={styles.dlgHeroLabel}>Bill amount</span>
              <strong style={styles.dlgHeroValue}>{formatMoney(expectedNet)}</strong>
              <span>{selectedVendor?.shopName || selectedVendor?.businessName || 'Vendor'}</span>
                          </div>
            <div style={styles.dlgRow}>
              <span>Shop-held bags</span>
              <strong>{selected.size}</strong>
            </div>
            <div style={styles.dlgRow}>
              <span>Commission</span>
              <strong>{formatMoney(commissionNum)}</strong>
            </div>
            {otherChargesNum > 0 ? (
              <div style={styles.dlgRow}>
                <span>Extra charge{otherChargesReason.trim() ? ` · ${otherChargesReason.trim()}` : ''}</span>
                <strong>{formatMoney(otherChargesNum)}</strong>
              </div>
                          ) : null}
            <div style={styles.dlgRow}>
              <span>Period</span>
              <strong>
                {from} → {to}
              </strong>
                            </div>
            <p style={styles.dlgNote}>
              The vendor sees this bill on their Payouts page, pays and enters the UTR. You then confirm or reject it in
              Records.
            </p>
          </div>
        }
        confirmLabel="Yes, send bill"
        cancelLabel="Cancel"
        danger={false}
        busy={saving}
        onClose={() => {
          if (!saving) setConfirmBillOpen(false);
        }}
        onConfirm={() => void sendCollectionBill()}
      />
      <ConfirmDialog
        open={billAsk != null}
        title={billAsk?.kind === 'reject' ? 'Reject vendor payment?' : 'Confirm payment received?'}
        description={
          billAsk ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>{billAsk.s.serviceInvoiceNumber ?? 'Bill'}</span>
                <strong style={styles.dlgHeroValue}>{formatMoney(billAsk.s.netAmount)}</strong>
                <span>{displayPayeeLabel(billAsk.s.payeeName, billAsk.s.payeeId, billAsk.s.payeeType ?? 'VENDOR')}</span>
              </div>
              <div style={styles.dlgRow}>
                <span>Vendor paid by</span>
                <strong>
                  {billAsk.s.vendorPaymentMethod ?? '—'} · {billAsk.s.vendorPaymentReference ?? '—'}
                </strong>
              </div>
              {(billComments[billAsk.s.id] ?? '').trim() ? (
                <div style={styles.dlgRow}>
                  <span>Your comment</span>
                  <strong>{(billComments[billAsk.s.id] ?? '').trim()}</strong>
                </div>
                      ) : null}
              <p style={styles.dlgNote}>
                {billAsk.kind === 'reject'
                  ? 'The vendor sees your comment and can pay / resend the details.'
                  : "Check the money reached KoyaKart's account before confirming."}
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={billAsk?.kind === 'reject' ? 'Yes, reject' : 'Yes, received'}
        cancelLabel="Cancel"
        danger={billAsk?.kind === 'reject'}
        busy={billActionId != null}
        onClose={() => {
          if (billActionId == null) setBillAsk(null);
        }}
        onConfirm={() => {
          const ask = billAsk;
          if (!ask) return;
          void (ask.kind === 'reject' ? rejectBillPayment(ask.s) : confirmBillPayment(ask.s)).finally(() =>
            setBillAsk(null),
          );
        }}
      />
      <ConfirmDialog
        open={correctAsk != null}
        title="Update this payout?"
        description={
          correctAsk ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>Vendor not received</span>
                <strong style={styles.dlgHeroValue}>{formatMoney(correctAsk.netAmount)}</strong>
                <span>{displayPayeeLabel(correctAsk.payeeName, correctAsk.payeeId, correctAsk.payeeType)}</span>
          </div>
              <div style={styles.dlgRow}>
                <span>Mode</span>
                <strong>{correctMethod}</strong>
              </div>
              <div style={styles.dlgRow}>
                <span>Txn ref</span>
                <strong>{correctRef.trim() || '—'}</strong>
              </div>
              {correctNotes.trim() ? (
                <div style={styles.dlgRow}>
                  <span>Note</span>
                  <strong>{correctNotes.trim()}</strong>
                </div>
              ) : null}
              <p style={styles.dlgNote}>
                The vendor is asked to check again. It stays Vendor not received until they confirm.
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="Yes, update"
        cancelLabel="Cancel"
        danger={false}
        busy={billActionId != null}
        onClose={() => {
          if (billActionId == null) setCorrectAsk(null);
        }}
        onConfirm={() => {
          if (correctAsk) void saveCorrect(correctAsk);
        }}
      />
      </>
      ) : null}
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
.sp-joined {
  gap: 0;
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
  tabs: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.35rem' },
  tab: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 650,
    fontFamily: 'inherit',
  },
  tabActive: {
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  cardPad: { display: 'grid', gap: '0.45rem' },
  joinedTable: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTop: '1px solid #fed7aa',
    borderColor: '#fed7aa',
    marginTop: 0,
    boxShadow: 'none',
  },
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
  tableHint: { margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  tfootLabel: {
    padding: '0.4rem 0.45rem',
    borderTop: '2px solid var(--border)',
    fontWeight: 800,
    fontSize: '0.78rem',
    textAlign: 'right',
    color: 'var(--text-muted)',
  },
  tfootAmt: {
    padding: '0.4rem 0.45rem',
    borderTop: '2px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    fontSize: '0.88rem',
    fontVariantNumeric: 'tabular-nums',
  },
  feeError: { margin: 0, fontSize: '0.72rem', color: '#b91c1c', fontWeight: 650, lineHeight: 1.3 },
  sideActions: { display: 'grid', gap: '0.35rem' },
  payHint: { margin: 0, color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.3 },
  billBox: { display: 'grid', gap: '0.2rem', minWidth: 190 },
  billPaidBadge: {
    fontSize: '0.64rem',
    color: '#1d4ed8',
    background: '#dbeafe',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 800,
    justifySelf: 'start',
  },
  billRejectBadge: {
    fontSize: '0.64rem',
    color: '#991b1b',
    background: '#fee2e2',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 800,
    justifySelf: 'start',
  },
  billReason: { fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 },
  billInput: {
    minHeight: 30,
    padding: '0.2rem 0.4rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: '0.75rem',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  billActions: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
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
  dlgHeroLabel: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' },
  dlgHeroValue: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand, #0C831F)', lineHeight: 1.15 },
  dlgRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.2rem 0',
    borderBottom: '1px dashed var(--border)',
  },
  dlgNote: { margin: '0.25rem 0 0', fontSize: '0.8rem' },
  req: { color: '#b91c1c', fontWeight: 800 },
  claimAmt: { color: '#7c3aed' },
  claimList: {
    margin: 0,
    paddingLeft: '1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  notReceived: {
    marginTop: '0.2rem',
    display: 'grid',
    gap: '0.15rem',
    color: '#9a3412',
    fontWeight: 800,
    fontSize: '0.72rem',
  },
  correctBox: { display: 'grid', gap: '0.25rem', marginTop: '0.2rem', minWidth: '9rem' },
  remindBtn: {
    marginTop: '0.25rem',
    minHeight: 28,
    padding: '0.15rem 0.55rem',
    borderRadius: 8,
    border: '1px solid #b45309',
    background: '#fffbeb',
    color: '#78350f',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  headChecks: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  checkInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
  },
  ordersToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.35rem 0.75rem',
    marginBottom: '0.4rem',
  },
  searchInput: {
    flex: '1 1 12rem',
    minWidth: 0,
    maxWidth: '20rem',
    padding: '0.35rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(52vh, 520px)',
    overflowY: 'auto',
  },
  tableWrapPaged: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  tableWrapWide: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  tableInAudit: {
    overflowX: 'auto',
    minWidth: 0,
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
  td: { padding: '0.28rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMuted: {
    padding: '0.28rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
    fontSize: '0.76rem',
  },
  tdRight: {
    padding: '0.28rem 0.4rem',
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
  codAgentBadge: {
    display: 'inline-block',
    marginTop: '0.15rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#c2410c',
    background: '#ffedd5',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.32rem',
  },
  codHubBadge: {
    display: 'inline-block',
    marginTop: '0.15rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#1d4ed8',
    background: '#dbeafe',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.32rem',
  },
  codVendorBadge: {
    display: 'inline-block',
    marginTop: '0.15rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#047857',
    background: '#d1fae5',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.32rem',
  },
  codDeclaredBadge: {
    display: 'inline-block',
    marginTop: '0.15rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    color: '#7c2d12',
    background: '#ffedd5',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.32rem',
  },
  onlinePayHint: {
    display: 'block',
    marginTop: '0.1rem',
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  codAgentHeldBy: { display: 'grid', gap: '0.15rem', marginTop: '0.05rem' },
  codAgentHeldRow: {
    margin: 0,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem 0.4rem',
    alignItems: 'baseline',
    fontSize: '0.72rem',
    fontWeight: 650,
    color: '#9a3412',
  },
  agentPhoneLink: {
    color: 'var(--accent)',
    fontWeight: 800,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  codAgentOrderList: {
    margin: '0.1rem 0 0',
    padding: '0.35rem 0.45rem',
    listStyle: 'none',
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.68rem',
    fontWeight: 650,
    lineHeight: 1.35,
    borderRadius: 'var(--radius-md)',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
  },
  codAgentOrderHint: { color: 'var(--text-muted)', fontWeight: 600 },
  cashSplit: {
    display: 'grid',
    gap: '0.2rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  cashSplitTitle: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  cashSplitHint: {
    margin: '0.15rem 0 0',
    fontSize: '0.68rem',
    color: '#b45309',
    lineHeight: 1.35,
    fontWeight: 600,
  },
  codWarnAmt: { color: '#c2410c' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
};
