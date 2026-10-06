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
import { DeliveryPayoutPanel } from '../components/DeliveryPayoutPanel';
import { displayPayeeLabel } from '@/shared/display/displayNames';
import { ListPager } from '../components/ListPager';
import {
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

function isPlacedInRange(placedAt: string | null | undefined, from: string, to: string): boolean {
  const day = placedDateInIst(placedAt);
  if (!day) return false;
  return day >= from && day <= to;
}

/** Oldest placed time first so the list reads top to bottom through the range. */
function oldestFirst(a: SettlementCandidate, b: SettlementCandidate): number {
  const ta = a.placedAt ? Date.parse(a.placedAt) : Number.POSITIVE_INFINITY;
  const tb = b.placedAt ? Date.parse(b.placedAt) : Number.POSITIVE_INFINITY;
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
          : ['VENDOR_PAYOUT', 'VENDOR_COLLECTION'],
    prefixes:
      tab === 'AGENT'
        ? ['Paid AGENT', 'Paid agent']
        : tab === 'HUB'
          ? ['Collected franchise', 'Paid HUB', 'Paid hub']
          : ['Paid vendor', 'Collected from vendor'],
    emptyHint:
      tab === 'AGENT'
        ? 'No agent payout changes for this town.'
        : tab === 'HUB'
          ? 'No hub payout or franchise collection changes for this town.'
          : 'No vendor payout or fee-collection changes for this town.',
  };
}

