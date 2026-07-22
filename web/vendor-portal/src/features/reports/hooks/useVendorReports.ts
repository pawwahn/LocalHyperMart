import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  exportSalesReportCsv,
  exportSalesReportExcel,
  exportSalesReportPdf,
  fetchSalesReport,
  formatMoney,
  type SalesReport,
  type SalesReportRow,
} from '../api/reportsApi';
import { lookupOrderPayouts, listMyClaimAdjustments, listMySettlements, summarizeSettlements, type OrderPayout, type SettlementMoneySummary, type VendorClaimAdjustment } from '../api/payoutsApi';

export type ReportPreset = 'today' | 'week' | 'month' | 'custom';
export type PayoutFilter = 'all' | 'paid' | 'unpaid';

export function isRejectedSalesStatus(status: string | null | undefined): boolean {
  return status === 'VENDOR_REJECTED' || status === 'REJECTED';
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function rangeForPreset(preset: ReportPreset): { from: string; to: string } {
  const today = new Date();
  const to = isoDate(today);
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to };
  }
  if (preset === 'month') {
    return { from: isoDate(startOfMonth(today)), to };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from: isoDate(from), to };
}

type ReportsCache = {
  vendorId: string;
  from: string;
  to: string;
  report: SalesReport;
  payoutsBySubOrder: Record<string, OrderPayout>;
  settlementMoney: SettlementMoneySummary;
  claimAdjustments: VendorClaimAdjustment[];
};

let reportsCache: ReportsCache | null = null;

function reportsCacheFor(vendorId: string, from: string, to: string): ReportsCache | null {
  return reportsCache?.vendorId === vendorId && reportsCache.from === from && reportsCache.to === to
    ? reportsCache
    : null;
}

