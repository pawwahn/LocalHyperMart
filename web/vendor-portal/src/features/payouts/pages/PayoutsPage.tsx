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
  type BillParty,
} from '@/features/payouts/vendorBill';
import {
  acknowledgeSettlement,
  listMyClaimAdjustments,
  listMySettlements,
  lookupOrderCashHolders,
  lookupOrderPayouts,
  quoteMyFees,
  resolveCashHolder,
  settlementClaimAmount,
  settlementOtherChargesAmount,
  summarizeSettlements,
  type OrderCashHolder,
  type OrderPayout,
  type VendorClaimAdjustment,
  type VendorFeeQuote,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';
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
import { MoneyFlowSummary, aggregateVendorAwaitingHeld } from '@hlm-money-flow';
import {
  isoIstDate,
  type TransferHistoryPreset,
} from '@hlm-dates/istReportPresets';

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

/** Mirrors payment-service SettlementService.vendorHoldsBuyerCash: shop keeps the cash and pays fees instead. */
function isShopHeld(holder: OrderCashHolder): boolean {
  if ((holder.paymentMethod ?? '').toUpperCase() !== 'COD') return false;
  const loc = holder.codCashLocation || 'WITH_AGENT';
  if (loc === 'WITH_VENDOR' || loc === 'DECLARED_TO_VENDOR') return true;
  if (holder.vendorAgentDelivery) return loc !== 'AT_HUB' && loc !== 'DECLARED_TO_HUB';
  return false;
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

/** Settlement overlaps [from, to] when its payout period intersects the filter range. */
function settlementOverlapsRange(
  s: VendorSettlement,
  from: string,
  to: string,
): boolean {
  const start = (s.periodStart ?? s.periodEnd ?? '').slice(0, 10);
  const end = (s.periodEnd ?? s.periodStart ?? '').slice(0, 10);
  if (!start && !end) {
    const paidDay = (s.paidAt ?? '').slice(0, 10);
    if (!paidDay) return true;
    if (from && paidDay < from) return false;
    if (to && paidDay > to) return false;
    return true;
  }
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
  const [orderPayouts, setOrderPayouts] = useState<Record<string, OrderPayout>>({});
  const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null);
  const [cashHolders, setCashHolders] = useState<Record<string, OrderCashHolder>>({});
  const [feeQuote, setFeeQuote] = useState<VendorFeeQuote | null>(null);
  const [rowFees, setRowFees] = useState<Record<string, number>>({});
  const [holdersReady, setHoldersReady] = useState(false);
  const [pane, setPane] = useState<'settlements' | 'awaiting' | 'orders' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'OPEN'>('all');
  const [datePreset, setDatePreset] = useState<TransferHistoryPreset>('all');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'period', dir: 'asc' });
  const [awaitingSort, setAwaitingSort] = useState<SortState<AwaitingSortKey>>({ key: 'placed', dir: 'asc' });
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [supplier, setSupplier] = useState<BillParty | null>(null);
  const [recipient, setRecipient] = useState<BillParty | null>(null);
  const [ackTarget, setAckTarget] = useState<VendorSettlement | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);

  async function confirmAcknowledge() {
    const s = ackTarget;
    if (!s || !session?.accessToken || !session.vendorId) return;
    setAckingId(s.id);
    try {
      const updated = await acknowledgeSettlement(session.accessToken, session.vendorId, s.id);
      setSettlements((prev) => prev.map((x) => (x.id === s.id ? { ...x, vendorAcknowledgedAt: updated.vendorAcknowledgedAt } : x)));
      setAckTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm receipt');
      setAckTarget(null);
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
          from: isoDaysAgo(60),
          to: isoIstDate(),
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
      const unpaid: SalesReportRow[] = [];
      const delivered: SalesReportRow[] = [];
      for (const row of sales.rows ?? []) {
        if (row.status !== 'DELIVERED') continue;
        delivered.push(row);
        if (!payouts[row.subOrderId]?.paid) unpaid.push(row);
      }
      setAwaitingRows(unpaid);
      setDeliveredRows(delivered);
      setOrderPayouts(payouts);
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
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const periodSettlements = useMemo(
    () =>
      periodFrom || periodTo
        ? settlements.filter((s) => settlementOverlapsRange(s, periodFrom, periodTo))
        : settlements,
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
  const feeTermsLabel =
    feeQuote?.appliedSlabLabel || feeQuote?.breakdownLines?.[0] || feeQuote?.feeModel || null;

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
          net: acc.net + Number(s.netAmount ?? 0),
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

  const visibleAwaiting = useMemo(() => {
    return awaitingRows.filter((row) => {
      if (!periodFrom && !periodTo) return true;
      const day = (row.placedAt ?? '').slice(0, 10);
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
          cmp = compareText(a.placedAt ?? '', b.placedAt ?? '');
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

  const activePane: 'settlements' | 'awaiting' | 'orders' =
    pane ?? (settlements.length > 0 ? 'settlements' : 'awaiting');

  const awaitingPaged = useMemo(
    () => pageWindow(awaitingSorted, page, pageSize),
    [awaitingSorted, page, pageSize],
  );

  const visibleOrders = useMemo(() => {
    return deliveredRows
      .filter((row) => {
        if (!periodFrom && !periodTo) return true;
        const day = (row.placedAt ?? '').slice(0, 10);
        if (!day) return true;
        if (periodFrom && day < periodFrom) return false;
        if (periodTo && day > periodTo) return false;
        return true;
      })
      .sort((a, b) => compareText(b.placedAt ?? '', a.placedAt ?? ''));
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
    return { amount, paid, shopHeld, fee, estimated: !paid, claim, net };
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
    };
    for (const row of visibleOrders) {
      const m = orderMoney(row);
      out.claims += m.claim;
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

  const periodAwaitingGross = useMemo(
    () => visibleAwaiting.reduce((sum, row) => sum + Number(row.subtotal ?? 0), 0),
    [visibleAwaiting],
  );

  const periodBuyerMoneyHeld = useMemo(
    () =>
      aggregateVendorAwaitingHeld(visibleAwaiting, cashHolders, (row: SalesReportRow) => row.subOrderId),
    [visibleAwaiting, cashHolders],
  );

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

  const awaitingDisplayHint = usingSettlementAwaiting
    ? pendingClaimDebitTotal > 0
      ? `${settlementSummary.awaitingCount} open · after ${formatMoney(pendingClaimDebitTotal)} claims`
      : `${settlementSummary.awaitingCount} open settlement${settlementSummary.awaitingCount === 1 ? '' : 's'}`
    : [
        `${periodSplit.payCount} bag${periodSplit.payCount === 1 ? '' : 's'} · ${formatMoney(periodSplit.payGross)}`,
        periodSplit.payFee > 0 ? `− ${formatMoney(periodSplit.payFee)} fee` : null,
        pendingClaimDebitTotal > 0 ? `− ${formatMoney(pendingClaimDebitTotal)} claims` : null,
      ]
        .filter(Boolean)
        .join(' ');

  const shopFeeOwed = periodSplit.shopFee;
  const shopCashCount = periodSplit.shopCount;

  /** Quote app/hub bags and shop-cash bags as separate batches — same grouping admin uses. */
  useEffect(() => {
    if (!session || !holdersReady) return;
    const payRows: SalesReportRow[] = [];
    const shopRows: SalesReportRow[] = [];
    for (const row of visibleAwaiting) {
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
  }, [session, holdersReady, visibleAwaiting, cashHolders]);

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
            style={activePane === 'settlements' ? styles.metricOn : { ...styles.metric, cursor: 'pointer' }}
            onClick={() => setPane('settlements')}
          >
            <span style={styles.metricLabel}>Net paid</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-paid)' }}>
              {formatMoney(settlementSummary.paidNet)}
            </strong>
            <span style={styles.metricHint}>
              {settlementSummary.paidCount > 0
                ? `${settlementSummary.paidCount} settlement${settlementSummary.paidCount === 1 ? '' : 's'}`
                : periodFilterActive
                  ? 'None paid for this period'
                  : 'None marked paid yet'}
            </span>
          </button>

          <button
            type="button"
            style={activePane === 'awaiting' ? styles.metricOnAwaiting : { ...styles.metric, cursor: 'pointer' }}
            onClick={() => setPane('awaiting')}
          >
            <span style={styles.metricLabel}>KoyaKart pays you</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-awaiting)' }}>
              {formatMoney(awaitingDisplayAmount)}
            </strong>
            <span style={styles.metricHint}>{awaitingDisplayHint}</span>
          </button>

          {shopCashCount > 0 ? (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>You owe KoyaKart</span>
              <strong style={styles.metricValueCommission}>{formatMoney(shopFeeOwed)}</strong>
              <span style={styles.metricHint}>
                Fee on {shopCashCount} shop-cash bag{shopCashCount === 1 ? '' : 's'} · pay on Vendor pays KoyaKart
              </span>
            </div>
          ) : null}

          <div style={styles.metric} title={feeTermsLabel ?? undefined}>
            <span style={styles.metricLabel}>Commission</span>
            <strong style={styles.metricValueCommission}>
              {formatMoney(estUnpaidFee > 0 ? estUnpaidFee : settlementSummary.paidCommission)}
            </strong>
            <span style={styles.metricHint}>
              {estUnpaidFee > 0
                ? `Est. on ${visibleAwaiting.length} unsettled · ${formatMoney(settlementSummary.paidCommission)} on paid`
                : settlementSummary.paidCount > 0
                  ? 'On paid settlements'
                  : feeQuote
                    ? 'No fee on unpaid orders'
                    : 'No unpaid orders'}
            </span>
            {feeTermsLabel ? <span style={styles.metricHint}>{feeTermsLabel}</span> : null}
          </div>

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Claim deductions</span>
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

          <div style={styles.metric}>
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
          open={ackTarget != null}
          title="Confirm money received"
          description={
            ackTarget ? (
              <div style={styles.ackBody}>
                <div style={styles.ackAmount}>{formatMoney(ackTarget.netAmount)}</div>
                <div>
                  {ackTarget.payoutMethod ?? 'Payout'} · Txn {ackTarget.transactionReference || 'no ref'}
                </div>
                <div>
                  Orders {formatPeriodRange(ackTarget.periodStart, ackTarget.periodEnd)}
                  {ackTarget.paidAt ? ` · sent ${formatPaidAt(ackTarget.paidAt)}` : ''}
                </div>
                <div style={styles.sub}>Check your bank / UPI app first. This can't be undone.</div>
              </div>
            ) : null
          }
          confirmLabel="Yes, I received it"
          cancelLabel="Not yet"
          busy={ackTarget != null && ackingId === ackTarget.id}
          onConfirm={() => void confirmAcknowledge()}
          onClose={() => setAckTarget(null)}
        />

        <Card padding="sm" style={styles.settlementsCard}>
          <div style={styles.sectionHead}>
            <div style={styles.paneTabs} role="tablist" aria-label="Payout view">
              {(
                [
                  ['orders', `All orders (${visibleOrders.length})`],
                  ['awaiting', `Unpaid (${awaitingPaged.total})`],
                  ['settlements', `Settlements (${total})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activePane === key}
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
            </div>
          </div>
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
          <p style={styles.formulaHint}>
            {activePane === 'orders'
              ? 'Every delivered bag (by order date) with its payout status — paid orders stay visible here.'
              : activePane === 'awaiting'
                ? 'Unsettled delivered bags. Hub / online money: KoyaKart pays you Bag total − fee. Cash with your shop: you keep it and pay only the fee to KoyaKart.'
                : 'Net = Gross − fees − claims − other. Tap a settlement\'s orders to see which bags it paid. Filter matches the orders window.'}
            {periodFrom || periodTo
              ? ` · ${formatDay(periodFrom || null)} → ${formatDay(periodTo || null)}`
              : ''}
          </p>

          {activePane === 'awaiting' && visibleAwaiting.length > 0 ? (
            <MoneyFlowSummary
              title={periodFilterActive ? 'This period' : 'All shown bags'}
              held={periodBuyerMoneyHeld}
              gross={periodAwaitingGross}
              fees={periodAwaitingFee}
              netToVendor={periodSplit.payNet}
              showSettleSteps={false}
              footnote="KoyaKart pays you after a payout batch (gross − fees). Hub COD must be remitted hub → KoyaKart (COD bill). Shop-held COD is settled on Vendor pays KoyaKart."
            />
          ) : null}

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
                        <th style={styles.thPlain}>Placed</th>
                        <th style={styles.thPlain}>Order</th>
                        <th style={styles.thPlain}>Pay</th>
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>Bag total</th>
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>Commission</th>
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>Claims</th>
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>You get</th>
                        <th style={styles.thPlain}>Payout</th>
                        <th style={styles.thPlain}>Settlement</th>
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
                            <td style={styles.tdMuted}>{row.paymentMethod || '—'}</td>
                            <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                            <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                              {m.fee == null ? '—' : `− ${formatMoney(m.fee)}`}
                              {m.fee != null && m.estimated ? <div style={styles.sub}>est.</div> : null}
                            </td>
                            <td style={{ ...styles.tdRight, color: m.claim > 0 ? 'var(--metric-claim)' : 'var(--text-muted)' }}>
                              {m.claim > 0 ? `− ${formatMoney(m.claim)}` : '—'}
                            </td>
                            <td style={{ ...styles.tdRight, color: 'var(--metric-paid)' }}>
                              {m.net == null ? '—' : formatMoney(m.net)}
                              <div style={styles.sub}>
                                {shopHeld
                                  ? paid
                                    ? 'Kept cash · fee paid'
                                    : 'Kept cash · fee owed'
                                  : paid
                                    ? 'From KoyaKart'
                                    : 'KoyaKart to pay'}
                              </div>
                            </td>
                            <td style={styles.td}>
                              <span style={paid ? styles.paid : shopHeld ? styles.feeDue : styles.open}>
                                {paid ? 'PAID' : shopHeld ? 'Fee due' : 'Unpaid'}
                              </span>
                              {paid && payout?.paidAt ? (
                                <div style={styles.sub}>{formatPaidAt(payout.paidAt)}</div>
                              ) : null}
                            </td>
                            <td style={styles.tdMuted}>
                              {paid ? (
                                <>
                                  <div>{formatPeriodRange(payout?.periodStart, payout?.periodEnd)}</div>
                                  <div style={styles.sub}>
                                    {payout?.payoutMethod ?? '—'} · {payout?.transactionReference || 'No txn ref'}
                                  </div>
                                </>
                              ) : (
                                '—'
                              )}
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
                        <td style={styles.tf} />
                        <td style={{ ...styles.tfRight, color: 'var(--metric-paid)' }}>{formatMoney(ordersTotals.paidNet)}</td>
                        <td style={styles.tf} colSpan={2} />
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
                        <td style={styles.tf} />
                        <td style={{ ...styles.tfRight, color: 'var(--metric-paid)' }}>{formatMoney(ordersTotals.unpaidNet)}</td>
                        <td style={styles.tf} colSpan={2} />
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
                        </td>
                        <td style={{ ...styles.tfFinalValue, color: 'var(--metric-claim)' }}>
                          {ordersTotals.claims > 0 ? `− ${formatMoney(ordersTotals.claims)}` : '—'}
                        </td>
                        <td style={styles.tfFinalValue}>
                          {formatMoney(ordersTotals.paidNet + ordersTotals.unpaidNet)}
                        </td>
                        <td style={styles.tfFinal} colSpan={2} />
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
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <SortableTh
                          label="Placed"
                          column="placed"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.th}
                        />
                        <SortableTh
                          label="Order"
                          column="order"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.th}
                        />
                        <SortableTh
                          label="Pay"
                          column="pay"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.th}
                        />
                        <SortableTh
                          label="Buyer cash with"
                          column="cash"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          style={styles.th}
                        />
                        <SortableTh
                          label="Bag total"
                          column="amount"
                          sort={awaitingSort}
                          onSort={(c) => setAwaitingSort((p) => toggleSort(p, c))}
                          align="right"
                          style={styles.th}
                        />
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>Est. fee</th>
                        <th style={{ ...styles.thPlain, textAlign: 'right' }}>KoyaKart pays you</th>
                        <th style={styles.thPlain}>Status</th>
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
                          <td style={styles.tdMuted}>{row.paymentMethod || '—'}</td>
                          <td style={styles.td}>
                            <span style={holderChip(holder.holderRole)}>{holder.holderLabel}</span>
                            {holder.holderDetail ? (
                              <div style={styles.sub}>{holder.holderDetail}</div>
                            ) : null}
                          </td>
                          <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
                          <td style={{ ...styles.tdRight, color: 'var(--metric-commission)' }}>
                            {fee == null ? '—' : `− ${formatMoney(fee)}`}
                          </td>
                          {shopHeld ? (
                            <td style={{ ...styles.tdRight, color: 'var(--text-muted)' }}>
                              {formatMoney(0)}
                              <div style={styles.sub}>
                                You hold {formatMoney(row.subtotal)}
                                {fee != null ? ` · owe ${formatMoney(fee)} fee` : ''}
                              </div>
                            </td>
                          ) : (
                            <td style={{ ...styles.tdRight, color: 'var(--metric-paid)' }}>
                              {fee == null ? '—' : formatMoney(Number(row.subtotal ?? 0) - fee)}
                            </td>
                          )}
                          <td style={styles.td}>
                            <span style={shopHeld ? styles.feeDue : styles.open}>
                              {shopHeld ? 'Fee due' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={styles.tfLabel} colSpan={4}>
                          App / hub money · {periodSplit.payCount} bag{periodSplit.payCount === 1 ? '' : 's'}
                          <div style={styles.sub}>KoyaKart holds this money and pays you</div>
                        </td>
                        <td style={styles.tfRight}>{formatMoney(periodSplit.payGross)}</td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                          {feeQuote ? `− ${formatMoney(periodSplit.payFee)}` : '—'}
                        </td>
                        <td style={{ ...styles.tfRight, color: 'var(--metric-paid)' }}>
                          {feeQuote ? formatMoney(periodSplit.payNet) : '—'}
                        </td>
                        <td style={styles.tf} />
                      </tr>
                      {periodSplit.shopCount > 0 ? (
                        <tr>
                          <td style={styles.tfLabel} colSpan={4}>
                            Cash with your shop · {periodSplit.shopCount} bag{periodSplit.shopCount === 1 ? '' : 's'}
                            <div style={styles.sub}>You already have this cash — only the fee goes to KoyaKart</div>
                          </td>
                          <td style={styles.tfRight}>{formatMoney(periodSplit.shopGross)}</td>
                          <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                            {feeQuote ? `− ${formatMoney(periodSplit.shopFee)}` : '—'}
                          </td>
                          <td style={{ ...styles.tfRight, color: 'var(--text-muted)' }}>{formatMoney(0)}</td>
                          <td style={styles.tf}>
                            <span style={styles.feeDue}>Fee due</span>
                          </td>
                        </tr>
                      ) : null}
                      {pendingClaimDebitTotal > 0 ? (
                        <tr>
                          <td style={styles.tfLabel} colSpan={6}>
                            Pending claim deductions
                            <div style={styles.sub}>Taken from your next payout</div>
                          </td>
                          <td style={{ ...styles.tfRight, color: 'var(--metric-claim)' }}>
                            − {formatMoney(pendingClaimDebitTotal)}
                          </td>
                          <td style={styles.tf} />
                        </tr>
                      ) : null}
                      <tr>
                        <td style={styles.tfFinalLabel} colSpan={6}>
                          Final amount KoyaKart pays you
                          {awaitingPaged.totalPages > 1 ? ' (all pages)' : ''}
                          <div style={styles.sub}>
                            {formatMoney(periodSplit.payGross)} − {formatMoney(periodSplit.payFee)} fee
                            {pendingClaimDebitTotal > 0 ? ` − ${formatMoney(pendingClaimDebitTotal)} claims` : ''}
                          </div>
                        </td>
                        <td style={styles.tfFinalValue}>
                          {feeQuote ? formatMoney(Math.max(0, periodSplit.payNet - pendingClaimDebitTotal)) : '—'}
                        </td>
                        <td style={styles.tfFinal} />
                      </tr>
                      {periodSplit.shopCount > 0 ? (
                        <tr>
                          <td style={styles.tfLabel} colSpan={6}>
                            You pay KoyaKart (fee on shop cash)
                            <div style={styles.sub}>Separate payment on Vendor pays KoyaKart — not deducted above</div>
                          </td>
                          <td style={{ ...styles.tfRight, color: 'var(--metric-commission)' }}>
                            {feeQuote ? formatMoney(periodSplit.shopFee) : '—'}
                          </td>
                          <td style={styles.tf} />
                        </tr>
                      ) : null}
                      <tr>
                        <td style={styles.tfLabel} colSpan={6}>
                          Your total earning · {visibleAwaiting.length} bag{visibleAwaiting.length === 1 ? '' : 's'}
                          <div style={styles.sub}>
                            {formatMoney(periodAwaitingGross)} sales − {formatMoney(periodAwaitingFee)} fees
                            {pendingClaimDebitTotal > 0 ? ` − ${formatMoney(pendingClaimDebitTotal)} claims` : ''}
                            {periodSplit.shopCount > 0
                              ? ` (= KoyaKart payout + ${formatMoney(periodSplit.shopGross - periodSplit.shopFee)} kept from shop cash)`
                              : ''}
                          </div>
                        </td>
                        <td style={styles.tfRight}>
                          {feeQuote
                            ? formatMoney(Math.max(0, periodAwaitingGross - periodAwaitingFee - pendingClaimDebitTotal))
                            : '—'}
                        </td>
                        <td style={styles.tf} />
                      </tr>
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
                      <SortableTh label="Orders window" column="period" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Gross" column="gross" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Commission" column="fee" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Claims" column="claims" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Other" column="other" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Net" column="net" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Paid on" column="paidAt" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <th style={styles.thPlain}>Mode / txn</th>
                      <th style={styles.thPlain}>Received</th>
                      <th style={styles.thPlain}>Bill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s) => {
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
                      <tr>
                        <td style={styles.td}>
                          <div style={styles.periodMain}>
                            {formatPeriodRange(s.periodStart, s.periodEnd)}
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
                        <td style={styles.tdRight}>{formatMoney(s.commissionAmount)}</td>
                        <td style={{ ...styles.tdRight, color: claims > 0 ? 'var(--metric-claim)' : undefined }}>
                          {formatMoney(claims)}
                          {claimLines.length > 0 ? (
                            <div style={styles.sub}>
                              {claimLines.length} chargeback{claimLines.length === 1 ? '' : 's'}
                            </div>
                          ) : claims > 0 ? (
                            <div style={styles.sub}>Buyer credit clawback</div>
                          ) : null}
                        </td>
                        <td style={{ ...styles.tdRight, color: other > 0 ? 'var(--metric-other)' : undefined }}>
                          {formatMoney(other)}
                          {otherLines.length > 0 ? (
                            <div style={styles.sub}>
                              {otherLines.map((l) => l.description || 'Charge').join(' · ')}
                            </div>
                          ) : null}
                        </td>
                        <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                        <td style={styles.td}>
                          <span style={s.status === 'PAID' ? styles.paid : styles.open}>{s.status}</span>
                        </td>
                        <td style={styles.tdMuted}>
                          {s.paidAt ? (
                            <>
                              <div>{formatPaidAt(s.paidAt)}</div>
                              <div style={styles.sub}>Money sent</div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={styles.td}>
                          {s.status === 'PAID' ? (
                            <>
                              <div>{s.payoutMethod ?? '—'}</div>
                              <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                            </>
                          ) : (
                            <span style={styles.sub}>Not paid yet</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {s.status !== 'PAID' ? (
                            <span style={styles.sub}>—</span>
                          ) : s.vendorAcknowledgedAt ? (
                            <>
                              <span style={styles.paid}>RECEIVED</span>
                              <div style={styles.sub}>{formatPaidAt(s.vendorAcknowledgedAt)}</div>
                            </>
                          ) : (
                            <button
                              type="button"
                              style={styles.ackBtn}
                              disabled={ackingId === s.id}
                              onClick={() => setAckTarget(s)}
                            >
                              {ackingId === s.id ? 'Saving…' : 'Ack receipt'}
                            </button>
                          )}
                        </td>
                        <td style={styles.td}>
                          {s.status === 'PAID' ? (
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
                                  <th style={styles.thPlain}>Placed</th>
                                  <th style={styles.thPlain}>Pay</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>Bag total</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>Commission</th>
                                  <th style={{ ...styles.thPlain, textAlign: 'right' }}>You get</th>
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
                                        <strong>{l.orderNumber ?? sale?.orderNumber ?? 'Order'}</strong>
                                        <div style={styles.sub}>{l.subOrderNumber ?? sale?.subOrderNumber ?? ''}</div>
                                      </td>
                                      <td style={styles.tdMuted}>
                                        {sale?.placedAt
                                          ? new Date(sale.placedAt).toLocaleString(undefined, {
                                              day: '2-digit',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })
                                          : '—'}
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
                      <td style={styles.tfRight}>{formatMoney(settlementTotals.commission)}</td>
                      <td style={{ ...styles.tfRight, color: settlementTotals.claims > 0 ? 'var(--metric-claim)' : undefined }}>
                        {formatMoney(settlementTotals.claims)}
                      </td>
                      <td style={{ ...styles.tfRight, color: settlementTotals.other > 0 ? 'var(--metric-other)' : undefined }}>
                        {formatMoney(settlementTotals.other)}
                      </td>
                      <td style={styles.tfRight}>{formatMoney(settlementTotals.net)}</td>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8.8rem), 1fr))',
    gap: '0.4rem',
    flexShrink: 0,
  },
  metric: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.4rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'default',
    width: '100%',
    boxSizing: 'border-box',
  },
  metricOn: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.4rem 0.5rem',
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
    padding: '0.4rem 0.5rem',
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
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: '1.28rem', fontWeight: 800, lineHeight: 1.1 },
  metricValueCommission: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1.2,
    color: 'var(--metric-commission)',
  },
  metricValueClaim: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  metricHint: { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 },
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
  ackBody: { display: 'grid', gap: '0.3rem', color: 'var(--text)' },
  ackAmount: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--metric-paid, #15803d)' },
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
