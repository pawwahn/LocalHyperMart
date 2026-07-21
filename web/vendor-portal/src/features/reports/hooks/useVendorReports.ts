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
import { lookupOrderPayouts, listMySettlements, summarizeSettlements, type OrderPayout } from '../api/payoutsApi';

export type ReportPreset = 'today' | 'week' | 'month' | 'custom';
export type PayoutFilter = 'all' | 'paid' | 'unpaid';

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

export function useVendorReports() {
  const { session } = useAuth();
  const initial = rangeForPreset('week');
  const [preset, setPreset] = useState<ReportPreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [includeItems, setIncludeItems] = useState(true);
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('all');
  const [report, setReport] = useState<SalesReport | null>(null);
  const [payoutsBySubOrder, setPayoutsBySubOrder] = useState<Record<string, OrderPayout>>({});
  const [settlementMoney, setSettlementMoney] = useState(() => summarizeSettlements([]));
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSalesReport(session.accessToken, session.vendorId, {
        from,
        to,
        // Always load line items so rows can expand/collapse in the UI.
        includeItems: true,
      });
      setReport(data);
      try {
        const [payouts, settlements] = await Promise.all([
          lookupOrderPayouts(
            session.accessToken,
            session.vendorId,
            (data.rows ?? []).map((r) => r.subOrderId),
          ),
          listMySettlements(session.accessToken, session.vendorId),
        ]);
        setPayoutsBySubOrder(payouts);
        setSettlementMoney(summarizeSettlements(settlements));
      } catch {
        setPayoutsBySubOrder({});
        setSettlementMoney(summarizeSettlements([]));
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [session, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const payoutSummary = useMemo(() => {
    if (!report) return { paidOrders: 0, unpaidOrders: 0, paidAmount: 0, unpaidAmount: 0 };
    let paidOrders = 0;
    let unpaidOrders = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    for (const row of report.rows) {
      const payout = payoutsBySubOrder[row.subOrderId];
      if (payout?.paid) {
        paidOrders += 1;
        paidAmount += Number(payout.amount ?? row.subtotal ?? 0);
      } else {
        unpaidOrders += 1;
        unpaidAmount += Number(row.subtotal ?? 0);
      }
    }
    return { paidOrders, unpaidOrders, paidAmount, unpaidAmount };
  }, [report, payoutsBySubOrder]);

  const moneyClarity = useMemo(() => {
    const gross = Number(report?.grossSales ?? 0);
    const awaitingOrders = payoutSummary.unpaidAmount;
    const settledOrders = payoutSummary.paidAmount;
    const fee = settlementMoney.paidCommission + settlementMoney.awaitingSettlementCommission;
    const netReceivable =
      settlementMoney.awaitingSettlementNet > 0
        ? settlementMoney.awaitingSettlementNet
        : Math.max(0, awaitingOrders);
    const netReceived = settlementMoney.paidNet;
    return {
      gross,
      awaitingOrders,
      settledOrders,
      fee,
      netReceivable,
      netReceived,
      feeLabel: formatMoney(fee),
      netReceivableLabel: formatMoney(netReceivable),
      netReceivedLabel: formatMoney(netReceived),
    };
  }, [report, payoutSummary, settlementMoney]);

  const visibleRows = useMemo((): SalesReportRow[] => {
    if (!report) return [];
    if (payoutFilter === 'all') return report.rows;
    return report.rows.filter((row) => {
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