export function SettlementsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const initial = rangeForReportPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [periodType, setPeriodType] = useState<SettlementPeriodKind>(settlementPeriodKind('week'));
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
  const [tab, setTab] = useState<'VENDOR' | 'HUB' | 'AGENT'>('VENDOR');
  const [vendorTab, setVendorTab] = useState<VendorPayoutTab>('app-to-vendor');
  const [vendorAppSubTab, setVendorAppSubTab] = useState<VendorAppSubTab>('pay');
  const [vendorPaysSubTab, setVendorPaysSubTab] = useState<VendorPaysSubTab>('collect');
  const [vendorRecordsLoaded, setVendorRecordsLoaded] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(DEFAULT_HISTORY_PAGE_SIZE);
  const collectFromVendor = vendorTab === 'vendor-to-app';
  const vendorTabRef = useRef(vendorTab);
  vendorTabRef.current = vendorTab;
  const [deliveryRefreshTick, setDeliveryRefreshTick] = useState(0);
  const [codRefreshTick, setCodRefreshTick] = useState(0);
  const [orderSearch, setOrderSearch] = useState('');
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

  const payoutHistory = useMemo(
    () => history.filter((s) => (s.direction ?? 'PAYOUT').toUpperCase() !== 'COLLECTION'),
    [history],
  );

  const collectionHistory = useMemo(
    () => history.filter((s) => (s.direction ?? '').toUpperCase() === 'COLLECTION'),
    [history],
  );

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

  const orderPageCount = Math.max(1, Math.ceil(filteredCandidates.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderPageCount - 1);

  const pagedCandidates = useMemo(() => {
    const start = safeOrderPage * orderPageSize;
    return filteredCandidates.slice(start, start + orderPageSize);
  }, [filteredCandidates, safeOrderPage, orderPageSize]);

  const selectedFingerprint = useMemo(
    () => Array.from(selected).sort().join('\n'),
    [selected],
  );

  useEffect(() => {
    setOrderPage(0);
  }, [candidates.length, orderSearch, orderPageSize, townId, vendorId, from, to]);

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

  const expectedNet = useMemo(() => {
    if (collectFromVendor) {
      return roundMoney(commissionNum + otherChargesNum);
    }
    const afterFees =
      feeQuote?.suggestedNet != null
        ? roundMoney(Number(feeQuote.suggestedNet))
        : roundMoney(selectedTotal - commissionNum);
    return Math.max(0, roundMoney(afterFees - pendingClaimChargebacks - otherChargesNum));
  }, [
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
    if (!collectFromVendor && selected.size === 0) {
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
            includeSubscription: collectFromVendor,
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
    // Strict placed-date filter (IST calendar day) so UI matches the From/To pickers.
    const items = (data.items ?? [])
      .filter((i) => isPlacedInRange(i.placedAt, from, to))
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
      const candidateErr = await reloadCandidates().then(
        () => null,
        (err: unknown) =>
          err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payout orders',
      );
      const historyErr =
        vendorRecordsLoaded
          ? await reloadHistory().then(
              () => null,
              (err: unknown) =>
                err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payout history',
            )
          : null;
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
  }, [token, townId, vendorId, reloadMeta, reloadCandidates, reloadHistory, vendorRecordsLoaded]);

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
      setError('Nothing to collect — no monthly fee, commission, or extra charge.');
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
      setVendorRecordsLoaded(true);
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

  function openVendorRecords(which: 'pay' | 'collect') {
    if (which === 'pay') setVendorAppSubTab('records');
    else setVendorPaysSubTab('records');
    setVendorRecordsLoaded(true);
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
          ? 'Fees received from this shop (not goods payouts).'
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
                        {s.status === 'PAID' && !isCollection ? (
                          <div style={styles.sub}>
                            {s.vendorAcknowledgedAt
                              ? `Vendor ack · ${new Date(s.vendorAcknowledgedAt).toLocaleString(undefined, {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : 'Awaiting vendor ack'}
                          </div>
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
            onTab={setVendorTab}
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
            payOpenCount={payOpenCount}
            collectOpenCount={collectOpenCount}
            selectedCount={selected.size}
            selectedGross={selectedTotal}
            expectedNet={expectedNet}
            loading={loading}
            saving={saving}
            canSubmit={canPay}
            submitHint={canPay ? null : payHint}
            onRefresh={() => void reload()}
            onSubmit={requestMarkPaid}
            workSection={
      <div className="sp-layout">
        <div className="sp-main">
          <Card padding="sm" style={styles.cardPad}>
            <div style={styles.tableHead}>
              <h2 style={styles.sectionTitle}>
                {collectFromVendor ? 'Shop-held COD' : 'Pay bags'}{' '}
                <span style={styles.count}>
                  {scopedCandidates.length} bag{scopedCandidates.length === 1 ? '' : 's'} · {selected.size} selected ·{' '}
                  {formatMoney(selectedTotal)} gross
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
            ) : scopedCandidates.length === 0 ? (
              <p style={styles.muted}>
                {collectFromVendor
                  ? 'No shop-held COD in this range. Monthly fee can still be collected if due.'
                  : 'No bags where KoyaKart or the hub holds cash in this range.'}
              </p>
            ) : filteredCandidates.length === 0 ? (
              <p style={styles.muted}>No bags match your search.</p>
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
                    total={filteredCandidates.length}
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
                      <th style={styles.th}>Placed</th>
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
                                : stage === 'WITH_VENDOR'
                                  ? styles.codVendorBadge
                                  : stage === 'DECLARED_TO_VENDOR' || stage === 'DECLARED_TO_HUB'
                                    ? styles.codDeclaredBadge
                                    : styles.codAgentBadge;
                            const title =
                              stage === 'AT_HUB'
                                ? 'Hub recorded agent remittance (close-day)'
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
                  <strong style={styles.netValue}>{formatMoney(expectedNet)}</strong>
                </div>

                {grossMismatch ? (
                  <p style={styles.feeError}>
                    Selected bags total ({formatMoney(selectedTotal)}) does not match billing gross (
                    {formatMoney(quoteGross)}). Refresh or re-select orders.
                  </p>
                ) : null}

                {(selectedCashSplit.codWithAgent > 0 ||
                  selectedCashSplit.codAtHub > 0 ||
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
                    <span>{collectFromVendor ? 'Fees to collect' : 'Billing fees'}</span>
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
                        <li key={line}>{line}</li>
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
              <Button size="sm" disabled={!canPay} onClick={requestMarkPaid}>
                {saving
                  ? 'Saving…'
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
  req: { color: '#b91c1c', fontWeight: 800 },
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