export function useVendorReports() {
  const { session } = useAuth();
  const initial = rangeForPreset('week');
  const [preset, setPreset] = useState<ReportPreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [includeItems, setIncludeItems] = useState(true);
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('all');
  const cached = session ? reportsCacheFor(session.vendorId, initial.from, initial.to) : null;
  const [report, setReport] = useState<SalesReport | null>(cached?.report ?? null);
  const [payoutsBySubOrder, setPayoutsBySubOrder] = useState<Record<string, OrderPayout>>(
    cached?.payoutsBySubOrder ?? {},
  );
  const [settlementMoney, setSettlementMoney] = useState(
    () => cached?.settlementMoney ?? summarizeSettlements([]),
  );
  const [claimAdjustments, setClaimAdjustments] = useState<VendorClaimAdjustment[]>(
    cached?.claimAdjustments ?? [],
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((next: ReportPreset) => {
    setPreset(next);
    if (next !== 'custom') {
      const range = rangeForPreset(next);
      setFrom(range.from);
      setTo(range.to);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    const soft = Boolean(reportsCacheFor(session.vendorId, from, to));
    if (!soft) setLoading(true);
    setError(null);
    try {
      const data = await fetchSalesReport(session.accessToken, session.vendorId, {
        from,
        to,
        // Always load line items so rows can expand/collapse in the UI.
        includeItems: true,
      });
      setReport(data);
      setLoading(false);

      let payouts: Record<string, OrderPayout> = {};
      let settlementsSummary = summarizeSettlements([]);
      let adjustments: VendorClaimAdjustment[] = [];
      try {
        const [nextPayouts, settlements, nextAdjustments] = await Promise.all([
          lookupOrderPayouts(
            session.accessToken,
            session.vendorId,
            (data.rows ?? []).map((r) => r.subOrderId),
          ),
          listMySettlements(session.accessToken, session.vendorId),
          listMyClaimAdjustments(session.accessToken, session.vendorId).catch(
            () => [] as VendorClaimAdjustment[],
          ),
        ]);
        payouts = nextPayouts;
        settlementsSummary = summarizeSettlements(settlements);
        adjustments = nextAdjustments;
        setPayoutsBySubOrder(payouts);
        setSettlementMoney(settlementsSummary);
        setClaimAdjustments(adjustments);
      } catch {
        setPayoutsBySubOrder({});
        setSettlementMoney(summarizeSettlements([]));
        setClaimAdjustments([]);
      }

      reportsCache = {
        vendorId: session.vendorId,
        from,
        to,
        report: data,
        payoutsBySubOrder: payouts,
        settlementMoney: settlementsSummary,
        claimAdjustments: adjustments,
      };
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load report');
      setLoading(false);
    }
  }, [session, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingClaimDebitTotal = useMemo(
    () =>
      claimAdjustments
        .filter((a) => a.status === 'PENDING')
        .reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    [claimAdjustments],
  );

  const payoutSummary = useMemo(() => {
    if (!report) {
      return { paidOrders: 0, unpaidOrders: 0, paidAmount: 0, unpaidAmount: 0, rejectedOrders: 0 };
    }
    let paidOrders = 0;
    let unpaidOrders = 0;
    let rejectedOrders = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    for (const row of report.rows) {
      if (isRejectedSalesStatus(row.status)) {
        rejectedOrders += 1;
        continue;
      }
      const payout = payoutsBySubOrder[row.subOrderId];
      if (payout?.paid) {
        paidOrders += 1;
        paidAmount += Number(payout.amount ?? row.subtotal ?? 0);
      } else {
        unpaidOrders += 1;
        unpaidAmount += Number(row.subtotal ?? 0);
      }
    }
    return { paidOrders, unpaidOrders, paidAmount, unpaidAmount, rejectedOrders };
  }, [report, payoutsBySubOrder]);

  const moneyClarity = useMemo(() => {
    const gross = Number(report?.grossSales ?? 0);
    const awaitingOrders = payoutSummary.unpaidAmount;
    const settledOrders = payoutSummary.paidAmount;
    const fee = settlementMoney.paidCommission + settlementMoney.awaitingSettlementCommission;
    const baseReceivable =
      settlementMoney.awaitingSettlementNet > 0
        ? settlementMoney.awaitingSettlementNet
        : Math.max(0, awaitingOrders);
    const netReceivable = Math.max(0, baseReceivable - pendingClaimDebitTotal);
    const netReceived = settlementMoney.paidNet;
    return {
      gross,
      awaitingOrders,
      settledOrders,
      fee,
      pendingClaimDebitTotal,
      netReceivable,
      netReceived,
      feeLabel: formatMoney(fee),
      netReceivableLabel: formatMoney(netReceivable),
      netReceivedLabel: formatMoney(netReceived),
    };
  }, [report, payoutSummary, settlementMoney, pendingClaimDebitTotal]);

  const visibleRows = useMemo((): SalesReportRow[] => {
    if (!report) return [];
    if (payoutFilter === 'all') return report.rows;
    return report.rows.filter((row) => {
      if (isRejectedSalesStatus(row.status)) return false;
      const paid = Boolean(payoutsBySubOrder[row.subOrderId]?.paid);
      return payoutFilter === 'paid' ? paid : !paid;
    });
  }, [report, payoutFilter, payoutsBySubOrder]);

  function exportSlice(): SalesReport | null {
    if (!report) return null;
    return { ...report, rows: visibleRows, includeItems };
  }

  function downloadCsv() {
    const slice = exportSlice();
    if (!slice) return;
    exportSalesReportCsv(slice, payoutsBySubOrder);
  }

  function downloadExcel() {
    const slice = exportSlice();
    if (!slice) return;
    exportSalesReportExcel(slice, payoutsBySubOrder, payoutSummary);
  }

  function downloadPdf() {
    const slice = exportSlice();
    if (!slice) return;
    exportSalesReportPdf(slice, payoutsBySubOrder, payoutSummary);
  }

  return {
    preset,
    applyPreset,
    from,
    setFrom,
    to,
    setTo,
    includeItems,
    setIncludeItems,
    payoutFilter,
    setPayoutFilter,
    report,
    visibleRows,
    payoutsBySubOrder,
    payoutSummary,
    settlementMoney,
    moneyClarity,
    loading,
    error,
    reload,
    downloadCsv,
    downloadExcel,
    downloadPdf,
    setPresetCustom: () => setPreset('custom'),
  };
}
