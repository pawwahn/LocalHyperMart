import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner, Card, ConfirmDialog } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchSalesReport, formatMoney, type SalesReportRow } from '@/features/reports/api/reportsApi';
import { fetchSupplierBillProfile } from '@/features/orders/api/platformSettingsApi';
import { fetchMyShop } from '@/features/shop/api/shopApi';
import { listEnabledTowns } from '@/features/towns/api/townsApi';
import { apiRequest } from '@/shared/api/http';
import {
  downloadVendorServiceBill,
  gstStateCodeFromGstin,
  gstStateCodeFromTown,
  stateNameFor,
  subscriptionBillAsSettlement,
  type BillParty,
} from '@/features/payouts/vendorBill';
import {
  PAYOUT_ACKED_EVENT,
  PAYOUT_ACTION_EVENT,
  acknowledgeSettlement,
  reportPayoutNotReceived,
  fetchMySubscriptionBills,
  isCollectionSettlement,
  isSubscriptionSettlement,
  listMyClaimAdjustments,
  listMySettlements,
  lookupOrderCashHolders,
  lookupOrderPayouts,
  paySubscriptionBill,
  payVendorBill,
  isOpenVendorBill,
  quoteMyFees,
  resolveCashHolder,
  settlementClaimAmount,
  settlementOtherChargesAmount,
  summarizeSettlements,
  type OrderCashHolder,
  type OrderPayout,
  type SubscriptionBill,
  type VendorClaimAdjustment,
  type VendorFeeQuote,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';
import { awaitingDeliveredRows, isShopHeldCash } from '@/features/payouts/vendorPayable';
import {
  PAGE_SIZES,
  SortableTh,
  TablePager,
  compareText,
  pageWindow,
  toggleSort,
  type SortState,
} from '@/shared/table';
import { ClaimDeductionsDialog } from '@/features/payouts/components/ClaimDeductionsDialog';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import {
  DEFAULT_REPORT_DATE_PRESET,
  isoIstDate,
  rangeForReportPreset,
  type TransferHistoryPreset,
} from '@hlm-dates/istReportPresets';

type PayoutPane = 'settlements' | 'awaiting' | 'orders' | 'subscription' | 'subscriptionHistory';
type SortKey = 'period' | 'gross' | 'fee' | 'claims' | 'other' | 'net' | 'status' | 'paidAt';
type AwaitingSortKey = 'placed' | 'order' | 'pay' | 'cash' | 'amount';

const PAYOUT_DATE_OPTIONS: { id: TransferHistoryPreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7d' },
  { id: 'days30', label: '30d' },
  { id: 'month', label: 'This month' },
  { id: 'previousMonth', label: 'Prev month' },
  { id: 'q1', label: 'Q1' },
  { id: 'q2', label: 'Q2' },
  { id: 'q3', label: 'Q3' },
  { id: 'q4', label: 'Q4' },
  { id: 'firstHalf', label: 'HY1' },
  { id: 'secondHalf', label: 'HY2' },
  { id: 'annual', label: 'CY' },
  { id: 'financialYear', label: 'FY' },
  { id: 'custom', label: 'Custom' },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoIstDate(d);
}

/** Sales report allows 366 days. All time uses that full window so older paid bags stay in Total sales. */
const SALES_LOOKBACK_DAYS = 365;

function salesQueryRange(periodFrom: string, periodTo: string): { from: string; to: string } {
  const today = isoIstDate();
  const to = periodTo || today;
  let from = periodFrom || isoDaysAgo(SALES_LOOKBACK_DAYS);
  const fromDate = parseDay(from);
  const toDate = parseDay(to);
  if (fromDate && toDate) {
    const earliest = new Date(toDate);
    earliest.setDate(earliest.getDate() - SALES_LOOKBACK_DAYS);
    if (fromDate < earliest) from = isoIstDate(earliest);
    if (from > to) from = to;
  }
  return { from, to };
}

/** IST calendar day of an order timestamp — matches the admin date filter (a 12:53 am IST order is that day, not the UTC day before). */
function istDayOf(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : isoIstDate(d);
}

/** Payout windows go by delivery (cash collected / goods handed over); placed time only if delivery time is missing. */
function payoutAt(row: SalesReportRow): string | null | undefined {
  return row.deliveredAt || row.placedAt;
}

function shortWhen(iso?: string | null): string {
  return iso
    ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/** Parse YYYY-MM-DD (or ISO datetime) as a local calendar day — avoid UTC day-shift. */
function parseDay(value?: string | null): Date | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDay(value?: string | null): string {
  const d = parseDay(value);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** e.g. 1–10 Jul 2026 or 28 Jun – 5 Aug 2026 */
function formatPeriodRange(start?: string | null, end?: string | null): string {
  const a = parseDay(start);
  const b = parseDay(end ?? start);
  if (!a && !b) return '—';
  if (!a) return formatDay(end);
  if (!b) return formatDay(start);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === b.getDate()) {
    return formatDay(start);
  }
  if (sameMonth) {
    const monthYear = a.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return `${a.getDate()}–${b.getDate()} ${monthYear}`;
  }
  if (sameYear) {
    const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${left} – ${right}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** Month the money was sent, when it differs from the window's month (e.g. Sept orders paid in Oct). */
function paidLaterMonth(s: VendorSettlement): string | null {
  if (s.status !== 'PAID') return null;
  const paidDay = istDayOf(s.paidAt);
  const windowEnd = (s.periodEnd ?? s.periodStart ?? '').slice(0, 10);
  if (!paidDay || !windowEnd || paidDay.slice(0, 7) <= windowEnd.slice(0, 7)) return null;
  const d = parseDay(paidDay);
  return d ? d.toLocaleDateString(undefined, { month: 'short' }) : null;
}

function formatPaidAt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isShopHeld(holder: OrderCashHolder): boolean {
  return isShopHeldCash(holder);
}

type AwaitingSplit = {
  payCount: number;
  payGross: number;
  payFee: number;
  payNet: number;
  shopCount: number;
  shopGross: number;
  shopFee: number;
};

function splitAwaiting(
  rows: SalesReportRow[],
  holders: Record<string, OrderCashHolder>,
  fees: Record<string, number>,
): AwaitingSplit {
  const out: AwaitingSplit = {
    payCount: 0,
    payGross: 0,
    payFee: 0,
    payNet: 0,
    shopCount: 0,
    shopGross: 0,
    shopFee: 0,
  };
  for (const row of rows) {
    const amount = Number(row.subtotal ?? 0);
    const fee = fees[row.subOrderId] ?? 0;
    if (isShopHeld(resolveCashHolder(row, holders[row.subOrderId]))) {
      out.shopCount += 1;
      out.shopGross += amount;
      out.shopFee += fee;
    } else {
      out.payCount += 1;
      out.payGross += amount;
      out.payFee += fee;
    }
  }
  out.payNet = Math.max(0, out.payGross - out.payFee);
  return out;
}

function holderChip(role?: string | null): CSSProperties {
  const key = (role ?? '').toUpperCase();
  const tone =
    key === 'VENDOR'
      ? { color: '#14532d', background: '#dcfce7' }
      : key === 'VENDOR_AGENT'
        ? { color: '#115e59', background: '#ccfbf1' }
        : key === 'HUB_ADMIN'
          ? { color: '#1e3a8a', background: '#dbeafe' }
          : key === 'HUB_AGENT'
            ? { color: '#9a3412', background: '#ffedd5' }
            : { color: '#334155', background: '#e2e8f0' };
  return {
    display: 'inline-block',
    fontSize: '0.68rem',
    fontWeight: 800,
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    ...tone,
  };
}

/**
 * Paid settlements belong to the IST day the money was sent (one period each — no double counting across months,
 * matches the bank statement and the invoice month). Open ones have no paid day, so they match on delivery window.
 */
function settlementOverlapsRange(
  s: VendorSettlement,
  from: string,
  to: string,
): boolean {
  const paidDay = s.status === 'PAID' ? istDayOf(s.paidAt) : '';
  if (paidDay) {
    if (from && paidDay < from) return false;
    if (to && paidDay > to) return false;
    return true;
  }
  const start = (s.periodStart ?? s.periodEnd ?? '').slice(0, 10);
  const end = (s.periodEnd ?? s.periodStart ?? '').slice(0, 10);
  if (!start && !end) return true;
  if (from && end && end < from) return false;
  if (to && start && start > to) return false;
  return true;
}

export function PayoutsPage() {
  const { session } = useAuth();
  const [settlements, setSettlements] = useState<VendorSettlement[]>([]);
  const [claimAdjustments, setClaimAdjustments] = useState<VendorClaimAdjustment[]>([]);
  const [awaitingRows, setAwaitingRows] = useState<SalesReportRow[]>([]);
  const [deliveredRows, setDeliveredRows] = useState<SalesReportRow[]>([]);
  const [subscriptionBills, setSubscriptionBills] = useState<SubscriptionBill[]>([]);
  const [orderPayouts, setOrderPayouts] = useState<Record<string, OrderPayout>>({});
  const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null);
  const [cashHolders, setCashHolders] = useState<Record<string, OrderCashHolder>>({});
  const [feeQuote, setFeeQuote] = useState<VendorFeeQuote | null>(null);
  const [rowFees, setRowFees] = useState<Record<string, number>>({});
  const [holdersReady, setHoldersReady] = useState(false);
  const [pane, setPane] = useState<PayoutPane | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'OPEN'>('all');
  const openingPeriod = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
  const [datePreset, setDatePreset] = useState<TransferHistoryPreset>(DEFAULT_REPORT_DATE_PRESET);
  const [periodFrom, setPeriodFrom] = useState(openingPeriod.from);
  const [periodTo, setPeriodTo] = useState(openingPeriod.to);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'period', dir: 'asc' });
  const [awaitingSort, setAwaitingSort] = useState<SortState<AwaitingSortKey>>({ key: 'placed', dir: 'asc' });
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [supplier, setSupplier] = useState<BillParty | null>(null);
  const [recipient, setRecipient] = useState<BillParty | null>(null);
  useEffect(() => {
    function onAcked(e: Event) {
      const updated = (e as CustomEvent<VendorSettlement>).detail;
      if (!updated?.id) return;
      setSettlements((prev) =>
        prev.map((x) =>
          x.id === updated.id
            ? {
                ...x,
                vendorAcknowledgedAt: updated.vendorAcknowledgedAt,
                vendorNotReceivedAt: updated.vendorNotReceivedAt,
                vendorNotReceivedNote: updated.vendorNotReceivedNote,
              }
            : x,
        ),
      );
    }
    window.addEventListener(PAYOUT_ACKED_EVENT, onAcked);
    return () => window.removeEventListener(PAYOUT_ACKED_EVENT, onAcked);
  }, []);

  const [payTarget, setPayTarget] = useState<SubscriptionBill | null>(null);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const [payBill, setPayBill] = useState<VendorSettlement | null>(null);
  const [payIntent, setPayIntent] = useState<'pay' | 'again' | 'correct'>('pay');

  function knownPayMethod(raw?: string | null): string {
    const method = (raw || '').toUpperCase();
    if (method === 'UPI' || method === 'BANK_TRANSFER' || method === 'CASH' || method === 'CHEQUE') return method;
    if (method === 'BANK' || method === 'NEFT' || method === 'IMPS' || method === 'RTGS') return 'BANK_TRANSFER';
    return 'UPI';
  }

  function openPay(b: SubscriptionBill, intent: 'pay' | 'again' | 'correct' = 'pay') {
    setPayIntent(intent);
    if (intent === 'correct') {
      setPayMethod(knownPayMethod(b.vendorPaymentMethod));
      setPayRef(b.vendorPaymentReference ?? '');
      setPayNotes(b.vendorPaymentNotes ?? '');
    } else {
      setPayMethod('UPI');
      setPayRef('');
      setPayNotes('');
    }
    setPayBill(null);
    setPayTarget(b);
  }

  function openPayBill(s: VendorSettlement, intent: 'pay' | 'again' | 'correct' = 'pay') {
    setPayIntent(intent);
    if (intent === 'correct') {
      setPayMethod(knownPayMethod(s.vendorPaymentMethod));
      setPayRef(s.vendorPaymentReference ?? '');
      setPayNotes(s.vendorPaymentNotes ?? '');
    } else {
      setPayMethod('UPI');
      setPayRef('');
      setPayNotes('');
    }
    setPayTarget(null);
    setPayBill(s);
  }

  function closePay() {
    setPayTarget(null);
    setPayBill(null);
  }

  async function submitPay() {
    if (!session?.accessToken || !session.vendorId || !payRef.trim()) return;
    const input = {
      payoutMethod: payMethod,
      transactionReference: payRef.trim(),
      transactionNotes: payNotes.trim() || undefined,
    };
    setPaying(true);
    try {
      if (payBill) {
        const updated = await payVendorBill(session.accessToken, session.vendorId, payBill.id, input);
        setSettlements((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      } else if (payTarget?.settlementId) {
        const updated = await paySubscriptionBill(session.accessToken, session.vendorId, payTarget.settlementId, input);
        setSubscriptionBills((prev) => prev.map((x) => (x.month === updated.month ? updated : x)));
      }
      closePay();
      window.dispatchEvent(new CustomEvent(PAYOUT_ACTION_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit payment');
      closePay();
    } finally {
      setPaying(false);
    }
  }

  const openBills = useMemo(() => settlements.filter(isOpenVendorBill), [settlements]);

  const [ackTarget, setAckTarget] = useState<VendorSettlement | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [ackDispute, setAckDispute] = useState(false);

  function closeAck() {
    setAckTarget(null);
    setAckNote('');
    setAckDispute(false);
  }

  async function confirmAcknowledge() {
    const s = ackTarget;
    if (!s || !session?.accessToken || !session.vendorId) return;
    setAckingId(s.id);
    try {
      const updated = await acknowledgeSettlement(session.accessToken, session.vendorId, s.id);
      setSettlements((prev) => prev.map((x) => (x.id === s.id ? { ...x, vendorAcknowledgedAt: updated.vendorAcknowledgedAt } : x)));
      window.dispatchEvent(new CustomEvent(PAYOUT_ACTION_EVENT));
      closeAck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm receipt');
      closeAck();
    } finally {
      setAckingId(null);
    }
  }

  async function sendAckMissing() {
    const s = ackTarget;
    const note = ackNote.trim();
    if (!s || !note || !session?.accessToken || !session.vendorId) return;
    setAckingId(s.id);
    try {
      const updated = await reportPayoutNotReceived(session.accessToken, session.vendorId, s.id, note);
      setSettlements((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? {
                ...x,
                vendorNotReceivedAt: updated.vendorNotReceivedAt,
                vendorNotReceivedNote: updated.vendorNotReceivedNote,
              }
            : x,
        ),
      );
      window.dispatchEvent(new CustomEvent(PAYOUT_ACTION_EVENT));
      closeAck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the comment');
    } finally {
      setAckingId(null);
    }
  }

  const loadBillParties = useCallback(
    async (token: string, vendorId: string, shopName?: string, phone?: string) => {
      const [shop, me, towns, from] = await Promise.all([
        fetchMyShop(token, vendorId).catch(() => null),
        apiRequest<{ gstNumber?: string | null; businessName?: string | null; phone?: string | null }>(
          '/api/v1/vendors/me',
          { token },
        ).catch(() => null),
        listEnabledTowns().catch(() => []),
        fetchSupplierBillProfile().catch(() => null),
      ]);
      const town = towns.find((t) => t.id === shop?.townId);
      const vendorGst = (me?.gstNumber ?? '').trim().toUpperCase();
      const vendorStateCode = gstStateCodeFromGstin(vendorGst) || gstStateCodeFromTown(town?.stateCode);
      setRecipient({
        legalName: shop?.shopName || shopName || me?.businessName || 'Shop',
        gstin: vendorGst,
        address: [shop?.address, shop?.pincode].filter(Boolean).join(', '),
        phone: shop?.phone || phone || me?.phone || '',
        stateName: stateNameFor(vendorStateCode, town?.state ?? ''),
        gstStateCode: vendorStateCode,
      });
      const supplierCode = gstStateCodeFromGstin(from?.gstin ?? '') || from?.gstStateCode || '';
      setSupplier({
        legalName: from?.legalName || 'KoyaKart',
        gstin: (from?.gstin ?? '').trim().toUpperCase(),
        address: from?.address || '',
        phone: from?.phone || '',
        stateName: stateNameFor(supplierCode, from?.stateName || ''),
        gstStateCode: supplierCode,
      });
    },
    [],
  );

  function supplierParty(): BillParty {
    return (
      supplier ?? {
        legalName: 'KoyaKart',
        gstin: '',
        address: '',
        phone: '',
        stateName: '',
        gstStateCode: '',
      }
    );
  }

  function recipientParty(): BillParty {
    return (
      recipient ?? {
        legalName: session?.shopName || 'Shop',
        gstin: '',
        address: '',
        phone: session?.phone || '',
        stateName: '',
        gstStateCode: '',
      }
    );
  }

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setHoldersReady(false);
    setError(null);
    try {
      const [list, sales, adjustmentsResult] = await Promise.all([
        listMySettlements(session.accessToken, session.vendorId),
        fetchSalesReport(session.accessToken, session.vendorId, {
          ...salesQueryRange(periodFrom, periodTo),
          includeItems: false,
        }),
        listMyClaimAdjustments(session.accessToken, session.vendorId).catch(() => [] as VendorClaimAdjustment[]),
      ]);
      setSettlements(list);
      setClaimAdjustments(adjustmentsResult);

      const payouts = await lookupOrderPayouts(
        session.accessToken,
        session.vendorId,
        (sales.rows ?? []).map((r) => r.subOrderId),
      );
      const delivered: SalesReportRow[] = [];
      for (const row of sales.rows ?? []) {
        if (row.status !== 'DELIVERED') continue;
        delivered.push(row);
      }
      const unpaid = awaitingDeliveredRows(sales.rows ?? [], payouts);
      setAwaitingRows(unpaid);
      setDeliveredRows(delivered);
      setOrderPayouts(payouts);
      void fetchMySubscriptionBills(session.accessToken, session.vendorId)
        .then(setSubscriptionBills)
        .catch(() => setSubscriptionBills([]));
      const holders = unpaid.length
        ? await lookupOrderCashHolders(
            session.accessToken,
            session.vendorId,
            unpaid.map((r) => r.subOrderId),
          ).catch(() => ({} as Record<string, OrderCashHolder>))
        : {};
      setCashHolders(holders);
      setHoldersReady(true);
      void loadBillParties(session.accessToken, session.vendorId, session.shopName, session.phone);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payouts');
      setAwaitingRows([]);
      setDeliveredRows([]);
      setOrderPayouts({});
      setCashHolders({});
      setHoldersReady(true);
      setClaimAdjustments([]);
    } finally {
      setLoading(false);
    }
  }, [session, periodFrom, periodTo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const periodSettlements = useMemo(
    () =>
      settlements.filter(
        (s) =>
          !isSubscriptionSettlement(s) &&
          (!(periodFrom || periodTo) || settlementOverlapsRange(s, periodFrom, periodTo)),
      ),
    [settlements, periodFrom, periodTo],
  );
  const settlementSummary = useMemo(() => summarizeSettlements(periodSettlements), [periodSettlements]);

  const pendingClaimDebits = useMemo(
    () => claimAdjustments.filter((a) => a.status === 'PENDING'),
    [claimAdjustments],
  );
  const pendingClaimDebitTotal = useMemo(
    () => pendingClaimDebits.reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    [pendingClaimDebits],
  );
  const appliedClaimDebitTotal = useMemo(
    () =>
      claimAdjustments
        .filter((a) => a.status === 'APPLIED')
        .reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    [claimAdjustments],
  );

  const usingSettlementAwaiting = settlementSummary.awaitingSettlementNet > 0;
  const feeTermsLabel = useMemo(() => {
    const raw = feeQuote?.appliedSlabLabel || feeQuote?.breakdownLines?.[0] || feeQuote?.feeModel || null;
    if (!raw) return null;
    const pct = raw.match(/(\d+(?:\.\d+)?)%/);
    if (pct) return `Rate ${Number(pct[1])}% of bag total`;
    return raw.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
  }, [feeQuote]);

  const filtered = useMemo(() => {
    return periodSettlements.filter((s) => {
      if (statusFilter === 'PAID' && s.status !== 'PAID') return false;
      if (statusFilter === 'OPEN' && s.status === 'PAID') return false;
      return true;
    });
  }, [periodSettlements, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case 'period':
          cmp = compareText(a.periodEnd ?? a.periodStart ?? '', b.periodEnd ?? b.periodStart ?? '');
          break;
        case 'gross':
          cmp = Number(a.grossAmount) - Number(b.grossAmount);
          break;
        case 'fee':
          cmp = Number(a.commissionAmount) - Number(b.commissionAmount);
          break;
        case 'claims':
          cmp = settlementClaimAmount(a) - settlementClaimAmount(b);
          break;
        case 'other':
          cmp = settlementOtherChargesAmount(a) - settlementOtherChargesAmount(b);
          break;
        case 'net':
          cmp = Number(a.netAmount) - Number(b.netAmount);
          break;
        case 'status':
          cmp = compareText(a.status, b.status);
          break;
        case 'paidAt':
          cmp = compareText(a.paidAt ?? '', b.paidAt ?? '');
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return rows;
  }, [filtered, sort]);

  const settlementTotals = useMemo(
    () =>
      filtered.reduce(
        (acc, s) => ({
          gross: acc.gross + Number(s.grossAmount ?? 0),
          commission: acc.commission + Number(s.commissionAmount ?? 0),
          claims: acc.claims + settlementClaimAmount(s),
          other: acc.other + settlementOtherChargesAmount(s),
          net: acc.net + (isCollectionSettlement(s) ? 0 : Number(s.netAmount ?? 0)),
          paidCount: acc.paidCount + (s.status === 'PAID' ? 1 : 0),
        }),
        { gross: 0, commission: 0, claims: 0, other: 0, net: 0, paidCount: 0 },
      ),
    [filtered],
  );

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(sorted, page, pageSize),
    [sorted, page, pageSize],
  );
  const awaitingVendorAck = filtered.filter(
    (s) =>
      s.status === 'PAID' &&
      !isCollectionSettlement(s) &&
      !isOpenVendorBill(s) &&
      !s.vendorAcknowledgedAt,
  ).length;

  const visibleAwaiting = useMemo(() => {
    return awaitingRows.filter((row) => {
      if (!periodFrom && !periodTo) return true;
      const day = istDayOf(payoutAt(row));
      if (!day) return true;
      if (periodFrom && day < periodFrom) return false;
      if (periodTo && day > periodTo) return false;
      return true;
    });
  }, [awaitingRows, periodFrom, periodTo]);

  const awaitingSorted = useMemo(() => {
    const rows = [...visibleAwaiting];
    const dir = awaitingSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (awaitingSort.key) {
        case 'placed':
          cmp = compareText(payoutAt(a) ?? '', payoutAt(b) ?? '');
          break;
        case 'order':
          cmp = compareText(a.orderNumber ?? '', b.orderNumber ?? '');
          break;
        case 'pay':
          cmp = compareText(a.paymentMethod ?? '', b.paymentMethod ?? '');
          break;
        case 'cash': {
          const ha = resolveCashHolder(a, cashHolders[a.subOrderId]);
          const hb = resolveCashHolder(b, cashHolders[b.subOrderId]);
          cmp = compareText(
            `${ha.holderLabel} ${ha.holderDetail ?? ''}`,
            `${hb.holderLabel} ${hb.holderDetail ?? ''}`,
          );
          break;
        }
        case 'amount':
          cmp = Number(a.subtotal ?? 0) - Number(b.subtotal ?? 0);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return rows;
  }, [visibleAwaiting, awaitingSort, cashHolders]);

  const subscriptionPaidBills = subscriptionBills.filter((b) => b.status === 'PAID');
  const activePane: PayoutPane = (() => {
    const fallback: PayoutPane = settlements.length > 0 ? 'settlements' : 'awaiting';
    if (pane === 'subscription' && subscriptionBills.length === 0) return fallback;
    if (pane === 'subscriptionHistory' && subscriptionPaidBills.length === 0) return fallback;
    return pane ?? fallback;
  })();
  const subscriptionPane = activePane === 'subscription' || activePane === 'subscriptionHistory';

  const awaitingPaged = useMemo(
    () => pageWindow(awaitingSorted, page, pageSize),
    [awaitingSorted, page, pageSize],
  );

  const visibleOrders = useMemo(() => {
    return deliveredRows
      .filter((row) => {
        if (!periodFrom && !periodTo) return true;
        const day = istDayOf(payoutAt(row));
        if (!day) return true;
        if (periodFrom && day < periodFrom) return false;
        if (periodTo && day > periodTo) return false;
        return true;
      })
      .sort((a, b) => compareText(payoutAt(b) ?? '', payoutAt(a) ?? ''));
  }, [deliveredRows, periodFrom, periodTo]);

  const ordersPaged = useMemo(
    () => pageWindow(visibleOrders, page, pageSize),
    [visibleOrders, page, pageSize],
  );

  /** Settlement commission spread over its bags by bag value, so per-order fees sum to what was charged. */
  const settledLineMoney = useMemo(() => {
    const map: Record<string, { fee: number; collection: boolean }> = {};
    const claims: Record<string, number> = {};
    for (const s of settlements) {
      const lines = s.lines ?? [];
      const orderLines = lines.filter((l) => {
        const t = (l.lineType ?? '').toUpperCase();
        return (t === 'ORDER' || t === '') && l.subOrderId;
      });
      for (const l of lines) {
        if ((l.lineType ?? '').toUpperCase() === 'ADJUSTMENT' && l.subOrderId) {
          claims[l.subOrderId] = (claims[l.subOrderId] ?? 0) + Math.abs(Number(l.amount ?? 0));
        }
      }
      const gross = orderLines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
      const totalFee = Number(s.commissionAmount ?? 0);
      const collection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
      let allocated = 0;
      orderLines.forEach((l, i) => {
        const fee =
          i === orderLines.length - 1
            ? Math.round((totalFee - allocated) * 100) / 100
            : gross > 0
              ? Math.round(((totalFee * Number(l.amount ?? 0)) / gross) * 100) / 100
              : 0;
        allocated += fee;
        map[l.subOrderId as string] = { fee, collection };
      });
    }
    return { map, claims };
  }, [settlements]);

  function orderMoney(row: SalesReportRow) {
    const amount = Number(row.subtotal ?? 0);
    const paid = Boolean(orderPayouts[row.subOrderId]?.paid);
    const settled = settledLineMoney.map[row.subOrderId];
    const claim = settledLineMoney.claims[row.subOrderId] ?? 0;
    const shopHeld = paid
      ? Boolean(settled?.collection)
      : isShopHeld(resolveCashHolder(row, cashHolders[row.subOrderId]));
    const fee = paid ? settled?.fee : (rowFees[row.subOrderId] as number | undefined);
    const net = fee == null ? null : amount - fee - claim;
    const owed = !paid && shopHeld ? fee ?? 0 : 0;
    return { amount, paid, shopHeld, fee, estimated: !paid, claim, net, owed };
  }

  const ordersTotals = useMemo(() => {
    const out = {
      paidCount: 0,
      paidGross: 0,
      paidFee: 0,
      paidNet: 0,
      unpaidCount: 0,
      unpaidGross: 0,
      unpaidFee: 0,
      unpaidNet: 0,
      claims: 0,
      owed: 0,
      owedCount: 0,
    };
    for (const row of visibleOrders) {
      const m = orderMoney(row);
      out.claims += m.claim;
      out.owed += m.owed;
      if (m.owed > 0) out.owedCount += 1;
      if (m.paid) {
        out.paidCount += 1;
        out.paidGross += m.amount;
        out.paidFee += m.fee ?? 0;
        out.paidNet += m.net ?? m.amount;
      } else {
        out.unpaidCount += 1;
        out.unpaidGross += m.amount;
        out.unpaidFee += m.fee ?? 0;
        out.unpaidNet += m.net ?? m.amount;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleOrders, orderPayouts, settledLineMoney, rowFees, cashHolders]);

  const periodFilterActive = Boolean(periodFrom || periodTo);

  const periodSplit = useMemo(
    () => splitAwaiting(visibleAwaiting, cashHolders, rowFees),
    [visibleAwaiting, cashHolders, rowFees],
  );
  const periodAwaitingFee = periodSplit.payFee + periodSplit.shopFee;
  const estUnpaidFee = periodAwaitingFee;

  /** Open settlements are already net of fees; otherwise only bags whose cash KoyaKart / hub holds are paid out. */
  const awaitingDisplayAmount = usingSettlementAwaiting
    ? Math.max(0, settlementSummary.awaitingSettlementNet - pendingClaimDebitTotal)
    : Math.max(0, periodSplit.payNet - pendingClaimDebitTotal);

  const awaitingMonthsLabel = useMemo(() => {
    const months = new Set<string>();
    for (const row of visibleAwaiting) {
      if (isShopHeld(resolveCashHolder(row, cashHolders[row.subOrderId]))) continue;
      const at = payoutAt(row);
      if (!at) continue;
      months.add(
        new Date(at).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
      );
    }
    return [...months].join(', ');
  }, [visibleAwaiting, cashHolders]);

  const awaitingDisplayHint = usingSettlementAwaiting
    ? pendingClaimDebitTotal > 0
      ? `${settlementSummary.awaitingCount} open · after ${formatMoney(pendingClaimDebitTotal)} claims`
      : `${settlementSummary.awaitingCount} open settlement${settlementSummary.awaitingCount === 1 ? '' : 's'}`
    : periodSplit.payCount === 0
      ? 'Nothing pending'
      : [
          `${periodSplit.payCount} ${awaitingMonthsLabel ? `${awaitingMonthsLabel} ` : ''}bag${periodSplit.payCount === 1 ? '' : 's'} · ${formatMoney(periodSplit.payGross)}`,
          periodSplit.payFee > 0 ? `− ${formatMoney(periodSplit.payFee)} fee` : null,
          pendingClaimDebitTotal > 0 ? `− ${formatMoney(pendingClaimDebitTotal)} claims` : null,
        ]
          .filter(Boolean)
          .join(' ') + ' · arrives in next payout';

  const shopFeeOwed = periodSplit.shopFee;
  const shopCashCount = periodSplit.shopCount;
  const subscriptionDueBills = subscriptionBills.filter((b) => b.status !== 'PAID');
  const subscriptionDueTotal = subscriptionDueBills.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const subscriptionShown = [...(activePane === 'subscriptionHistory' ? subscriptionPaidBills : subscriptionDueBills)].sort(
    (a, b) => b.month.localeCompare(a.month),
  );
  const subscriptionMonthName = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  /**
   * Quote app/hub bags and shop-cash bags as separate batches — same grouping admin uses.
   * Quotes every unpaid bag (not just the date-filtered ones) so a bag's fee never depends on the filter.
   */
  useEffect(() => {
    if (!session || !holdersReady) return;
    const payRows: SalesReportRow[] = [];
    const shopRows: SalesReportRow[] = [];
    for (const row of awaitingRows) {
      (isShopHeld(resolveCashHolder(row, cashHolders[row.subOrderId])) ? shopRows : payRows).push(row);
    }
    let cancelled = false;
    const quoteGroup = (rows: SalesReportRow[]) =>
      rows.length
        ? quoteMyFees(
            session.accessToken,
            session.vendorId,
            rows.map((r) => ({ amount: Number(r.subtotal ?? 0), placedAt: r.placedAt })),
          ).catch(() => null)
        : Promise.resolve(null);
    void Promise.all([quoteGroup(payRows), quoteGroup(shopRows)]).then(([payQuote, shopQuote]) => {
      if (cancelled) return;
      const fees: Record<string, number> = {};
      let ok = true;
      for (const [rows, q] of [
        [payRows, payQuote],
        [shopRows, shopQuote],
      ] as const) {
        if (!rows.length) continue;
        if (!q?.lineFees || q.lineFees.length !== rows.length) {
          ok = false;
          continue;
        }
        rows.forEach((r, i) => {
          fees[r.subOrderId] = Number(q.lineFees?.[i] ?? 0);
        });
      }
      setRowFees(fees);
      setFeeQuote(ok ? payQuote ?? shopQuote : null);
    });
    return () => {
      cancelled = true;
    };
  }, [session, holdersReady, awaitingRows, cashHolders]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, periodFrom, periodTo, pageSize, sort, awaitingSort, activePane]);

  usePortalChrome({ title: 'Payouts', onRefresh: () => void reload() });

  return (
    <div
        style={{
          ...styles.pageStack,
          ['--metric-paid' as string]: 'var(--success, #15803d)',
          ['--metric-awaiting' as string]: 'var(--warning, #c2410c)',
          ['--metric-commission' as string]: 'var(--danger, #dc2626)',
          ['--metric-claim' as string]: '#7c3aed',
          ['--metric-other' as string]: '#b45309',
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}

        <div style={styles.summary}>
          <button
            type="button"
            style={{
              ...(activePane === 'orders' ? styles.metricOn : { ...styles.metric, cursor: 'pointer' }),
              borderTop: '3px solid #0f172a',
            }}
            onClick={() => setPane('orders')}
          >
            <span style={styles.metricLabel}>Total sales</span>
            <strong style={{ ...styles.metricValue, color: 'var(--text)' }}>
              {formatMoney(ordersTotals.paidGross + ordersTotals.unpaidGross)}
            </strong>
            <span style={styles.metricHint}>
              {visibleOrders.length} bag{visibleOrders.length === 1 ? '' : 's'} delivered
            </span>
          </button>

          <button
            type="button"
            style={{
              ...(activePane === 'settlements' ? styles.metricOn : { ...styles.metric, cursor: 'pointer' }),
              borderTop: '3px solid var(--metric-paid)',
            }}
            onClick={() => setPane('settlements')}
          >
            <span style={styles.metricLabel}>Net paid</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-paid)' }}>
              {formatMoney(settlementSummary.paidNet)}
            </strong>
            <span style={styles.metricHint}>
              <span style={{ ...styles.flowTag, ...styles.flowIn }}>Received</span>{' '}
              {settlementSummary.paidCount > 0
                ? `${settlementSummary.paidCount} settlement${settlementSummary.paidCount === 1 ? '' : 's'}`
                : periodFilterActive
                  ? 'None paid for this period'
                : 'None marked paid yet'}
            </span>
          </button>

          <button
            type="button"
            style={{
              ...(activePane === 'awaiting' ? styles.metricOnAwaiting : { ...styles.metric, cursor: 'pointer' }),
              borderTop: '3px solid var(--metric-awaiting)',
            }}
            onClick={() => setPane('awaiting')}
          >
            <span style={styles.metricLabel}>KoyaKart pays you</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-awaiting)' }}>
              {formatMoney(awaitingDisplayAmount)}
            </strong>
            <span style={styles.metricHint} title={awaitingDisplayHint}>
              <span style={{ ...styles.flowTag, ...styles.flowComing }}>Coming</span> {awaitingDisplayHint}
            </span>
          </button>

          {shopFeeOwed > 0 || openBills.length > 0 ? (
            <div style={{ ...styles.metric, borderTop: '3px solid var(--metric-commission)', gridColumn: 'span 2' }}>
              <span style={styles.metricLabel}>To KoyaKart</span>
              <strong style={styles.metricValueCommission}>{formatMoney(shopFeeOwed)}</strong>
              <span
                style={styles.metricHint}
                title={`Commission on ${shopCashCount} bag${shopCashCount === 1 ? '' : 's'} where cash stayed in your shop`}
              >
                <span style={{ ...styles.flowTag, ...styles.flowOut }}>You pay</span>{' '}
                {shopCashCount} cash bag{shopCashCount === 1 ? '' : 's'}
              </span>
              {openBills.map((s) => (
                <span
                  key={s.id}
                  style={styles.billLine}
                  title={
                    s.vendorPaymentRejectedAt
                      ? `Not received: ${s.vendorPaymentRejectReason ?? 'KoyaKart did not receive this payment'}`
                      : `${s.serviceInvoiceNumber ?? 'Bill'} · ${formatMoney(s.netAmount)}`
                  }
                >
                  <span
                    style={{
                      ...styles.subPill,
                      ...(s.vendorPaidAt
                        ? { color: '#1d4ed8', background: '#dbeafe' }
                        : s.vendorPaymentRejectedAt
                          ? { color: '#991b1b', background: '#fee2e2' }
                          : { color: '#9a3412', background: '#ffedd5' }),
                    }}
                  >
                    {s.vendorPaidAt ? 'Checking' : s.vendorPaymentRejectedAt ? 'Not received' : 'Bill due'}
                  </span>
                  <span style={styles.billActs}>
                    <button
                      type="button"
                      style={styles.linkBtn}
                      onClick={() => downloadVendorServiceBill(s, supplierParty(), recipientParty())}
                    >
                      Bill
                    </button>
                    {!s.vendorPaidAt ? (
                      s.vendorPaymentRejectedAt ? (
                        <>
                          <button type="button" style={styles.payBtn} onClick={() => openPayBill(s, 'again')}>
                            Pay again
                          </button>
                          <button type="button" style={styles.correctBtn} onClick={() => openPayBill(s, 'correct')}>
                            Correct
                          </button>
                        </>
                      ) : (
                        <button type="button" style={styles.payBtn} onClick={() => openPayBill(s)}>
                          Pay
                        </button>
                      )
                    ) : null}
                  </span>
                </span>
              ))}
          </div>
          ) : null}

          <div style={{ ...styles.metric, borderTop: '3px solid var(--border)' }} title={feeTermsLabel ?? undefined}>
            <span style={styles.metricLabel}>Commission</span>
            <strong style={styles.metricValueCommission}>
              {formatMoney(estUnpaidFee > 0 ? estUnpaidFee : settlementSummary.paidCommission)}
            </strong>
            <span style={styles.metricHint}>
              {estUnpaidFee > 0
                ? `Est. on ${visibleAwaiting.length} unpaid${
                    settlementSummary.paidCommission > 0
                      ? ` · ${formatMoney(settlementSummary.paidCommission)} on paid`
                      : ''
                  }`
                : settlementSummary.paidCount > 0
                  ? 'On paid settlements'
                  : feeQuote
                    ? 'No fee on unpaid orders'
                    : 'No unpaid orders'}
            </span>
          </div>

          <div style={{ ...styles.metric, borderTop: '3px solid var(--border)' }}>
            <span style={styles.metricLabel}>Claims</span>
            <strong style={{ ...styles.metricValueClaim, color: 'var(--metric-claim)' }}>
              {formatMoney(pendingClaimDebitTotal > 0 ? pendingClaimDebitTotal : settlementSummary.paidClaims)}
            </strong>
            <span style={styles.metricHint}>
              {pendingClaimDebitTotal > 0
                ? `${formatMoney(pendingClaimDebitTotal)} pending on next payout`
                : settlementSummary.paidClaims > 0 || appliedClaimDebitTotal > 0
                  ? `${formatMoney(settlementSummary.paidClaims || appliedClaimDebitTotal)} already taken from paid settlements`
                  : 'None yet'}
            </span>
            {claimAdjustments.length > 0 ? (
              <button
                type="button"
                style={styles.claimToggle}
                aria-haspopup="dialog"
                aria-expanded={claimsOpen}
                onClick={() => setClaimsOpen(true)}
              >
                {pendingClaimDebits.length > 0
                  ? `View ${pendingClaimDebits.length} pending`
                  : 'View claim history'}
              </button>
            ) : null}
          </div>

          <div style={{ ...styles.metric, borderTop: '3px solid var(--border)' }}>
            <span style={styles.metricLabel}>Other charges</span>
            <strong style={{ ...styles.metricValueClaim, color: 'var(--metric-other)' }}>
              {formatMoney(settlementSummary.paidOtherCharges)}
            </strong>
            <span style={styles.metricHint}>
              {settlementSummary.paidOtherCharges > 0
                ? 'Penalties / other on paid settlements'
                : 'None yet'}
            </span>
          </div>
        </div>

        <ClaimDeductionsDialog
          open={claimsOpen}
          items={claimAdjustments}
          onClose={() => setClaimsOpen(false)}
        />

        <ConfirmDialog
          open={payTarget != null || payBill != null}
          title={
            payIntent === 'correct'
              ? 'Correct this payment'
              : payIntent === 'again'
                ? payBill
                  ? 'Pay KoyaKart again'
                  : 'Pay subscription again'
                : payBill
                  ? 'Pay KoyaKart bill'
                  : 'Pay subscription bill'
          }
          description={
            payBill ? (
              <div style={styles.ackBody}>
                <div style={styles.ackAmount}>{formatMoney(Number(payBill.netAmount ?? 0))}</div>
                <div>
                  {payBill.serviceInvoiceNumber ?? 'Bill'} · fee on cash kept in your shop ·{' '}
                  {formatPeriodRange(payBill.periodStart, payBill.periodEnd)}
                </div>
                {payBill.vendorPaymentRejectedAt ? (
                  <div style={styles.rejectWhy}>
                    Not received ({payBill.vendorPaymentReference ?? '—'}): {payBill.vendorPaymentRejectReason || '—'}
                  </div>
                ) : null}
                <div style={styles.sub}>
                  {payIntent === 'correct'
                    ? 'Correct the mode, UTR, or note. KoyaKart checks this payment again.'
                    : payIntent === 'again'
                      ? 'Pay again, then enter the new reference so KoyaKart can confirm it.'
                      : 'Pay KoyaKart first, then enter the reference so KoyaKart can confirm it.'}
                </div>
                <div style={styles.payGrid}>
                  <label style={styles.payField}>
                    <span style={styles.payLabel}>Mode</span>
                    <select style={styles.payInput} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
              </select>
                  </label>
                  <label style={styles.payField}>
                    <span style={styles.payLabel}>UTR / UPI ref *</span>
                <input
                      style={styles.payInput}
                      value={payRef}
                      maxLength={128}
                      autoFocus
                      placeholder="e.g. 427812345678"
                      onChange={(e) => setPayRef(e.target.value)}
                />
              </label>
                </div>
                <label style={styles.payField}>
                  <span style={styles.payLabel}>Note (optional)</span>
                <input
                    style={styles.payInput}
                    value={payNotes}
                    maxLength={500}
                    onChange={(e) => setPayNotes(e.target.value)}
                />
              </label>
              </div>
            ) : payTarget ? (
              <div style={styles.ackBody}>
                <div style={styles.ackAmount}>{formatMoney(Number(payTarget.amount ?? 0))}</div>
                <div>
                  {subscriptionMonthName(payTarget.month)} · {payTarget.invoiceNumber ?? 'Subscription'}
                </div>
                {payTarget.status === 'REJECTED' ? (
                  <div style={styles.rejectWhy}>
                    Not received ({payTarget.vendorPaymentReference ?? '—'}): {payTarget.rejectReason || '—'}
                  </div>
                ) : null}
                <div style={styles.sub}>
                  {payIntent === 'correct'
                    ? 'Correct the mode, UTR, or note. KoyaKart checks this payment again.'
                    : payIntent === 'again'
                      ? 'Pay again, then enter the new reference so KoyaKart can confirm it.'
                      : 'Pay KoyaKart first, then enter the reference so KoyaKart can confirm it.'}
                </div>
                <div style={styles.payGrid}>
                  <label style={styles.payField}>
                    <span style={styles.payLabel}>Mode</span>
                    <select style={styles.payInput} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </label>
                  <label style={styles.payField}>
                    <span style={styles.payLabel}>UTR / UPI ref *</span>
                    <input
                      style={styles.payInput}
                      value={payRef}
                      maxLength={128}
                      autoFocus
                      placeholder="e.g. 427812345678"
                      onChange={(e) => setPayRef(e.target.value)}
                    />
                  </label>
                </div>
                <label style={styles.payField}>
                  <span style={styles.payLabel}>Note (optional)</span>
                  <input
                    style={styles.payInput}
                    value={payNotes}
                    maxLength={500}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </label>
              </div>
            ) : null
          }
          confirmLabel={payRef.trim() ? 'Submit payment' : 'Enter UTR to submit'}
          cancelLabel="Cancel"
          busy={paying}
          onConfirm={() => {
            if (payRef.trim()) void submitPay();
          }}
          onClose={closePay}
        />

        <ConfirmDialog
          open={ackTarget != null}
          title="Confirm money received"
          description={
            ackTarget ? (
              <div style={styles.ackBody}>
                <div style={styles.ackAmount}>{formatMoney(ackTarget.netAmount)}</div>
                <div>
                  {ackTarget.payoutMethod ?? 'Payout'} · Txn {ackTarget.transactionReference || 'no ref'}
                </div>
                {ackTarget.transactionNotes?.trim() ? (
                  <div style={styles.ackAdminNote}>{ackTarget.transactionNotes.trim()}</div>
                ) : null}
                <div>
                  Orders {formatPeriodRange(ackTarget.periodStart, ackTarget.periodEnd)}
                  {ackTarget.paidAt ? ` · sent ${formatPaidAt(ackTarget.paidAt)}` : ''}
                </div>
                <div style={styles.sub}>Check your bank / UPI app first. This can't be undone.</div>
                {ackDispute ? (
                  <label style={styles.payField}>
                    <span style={styles.payLabel}>Comment for KoyaKart *</span>
                    <textarea
                      style={styles.ackNote}
                      value={ackNote}
                      maxLength={500}
                      rows={2}
                      autoFocus
                      placeholder="What should they recheck?"
                      onChange={(e) => setAckNote(e.target.value)}
                />
              </label>
                ) : null}
              </div>
            ) : null
          }
          confirmLabel={ackDispute ? (ackNote.trim() ? 'Send comment' : 'Write a comment') : 'Yes, I received it'}
          cancelLabel={ackDispute ? 'Go back' : 'Close'}
          extraLabel={ackDispute ? undefined : 'Not received'}
          onExtra={ackDispute ? undefined : () => setAckDispute(true)}
          busy={ackTarget != null && ackingId === ackTarget.id}
          onConfirm={() => {
            if (ackDispute) {
              if (ackNote.trim()) void sendAckMissing();
              return;
            }
            void confirmAcknowledge();
          }}
          onClose={() => {
            if (ackingId) return;
            if (ackDispute) {
              setAckDispute(false);
              return;
            }
            closeAck();
          }}
        />

        <Card padding="sm" style={styles.settlementsCard}>
          <div style={styles.sectionHead}>
            <div style={styles.paneTabs} role="tablist" aria-label="Payout view">
              {(
                [
                  ['orders', `All orders (${visibleOrders.length})`],
                  ['awaiting', `Unpaid (${awaitingPaged.total})`],
                  ['settlements', total > 0 ? `Settlements (${awaitingVendorAck}/${total})` : 'Settlements'],
                  ...(subscriptionBills.length > 0
                    ? ([
                        [
                          'subscription',
                          subscriptionDueBills.length > 0
                            ? `Subscription (${subscriptionDueBills.length} due)`
                            : 'Subscription',
                        ],
                      ] as const)
                    : []),
                  ...(subscriptionPaidBills.length > 0
                    ? ([['subscriptionHistory', 'Subscription Payment History']] as const)
                    : []),
                ] as ReadonlyArray<readonly [PayoutPane, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activePane === key}
                  title={
                    key === 'settlements' && total > 0
                      ? `${awaitingVendorAck} of ${total} not confirmed yet`
                      : undefined
                  }
                  style={activePane === key ? styles.paneTabOn : styles.paneTab}
                  onClick={() => setPane(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={styles.toolbar}>
              {activePane === 'settlements' ? (
              <select
                style={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'PAID' | 'OPEN')}
                aria-label="Settlement status"
              >
                <option value="all">All status</option>
                <option value="PAID">Paid</option>
                <option value="OPEN">Open</option>
              </select>
              ) : null}
              {!subscriptionPane ? (
              <select
                style={styles.select}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              ) : null}
            </div>
          </div>
          {!subscriptionPane ? (
            <DateRangePresetBar
              dense
              alwaysShowDateInputs
              preset={datePreset}
              from={periodFrom}
              to={periodTo}
              onPresetChange={setDatePreset}
              onFromChange={setPeriodFrom}
              onToChange={setPeriodTo}
              options={PAYOUT_DATE_OPTIONS}
              ariaLabel="Period"
            />
          ) : null}
          <p style={styles.formulaHint}>
            {activePane === 'subscription'
              ? 'Only the plan bill that is still open. Paid months are under Subscription Payment History, and this fee is never taken from your order payout.'
              : activePane === 'subscriptionHistory'
                ? 'Plan bills you have already settled. They are not added to anything you owe now.'
              : activePane === 'orders'
              ? 'Every delivered bag (by delivery date) with its payout status. Commission on online / rider-cash bags is cut from your payout; you pay KoyaKart only "To KoyaKart" (commission on cash your shop kept).'
              : activePane === 'awaiting'
                ? 'Delivered bags not paid yet. Online / hub cash: KoyaKart pays you bag total − fee. Cash in shop: you keep it and pay only the fee.'
                : 'Each row is one payout from KoyaKart: Net = Gross − commission − claims − other. Listed by the day the money was sent (open ones by delivery window). Tap "Show orders" to see the bags.'}
            {!subscriptionPane && (periodFrom || periodTo)
              ? ` · ${formatDay(periodFrom || null)} → ${formatDay(periodTo || null)}`
              : ''}
          </p>

          {activePane === 'orders' ? (
            loading && deliveredRows.length === 0 ? (
              <p style={styles.muted}>Loading…</p>
            ) : visibleOrders.length === 0 ? (
              <p style={styles.empty}>No delivered orders in this period.</p>
            ) : (
              <>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.thFit}>Delivered</th>
                        <th style={styles.thFit}>Order</th>
                        <th style={styles.thFit}>Pay</th>
                        <th style={styles.thFitRight}>Bag total</th>
                        <th
                          style={styles.thFitRight}
                          title="KoyaKart's fee on every bag. For online and rider-cash bags it is taken out of your payout — you don't pay it separately."
                        >
                          Commission
                        </th>
                        <th style={styles.thFitRight}>Net Earnings</th>
                        <th
                          style={{ ...styles.thFit, textAlign: 'center' }}
                          title="Commission on bags where your shop kept the cash. KoyaKart received nothing, so this is the only commission you pay."
                        >
                          To KoyaKart
                        </th>
                        <th style={{ ...styles.thPlain, paddingLeft: '1.4rem' }}>Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersPaged.pageItems.map((row) => {
                        const payout = orderPayouts[row.subOrderId];
                        const m = orderMoney(row);
                        const paid = m.paid;
                        const shopHeld = m.shopHeld;
                        return (
                          <tr key={row.subOrderId}>
                            <td style={styles.tdMuted}>
                              {shortWhen(payoutAt(row))}
                              <div style={styles.subOrderNo}>Placed {shortWhen(row.placedAt)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.orderNo}>{row.orderNumber}</div>
                              <div style={styles.subOrderNo}>{row.subOrderNumber}</div>
                            </td>
                            <td style={styles.tdMuted}>{row.paymentMethod || '—'}</td>
                            <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                            <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                              {m.fee == null ? '—' : `− ${formatMoney(m.fee)}`}
                              {m.fee != null && m.estimated ? <div style={styles.sub}>est.</div> : null}
                              {m.claim > 0 ? (
                                <div style={{ ...styles.sub, color: 'var(--metric-claim)' }}>
                                  Claim − {formatMoney(m.claim)}
                                </div>
                              ) : null}
                            </td>
                            <td
                              style={{
                                ...styles.tdRight,
                                color: paid || shopHeld ? 'var(--metric-paid)' : 'var(--metric-awaiting)',
                              }}
                            >
                              {m.net == null ? '—' : formatMoney(m.net)}
                              <div
                                style={{
                                  ...styles.netNote,
                                  color: paid
                                    ? 'var(--metric-paid)'
                                    : shopHeld
                                      ? 'var(--text-muted)'
                                      : 'var(--metric-awaiting)',
                                }}
                              >
                                {shopHeld
                                  ? paid
                                    ? '✓ Cash in shop · fee paid'
                                    : 'Cash in shop'
                                  : paid
                                    ? '✓ Received'
                                    : 'KoyaKart yet to pay'}
                              </div>
                            </td>
                            {m.owed > 0 ? (
                              <td style={{ ...styles.tdRight, textAlign: 'center', color: 'var(--metric-commission)' }}>
                                {formatMoney(m.owed)}
                                <div style={styles.sub}>Fee to pay</div>
                              </td>
                            ) : paid && m.fee != null && m.fee > 0 ? (
                              <td
                                style={{ ...styles.tdRight, textAlign: 'center', color: 'var(--text-muted)' }}
                                title={shopHeld ? 'You paid this fee to KoyaKart' : 'KoyaKart kept this fee from your payout'}
                              >
                                {formatMoney(m.fee)}
                                <div style={{ ...styles.netNote, color: 'var(--metric-paid)' }}>✓ Paid to KoyaKart</div>
                              </td>
                            ) : (
                              <td style={{ ...styles.tdRight, textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                            )}
                            <td style={{ ...styles.td, paddingLeft: '1.4rem' }}>
                              <span style={paid ? styles.paid : shopHeld ? styles.feeDue : styles.open}>
                                {paid ? 'PAID' : shopHeld ? 'Fee due' : 'Unpaid'}
                              </span>
                              {paid && payout?.paidAt ? (
                                <span style={styles.payoutWhen}> {shortWhen(payout.paidAt)}</span>
                              ) : null}
                              {paid ? (
                                <div
                                  style={styles.payoutRef}
                                  title={`${formatPeriodRange(payout?.periodStart, payout?.periodEnd)} · ${payout?.payoutMethod ?? '—'} · ${payout?.transactionReference || 'No txn ref'}`}
                                >
                                  {formatPeriodRange(payout?.periodStart, payout?.periodEnd)} · {payout?.payoutMethod ?? '—'}
                                  {payout?.transactionReference ? ` · ${payout.transactionReference}` : ''}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={styles.tfLabel} colSpan={3}>
                          Paid · {ordersTotals.paidCount} bag{ordersTotals.paidCount === 1 ? '' : 's'}
                          <div style={styles.sub}>Commission = actual fee charged on the settlement, split by bag value</div>
                        </td>
                        <td style={styles.tfRight}>{formatMoney(ordersTotals.paidGross)}</td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                          − {formatMoney(ordersTotals.paidFee)}
                        </td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-paid)' }}>{formatMoney(ordersTotals.paidNet)}</td>
                        <td style={{ ...styles.tfRight, textAlign: 'center', color: 'var(--text-muted)' }}>
                          {ordersTotals.paidFee > 0 ? formatMoney(ordersTotals.paidFee) : '—'}
                          {ordersTotals.paidFee > 0 ? (
                            <div style={{ ...styles.netNote, color: 'var(--metric-paid)' }}>✓ Paid to KoyaKart</div>
                          ) : null}
                        </td>
                        <td style={styles.tf} />
                      </tr>
                      <tr>
                        <td style={styles.tfLabel} colSpan={3}>
                          Not paid yet · {ordersTotals.unpaidCount} bag{ordersTotals.unpaidCount === 1 ? '' : 's'}
                          {ordersTotals.unpaidCount > 0 ? <div style={styles.sub}>Commission estimated</div> : null}
                        </td>
                        <td style={styles.tfRight}>{formatMoney(ordersTotals.unpaidGross)}</td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                          − {formatMoney(ordersTotals.unpaidFee)}
                        </td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-paid)' }}>{formatMoney(ordersTotals.unpaidNet)}</td>
                        <td style={{ ...styles.tfRight, textAlign: 'center', color: ordersTotals.owed > 0 ? 'var(--metric-commission)' : 'var(--text-muted)' }}>
                          {ordersTotals.owed > 0 ? formatMoney(ordersTotals.owed) : '—'}
                          {ordersTotals.owedCount > 0 ? (
                            <div style={styles.sub}>
                              Fee on {ordersTotals.owedCount} cash-in-shop bag{ordersTotals.owedCount === 1 ? '' : 's'}
                            </div>
                          ) : null}
                        </td>
                        <td style={styles.tf} />
                      </tr>
                      <tr>
                        <td style={styles.tfFinalLabel} colSpan={3}>
                          Total · {visibleOrders.length} bag{visibleOrders.length === 1 ? '' : 's'}
                        </td>
                        <td style={styles.tfFinalValue}>
                          {formatMoney(ordersTotals.paidGross + ordersTotals.unpaidGross)}
                        </td>
                        <td style={{ ...styles.tfFinalValue, color: 'var(--metric-commission)' }}>
                          − {formatMoney(ordersTotals.paidFee + ordersTotals.unpaidFee)}
                          {ordersTotals.claims > 0 ? (
                            <div style={{ ...styles.tfNote, color: 'var(--metric-claim)' }}>
                              Claims − {formatMoney(ordersTotals.claims)}
                            </div>
                          ) : null}
                          <div style={styles.tfNote}>A small share that brought you these orders</div>
                        </td>
                        <td style={styles.tfFinalValue}>
                          {formatMoney(ordersTotals.paidNet + ordersTotals.unpaidNet)}
                        </td>
                        <td style={{ ...styles.tfFinalValue, textAlign: 'center', color: 'var(--metric-commission)' }}>
                          {ordersTotals.owed > 0 ? formatMoney(ordersTotals.owed) : '—'}
                          <div style={{ ...styles.tfNote, marginRight: 'auto' }}>
                            {ordersTotals.owed > 0 ? 'Only amount you pay' : 'Nothing to pay'}
                          </div>
                        </td>
                        <td style={styles.tfFinal} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={styles.pager}>
                  <TablePager
                    total={ordersPaged.total}
                    from={ordersPaged.from}
                    to={ordersPaged.to}
                    page={ordersPaged.safePage}
                    totalPages={ordersPaged.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )
          ) : activePane === 'awaiting' ? (
            loading && awaitingRows.length === 0 ? (
              <p style={styles.muted}>Loading…</p>
            ) : awaitingPaged.total === 0 ? (
              <p style={styles.empty}>No unpaid delivered orders in this period.</p>
            ) : (
              <>
                <div style={styles.tableWrap}>
                  <table style={{ ...styles.table, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <SortableTh
                          label="Delivered"
                          column="placed"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.thSortFit}
                        />
                        <SortableTh
                          label="Order"
                          column="order"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.thSortFit}
                        />
                        <SortableTh
                          label="Pay"
                          column="pay"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.thSortFit}
                        />
                        <SortableTh
                          label="Cash with"
                          column="cash"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.thSortFit}
                        />
                        <SortableTh
                          label="Bag total"
                          column="amount"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          align="right"
                          style={{ ...styles.thSortFit, paddingLeft: '1.4rem' }}
                        />
                        <th style={styles.thFitRight}>Est. fee</th>
                        <th style={styles.thFitRight}>KoyaKart pays you</th>
                        <th style={{ ...styles.thPlain, paddingLeft: '1.4rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awaitingPaged.pageItems.map((row) => {
                        const holder = resolveCashHolder(row, cashHolders[row.subOrderId]);
                        const fee = rowFees[row.subOrderId] as number | undefined;
                        const shopHeld = isShopHeld(holder);
                        return (
                        <tr key={row.subOrderId}>
                          <td style={styles.tdMuted}>
                            {shortWhen(payoutAt(row))}
                            <div style={styles.subOrderNo}>Placed {shortWhen(row.placedAt)}</div>
                          </td>
                          <td style={styles.td}>
                            <div style={styles.orderNo}>{row.orderNumber}</div>
                              <div style={styles.subOrderNo}>{row.subOrderNumber}</div>
                          </td>
                          <td style={styles.tdMuted}>{row.paymentMethod || '—'}</td>
                          <td style={styles.td} title={holder.holderDetail || undefined}>
                            <span style={holderChip(holder.holderRole)}>{holder.holderLabel}</span>
                          </td>
                          <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                          <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                            {fee == null ? '—' : `− ${formatMoney(fee)}`}
                          </td>
                          {shopHeld ? (
                            <td
                              style={{ ...styles.tdRight, color: 'var(--text-muted)' }}
                              title="You already have this cash — only the fee goes to KoyaKart"
                            >
                              —
                            </td>
                          ) : (
                            <td style={{ ...styles.tdRight, color: 'var(--metric-awaiting)', fontWeight: 800 }}>
                              {fee == null ? '—' : formatMoney(Number(row.subtotal ?? 0) - fee)}
                            </td>
                          )}
                          <td style={{ ...styles.td, paddingLeft: '1.4rem' }}>
                            <span style={shopHeld ? styles.feeDue : styles.open}>
                              {shopHeld ? 'Pay fee' : 'Coming'}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={styles.tfLabel} colSpan={4}>
                          Online / hub · {periodSplit.payCount} bag{periodSplit.payCount === 1 ? '' : 's'}
                          {pendingClaimDebitTotal > 0 ? (
                            <span style={{ ...styles.tfInline, color: 'var(--metric-claim)' }}>
                              {' '}· − {formatMoney(pendingClaimDebitTotal)} claims
                            </span>
                          ) : null}
                        </td>
                        <td style={styles.tfRight}>{formatMoney(periodSplit.payGross)}</td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                          {feeQuote ? `− ${formatMoney(periodSplit.payFee)}` : '—'}
                        </td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-awaiting)' }}>
                          {feeQuote ? formatMoney(Math.max(0, periodSplit.payNet - pendingClaimDebitTotal)) : '—'}
                        </td>
                        <td style={{ ...styles.tf, paddingLeft: '1.4rem' }}>
                          <span style={styles.tfInline}>KoyaKart pays you</span>
                        </td>
                      </tr>
                      {periodSplit.shopCount > 0 ? (
                        <tr>
                          <td style={styles.tfLabel} colSpan={4}>
                            Cash in shop · {periodSplit.shopCount} bag{periodSplit.shopCount === 1 ? '' : 's'}
                          </td>
                          <td style={styles.tfRight}>{formatMoney(periodSplit.shopGross)}</td>
                          <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                            {feeQuote ? `− ${formatMoney(periodSplit.shopFee)}` : '—'}
                          </td>
                          <td style={{ ...styles.tfRight, color: 'var(--text-muted)' }}>—</td>
                          <td style={{ ...styles.tf, paddingLeft: '1.4rem' }}>
                            <span style={styles.tfInline}>You pay {feeQuote ? formatMoney(periodSplit.shopFee) : '—'} fee</span>
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td style={styles.tfFinalLabel} colSpan={6}>
                          KoyaKart pays you
                          {awaitingPaged.totalPages > 1 ? ' (all pages)' : ''}
                        </td>
                        <td style={styles.tfFinalValue}>
                          {feeQuote ? formatMoney(Math.max(0, periodSplit.payNet - pendingClaimDebitTotal)) : '—'}
                        </td>
                        <td style={styles.tfFinal} />
                      </tr>
                      {periodSplit.shopCount > 0 ? (
                        <tr>
                          <td style={styles.tfOweLabel} colSpan={6}>
                            You pay KoyaKart
                            <span style={styles.tfInline}> · fee on cash kept in your shop</span>
                          </td>
                          <td style={styles.tfOweValue}>{feeQuote ? formatMoney(periodSplit.shopFee) : '—'}</td>
                          <td style={styles.tfOwe} />
                        </tr>
                      ) : null}
                    </tfoot>
                  </table>
                </div>
                <div style={styles.pager}>
                  <TablePager
                    total={awaitingPaged.total}
                    from={awaitingPaged.from}
                    to={awaitingPaged.to}
                    page={awaitingPaged.safePage}
                    totalPages={awaitingPaged.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )
          ) : subscriptionPane ? (
            subscriptionShown.length === 0 ? (
              <p style={styles.empty}>
                {activePane === 'subscriptionHistory' ? 'No subscription payment history yet.' : 'No plan bill due right now.'}
              </p>
            ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thPlain}>Month</th>
                    <th style={{ ...styles.thPlain, textAlign: 'right' }}>Amount</th>
                    <th style={styles.thPlain}>Status</th>
                    <th style={styles.thPlain}>Your payment</th>
                    <th style={styles.thPlain}>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionShown.map((b, rowIndex) => {
                      const tone =
                        b.status === 'PAID'
                          ? { label: 'Paid', color: '#047857', background: '#dcfce7' }
                          : b.status === 'PAYMENT_SUBMITTED'
                            ? { label: 'KoyaKart checking', color: '#1d4ed8', background: '#dbeafe' }
                            : b.status === 'REJECTED'
                              ? { label: 'Not received', color: '#991b1b', background: '#fee2e2' }
                              : { label: 'Due', color: '#9a3412', background: '#ffedd5' };
                      return (
                        <tr key={b.month} style={rowIndex % 2 === 1 ? styles.zebra : undefined}>
                          <td style={styles.td}>
                            <div style={styles.periodMain}>{subscriptionMonthName(b.month)}</div>
                            {b.invoiceNumber ? <div style={styles.sub}>{b.invoiceNumber}</div> : null}
                          </td>
                          <td style={{ ...styles.tdRight, fontWeight: 800 }}>{formatMoney(Number(b.amount ?? 0))}</td>
                          <td style={styles.td}>
                            <span style={{ ...styles.subPill, color: tone.color, background: tone.background }}>
                              {tone.label}
                            </span>
                            {b.status === 'REJECTED' && b.rejectReason ? (
                              <div style={styles.rejectWhy}>{b.rejectReason}</div>
                            ) : null}
                          </td>
                          <td style={styles.td}>
                            {b.status === 'SENT' || b.status === 'REJECTED' ? (
                              b.status === 'REJECTED' ? (
                                <span style={styles.payPair}>
                                  <button type="button" style={styles.payBtn} onClick={() => openPay(b, 'again')}>
                                    Pay again
                                  </button>
                                  <button type="button" style={styles.correctBtn} onClick={() => openPay(b, 'correct')}>
                                    Correct
                                  </button>
                                </span>
                              ) : (
                                <button type="button" style={styles.payBtn} onClick={() => openPay(b)}>
                                  {`Pay ${formatMoney(Number(b.amount ?? 0))}`}
                                </button>
                              )
                            ) : b.vendorPaymentReference ? (
                              <>
                                <div>{b.vendorPaymentMethod ?? '—'}</div>
                                <div style={styles.sub}>
                                  UTR {b.vendorPaymentReference}
                                  {b.vendorPaidAt ? ` · ${formatPaidAt(b.vendorPaidAt)}` : ''}
                                </div>
                              </>
                            ) : (
                              <span style={styles.sub}>—</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={styles.billBtn}
                              onClick={() =>
                                downloadVendorServiceBill(subscriptionBillAsSettlement(b), supplierParty(), recipientParty())
                              }
                            >
                              Bill
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                {activePane === 'subscription' && subscriptionShown.length > 1 ? (
                  <tfoot style={styles.tfoot}>
                    <tr>
                      <td style={styles.tfLabel}>Due now</td>
                      <td style={styles.tfRight}>{formatMoney(subscriptionDueTotal)}</td>
                      <td style={styles.tf} colSpan={3} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            )
          ) : loading && settlements.length === 0 ? (
            <p style={styles.muted}>Loading…</p>
          ) : settlements.length === 0 ? (
            <p style={styles.empty}>
              No payout batches yet. Tap Awaiting payout to see unpaid shop sales.
            </p>
          ) : total === 0 ? (
            <p style={styles.empty}>
              No settlements in this date range
              {statusFilter !== 'all' ? ` · status ${statusFilter}` : ''}.{' '}
              {visibleOrders.length > 0 ? (
                <button type="button" style={styles.linkBtn} onClick={() => setPane('orders')}>
                  View {visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} in this period
                </button>
              ) : (
                'Try All time.'
              )}
            </p>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Delivery window" column="period" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Gross" column="gross" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Commission" column="fee" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Claims" column="claims" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Other" column="other" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Net" column="net" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Money sent on" column="paidAt" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <th style={styles.thPlain}>Mode / txn</th>
                      <th style={styles.thPlain}>Received</th>
                      <th style={styles.thPlain}>Bill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s, rowIndex) => {
                      const claims = settlementClaimAmount(s);
                      const other = settlementOtherChargesAmount(s);
                      const claimLines = (s.lines ?? []).filter(
                        (l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT',
                      );
                      const otherLines = (s.lines ?? []).filter((l) => {
                        const t = (l.lineType ?? '').toUpperCase();
                        return t === 'OTHER_CHARGE' || t === 'PENALTY';
                      });
                      const orderLines = (s.lines ?? []).filter((l) => {
                        const t = (l.lineType ?? '').toUpperCase();
                        return t === 'ORDER' || t === '';
                      });
                      const expanded = expandedSettlementId === s.id;
                      return (
                      <Fragment key={s.id}>
                      <tr style={rowIndex % 2 === 1 ? styles.zebra : undefined}>
                        <td style={styles.td}>
                          <div style={styles.periodMain}>
                            {formatPeriodRange(s.periodStart, s.periodEnd)}
                            {paidLaterMonth(s) ? (
                              <span style={styles.paidLater}> · paid in {paidLaterMonth(s)}</span>
                            ) : null}
                          </div>
                          <div style={styles.sub}>
                            {s.periodType ? `${s.periodType} · ` : ''}
                            {orderLines.length > 0 ? (
                              <button
                                type="button"
                                style={styles.linkBtn}
                                aria-expanded={expanded}
                                onClick={() => setExpandedSettlementId(expanded ? null : s.id)}
                              >
                                {expanded ? 'Hide' : 'Show'} {orderLines.length} order{orderLines.length === 1 ? '' : 's'}
                              </button>
                            ) : (
                              'Orders included'
                            )}
                          </div>
                          {claims > 0 || other > 0 ? (
                            <div style={styles.breakdown}>
                              {formatMoney(s.grossAmount)} − {formatMoney(s.commissionAmount)} fee
                              {claims > 0 ? ` − ${formatMoney(claims)} claims` : ''}
                              {other > 0 ? ` − ${formatMoney(other)} other` : ''} ={' '}
                              {formatMoney(s.netAmount)}
                            </div>
                          ) : null}
                        </td>
                        <td style={styles.tdRight}>{formatMoney(s.grossAmount)}</td>
                        <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                          − {formatMoney(s.commissionAmount)}
                        </td>
                        <td style={{ ...styles.tdRight, color: claims > 0 ? 'var(--metric-claim)' : 'var(--text-muted)' }}>
                          {claims > 0 ? `− ${formatMoney(claims)}` : '—'}
                          {claimLines.length > 0 ? (
                            <div style={styles.sub}>
                              {claimLines.length} chargeback{claimLines.length === 1 ? '' : 's'}
                            </div>
                          ) : claims > 0 ? (
                            <div style={styles.sub}>Buyer credit clawback</div>
                          ) : null}
                        </td>
                        <td style={{ ...styles.tdRight, color: other > 0 ? 'var(--metric-other)' : 'var(--text-muted)' }}>
                          {other > 0 ? `− ${formatMoney(other)}` : '—'}
                          {otherLines.length > 0 ? (
                            <div style={styles.sub}>
                              {otherLines.map((l) => l.description || 'Charge').join(' · ')}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...styles.tdRight, color: 'var(--metric-paid)', fontWeight: 800 }}>
                          {formatMoney(s.netAmount)}
                        </td>
                        <td style={styles.td}>
                          <span style={s.status === 'PAID' ? styles.paid : styles.open}>
                            {s.status === 'PAID' ? 'PAID' : 'OPEN'}
                          </span>
                        </td>
                        <td style={styles.tdMuted}>{s.paidAt ? formatPaidAt(s.paidAt) : '—'}</td>
                        <td style={styles.td}>
                          {s.status === 'PAID' ? (
                            <>
                              <div>{s.payoutMethod ?? '—'}</div>
                              <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                              {s.transactionNotes?.trim() ? (
                                <div style={styles.sub}>{s.transactionNotes.trim()}</div>
                              ) : null}
                            </>
                          ) : (
                            <span style={styles.sub}>Not paid yet</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {isOpenVendorBill(s) ? (
                            s.vendorPaidAt ? (
                            <>
                                <span style={styles.open}>KoyaKart checking</span>
                                <div style={styles.sub}>UTR {s.vendorPaymentReference ?? '—'}</div>
                            </>
                          ) : (
                              <>
                                {s.vendorPaymentRejectedAt ? (
                                  <div style={styles.rejectWhy} title={s.vendorPaymentRejectReason ?? undefined}>
                                    Not received: {s.vendorPaymentRejectReason || 'KoyaKart did not receive this payment'}
                                  </div>
                                ) : null}
                                {s.vendorPaymentRejectedAt ? (
                                  <span style={styles.payPair}>
                                    <button type="button" style={styles.payBtn} onClick={() => openPayBill(s, 'again')}>
                                      Pay again
                                    </button>
                                    <button type="button" style={styles.correctBtn} onClick={() => openPayBill(s, 'correct')}>
                                      Correct
                                    </button>
                                  </span>
                                ) : (
                                  <button type="button" style={styles.payBtn} onClick={() => openPayBill(s)}>
                                    {`Pay ${formatMoney(s.netAmount)}`}
                                  </button>
                                )}
                              </>
                            )
                          ) : s.status !== 'PAID' ? (
                            <span style={styles.sub}>—</span>
                          ) : isCollectionSettlement(s) ? (
                            <>
                              <span style={styles.paid}>✓ Paid to KoyaKart</span>
                              {s.transactionNotes ? <div style={styles.sub}>KoyaKart: {s.transactionNotes}</div> : null}
                            </>
                          ) : s.vendorAcknowledgedAt ? (
                            <>
                              <span style={styles.paid}>RECEIVED</span>
                              <div style={styles.sub}>{formatPaidAt(s.vendorAcknowledgedAt)}</div>
                            </>
                          ) : s.vendorNotReceivedAt ? (
                            <>
                              <span style={styles.notReceived}>Not received · told KoyaKart</span>
                              {s.vendorNotReceivedNote ? (
                                <div style={styles.sub}>{s.vendorNotReceivedNote}</div>
                              ) : null}
                              <button
                                type="button"
                                style={styles.ackBtn}
                                disabled={ackingId === s.id}
                                onClick={() => {
                                  setAckNote('');
                                  setAckDispute(false);
                                  setAckTarget(s);
                                }}
                              >
                                {ackingId === s.id ? 'Saving…' : 'I got it'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              style={styles.ackBtn}
                              disabled={ackingId === s.id}
                              onClick={() => {
                                setAckNote('');
                                setAckDispute(false);
                                setAckTarget(s);
                              }}
                            >
                              {ackingId === s.id ? 'Saving…' : 'I got it'}
                            </button>
                          )}
                        </td>
                        <td style={styles.td}>
                          {s.status === 'PAID' || isOpenVendorBill(s) ? (
                            <button
                              type="button"
                              style={styles.billBtn}
                              onClick={() => downloadVendorServiceBill(s, supplierParty(), recipientParty())}
                            >
                              Bill
                            </button>
                          ) : (
                            <span style={styles.sub}>—</span>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={11} style={styles.detailCell}>
                            <table style={styles.innerTable}>
                              <thead>
                                <tr>
                                  <th style={styles.thPlain}>Order</th>
                                  <th style={styles.thPlain}>Delivered</th>
                                  <th style={styles.thPlain}>Pay</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>Bag total</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>Commission</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>Net Earnings</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderLines.map((l) => {
                                  const sale = l.subOrderId
                                    ? deliveredRows.find((r) => r.subOrderId === l.subOrderId)
                                    : undefined;
                                  const lineFee = l.subOrderId
                                    ? settledLineMoney.map[l.subOrderId]?.fee
                                    : undefined;
                                  return (
                                    <tr key={l.id}>
                                      <td style={styles.td}>
                                        <div style={styles.orderNo}>{l.orderNumber ?? sale?.orderNumber ?? 'Order'}</div>
                                        <div style={styles.subOrderNo}>{l.subOrderNumber ?? sale?.subOrderNumber ?? ''}</div>
                                      </td>
                                      <td style={styles.tdMuted}>
                                        {sale ? shortWhen(payoutAt(sale)) : '—'}
                                      </td>
                                      <td style={styles.tdMuted}>{sale?.paymentMethod || '—'}</td>
                                      <td style={styles.tdRight}>{formatMoney(l.amount)}</td>
                                      <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                                        {lineFee == null ? '—' : `− ${formatMoney(lineFee)}`}
                                      </td>
                                      <td style={{ ...styles.tdRight, color: 'var(--metric-paid)' }}>
                                        {lineFee == null ? '—' : formatMoney(Number(l.amount ?? 0) - lineFee)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot style={styles.tfoot}>
                    <tr>
                      <td style={styles.tfLabel}>
                        Total · {filtered.length} settlement{filtered.length === 1 ? '' : 's'}
                        {totalPages > 1 ? ' (all pages)' : ''}
                      </td>
                      <td style={styles.tfRight}>{formatMoney(settlementTotals.gross)}</td>
                      <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                        − {formatMoney(settlementTotals.commission)}
                      </td>
                      <td style={{ ...styles.tfRight, color: settlementTotals.claims > 0 ? 'var(--metric-claim)' : 'var(--text-muted)' }}>
                        {settlementTotals.claims > 0 ? `− ${formatMoney(settlementTotals.claims)}` : '—'}
                      </td>
                      <td style={{ ...styles.tfRight, color: settlementTotals.other > 0 ? 'var(--metric-other)' : 'var(--text-muted)' }}>
                        {settlementTotals.other > 0 ? `− ${formatMoney(settlementTotals.other)}` : '—'}
                      </td>
                      <td style={{ ...styles.tfRight, color: 'var(--metric-paid)', fontSize: '0.95rem' }}>
                        {formatMoney(settlementTotals.net)}
                      </td>
                      <td style={styles.tf} colSpan={5}>
                        <span style={styles.sub}>
                          {settlementTotals.paidCount} paid · {filtered.length - settlementTotals.paidCount} open
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={styles.pager}>
                <TablePager
                  total={total}
                  from={from}
                  to={to}
                  page={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </Card>
      </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    height: '100%',
    minHeight: 0,
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 6.6rem), 1fr))',
    gap: '0.4rem',
    flexShrink: 0,
  },
  metric: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.3rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'default',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  metricOn: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.3rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  metricOnAwaiting: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.3rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid #fdba74',
    background: '#fff7ed',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  metricLabel: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: '1.08rem', fontWeight: 800, lineHeight: 1.15 },
  metricValueCommission: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.08rem',
    fontWeight: 800,
    lineHeight: 1.15,
    color: 'var(--metric-commission)',
  },
  metricValueClaim: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.08rem',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  metricHint: {
    fontSize: '0.64rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  flowTag: {
    fontSize: '0.58rem',
    fontWeight: 800,
    borderRadius: 'var(--radius-full)',
    padding: '0 0.3rem',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  flowIn: { color: '#047857', background: '#dcfce7' },
  flowComing: { color: '#9a3412', background: '#ffedd5' },
  flowOut: { color: '#991b1b', background: '#fee2e2' },
  flowSub: { color: '#6d28d9', background: '#ede9fe' },
  subRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.66rem',
    color: 'var(--text)',
    fontWeight: 600,
    padding: '0.1rem 0 0',
  },
  subMonth: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' },
  subPill: {
    fontSize: '0.62rem',
    fontWeight: 800,
    borderRadius: 'var(--radius-full)',
    padding: '0.05rem 0.4rem',
    whiteSpace: 'nowrap',
  },
  rejectWhy: { color: 'var(--danger, #dc2626)', fontWeight: 700 },
  billLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.28rem 0.4rem',
    marginTop: '0.12rem',
    maxWidth: '100%',
  },
  billActs: { display: 'inline-flex', alignItems: 'center', gap: '0.28rem', flexWrap: 'nowrap' },
  subActions: { display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 },
  payBtn: {
    padding: '0.12rem 0.45rem',
    borderRadius: 6,
    border: '1px solid #7c3aed',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.68rem',
    lineHeight: 1.2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  correctBtn: {
    padding: '0.12rem 0.45rem',
    borderRadius: 6,
    border: '1px solid #7c3aed',
    background: 'transparent',
    color: '#7c3aed',
    fontWeight: 800,
    fontSize: '0.68rem',
    lineHeight: 1.2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  payPair: { display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' },
  payGrid: { display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.45rem' },
  payField: { display: 'grid', gap: '0.15rem' },
  payLabel: { fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' },
  payInput: {
    minHeight: 34,
    padding: '0.3rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  formulaHint: {
    margin: 0,
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    fontWeight: 600,
  },
  hintStrong: { color: 'var(--text)', fontWeight: 800 },
  periodMain: { fontWeight: 700 },
  breakdown: {
    marginTop: '0.2rem',
    fontSize: '0.7rem',
    color: 'var(--metric-claim)',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  claimToggle: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--metric-claim)',
    fontSize: '0.7rem',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  settlementsCard: {
    display: 'grid',
    gridTemplateRows: 'auto auto auto minmax(0, 1fr) auto',
    gap: '0.4rem',
    padding: '0.55rem 0.65rem',
    flex: 1,
    minHeight: 0,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  sectionTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  paneTabs: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  paneTab: {
    minHeight: 32,
    padding: '0.25rem 0.7rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  paneTabOn: {
    minHeight: 32,
    padding: '0.25rem 0.7rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid #166534',
    background: '#f0fdf4',
    color: '#14532d',
    fontWeight: 800,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  linkBtn: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: 'var(--primary, #15803d)',
    fontWeight: 700,
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  detailCell: { padding: '0.35rem 0.6rem 0.6rem', background: 'var(--bg-subtle, #f8faf9)' },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  toolbar: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' },
  select: {
    padding: '0.3rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
  },
  dateLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  dateLabelText: { whiteSpace: 'nowrap' },
  dateInput: {
    padding: '0.28rem 0.4rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
    minHeight: '2rem',
  },
  tableWrap: {
    overflow: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    minHeight: 0,
    height: '100%',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: { position: 'sticky', top: 0, background: 'var(--bg-muted)', zIndex: 1 },
  thPlain: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.4rem 0.45rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tfoot: { position: 'sticky', bottom: 0, zIndex: 1 },
  tf: {
    background: 'var(--bg-muted)',
    padding: '0.3rem 0.45rem',
    borderTop: '1px solid var(--border)',
    verticalAlign: 'top',
  },
  tfLabel: {
    background: 'var(--bg-muted)',
    padding: '0.3rem 0.45rem',
    borderTop: '1px solid var(--border)',
    fontWeight: 700,
    verticalAlign: 'top',
  },
  tfRight: {
    background: 'var(--bg-muted)',
    padding: '0.3rem 0.45rem',
    borderTop: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  tfFinal: {
    background: '#ecfdf5',
    padding: '0.45rem 0.45rem',
    borderTop: '2px solid #16a34a',
    borderBottom: '2px solid #16a34a',
  },
  tfFinalLabel: {
    background: '#ecfdf5',
    padding: '0.45rem 0.45rem',
    borderTop: '2px solid #16a34a',
    borderBottom: '2px solid #16a34a',
    fontWeight: 800,
    fontSize: '0.95rem',
    color: '#14532d',
  },
  tfFinalValue: {
    background: '#ecfdf5',
    padding: '0.45rem 0.45rem',
    borderTop: '2px solid #16a34a',
    borderBottom: '2px solid #16a34a',
    textAlign: 'right',
    fontWeight: 900,
    fontSize: '1.1rem',
    color: '#15803d',
    whiteSpace: 'nowrap',
  },
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
    fontWeight: 600,
    verticalAlign: 'top',
  },
  sub: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 },
  orderNo: { fontWeight: 800, fontSize: '0.74rem', whiteSpace: 'nowrap', letterSpacing: '-0.01em' },
  subOrderNo: { color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 500, whiteSpace: 'nowrap' },
  tfNote: {
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 500,
    whiteSpace: 'normal',
    lineHeight: 1.2,
    maxWidth: 140,
    marginLeft: 'auto',
  },
  thSortFit: { position: 'sticky', top: 0, background: 'var(--bg-muted)', zIndex: 1, whiteSpace: 'nowrap' },
  tfOwe: { background: '#fef2f2', padding: '0.4rem 0.45rem', borderBottom: '2px solid #fca5a5' },
  tfOweLabel: {
    background: '#fef2f2',
    padding: '0.4rem 0.45rem',
    borderBottom: '2px solid #fca5a5',
    fontWeight: 800,
    fontSize: '0.9rem',
    color: '#991b1b',
  },
  tfOweValue: {
    background: '#fef2f2',
    padding: '0.4rem 0.45rem',
    borderBottom: '2px solid #fca5a5',
    textAlign: 'right',
    fontWeight: 900,
    fontSize: '1rem',
    color: 'var(--metric-commission)',
    whiteSpace: 'nowrap',
  },
  tfInline: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  thFit: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.4rem 0.45rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    width: '1%',
    whiteSpace: 'nowrap',
  },
  thFitRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.4rem 0.45rem 0.4rem 1.4rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    width: '1%',
    whiteSpace: 'nowrap',
  },
  netNote: { fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' },
  zebra: { background: 'var(--bg-subtle, #f8faf9)' },
  paidLater: { color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500 },
  payoutWhen: { color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' },
  payoutRef: {
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ackBody: { display: 'grid', gap: '0.3rem', color: 'var(--text)' },
  ackAmount: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--metric-paid, #15803d)' },
  ackAdminNote: { fontSize: '0.88rem', fontWeight: 650, color: 'var(--text)', lineHeight: 1.35 },
  ackNote: {
    width: '100%',
    minHeight: 52,
    resize: 'vertical',
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.82rem',
  },
  ackBtn: {
    minHeight: 32,
    padding: '0.2rem 0.55rem',
    borderRadius: 8,
    border: '1px solid #b45309',
    background: '#fffbeb',
    color: '#78350f',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  billBtn: {
    minHeight: 32,
    padding: '0.2rem 0.55rem',
    borderRadius: 8,
    border: '1px solid #166534',
    background: '#f0fdf4',
    color: '#14532d',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  paid: {
    fontSize: '0.68rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  notReceived: { color: '#9a3412', fontWeight: 800, fontSize: '0.72rem' },
  open: {
    fontSize: '0.68rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  feeDue: {
    fontSize: '0.68rem',
    color: '#991b1b',
    background: '#fee2e2',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  pager: { marginTop: '0.2rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  empty: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4 },
};
