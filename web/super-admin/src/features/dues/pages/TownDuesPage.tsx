import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePlatformAdminAccess } from '@/shared/auth/usePlatformAdminAccess';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog } from '@/shared/ui';
import {
  confirmVendorBillPayment,
  createDeliverySettlement,
  createSettlement,
  fetchDeliverySettlementCandidates,
  fetchSettlementCandidates,
  markSettlementPaid,
  rejectVendorBillPayment,
  sendSubscriptionBill,
  sendVendorCollectionBill,
  type SettlementCandidate,
  type SettlementVm,
} from '@/features/settlements/api/settlementsApi';
import {
  createHubCodPaymentRequest,
  createHubFranchisePaymentRequest,
  waiveHubFranchiseMonth,
} from '@/features/settlements/api/hubPaymentRequestApi';
import { rejectHubPaymentSubmission, verifyHubPaymentSubmission } from '@/features/settlements/api/hubPaymentApi';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listHubs } from '@/features/hubs/api/hubsApi';
import { listAllAgents } from '@/features/agents/api/agentsApi';
import { rangeForReportPreset, type ReportDatePreset } from '@/shared/dates/istReportPresets';
import {
  fetchTownDues,
  type DueAction,
  type DueParty,
  type TownDueLine,
  type TownDuesReport,
} from '../api/townDuesApi';
import { mergeTownDuesReports } from '../api/mergeTownDues';
import { TownDuesCalendar, type DuesCalendarItem } from '../components/TownDuesCalendar';
import { BankPaidOnField } from '@/features/settlements/BankPaidOnField';
import { defaultBankPaidOn, todayIstDate, validateBankPaidOn } from '@/features/settlements/bankPaidOnUtils';
import { settlementsVendorCollectUrl } from '../accountsDeepLinks';

type Preset = 'open' | ReportDatePreset;
type LedgerTab = 'dues' | 'pay';

const RECEIVE_ACTIONS: DueAction[] = ['SEND_BILL', 'COLLECT', 'CONFIRM'];

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'open', label: 'All open' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'previousMonth', label: 'Prev month' },
  { id: 'financialYear', label: 'FY' },
];

const LAYOUTS: { id: 'list' | 'week' | 'month'; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const RECEIVE_CHIPS: { id: DueAction; label: string }[] = [
  { id: 'SEND_BILL', label: 'Send bill' },
  { id: 'COLLECT', label: 'Collect' },
  { id: 'CONFIRM', label: 'Confirm' },
];

function money(value?: number | null): string {
  return `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function feeCell(value?: number | null): string {
  if (value == null) return '—';
  return money(value);
}

function orderCountCell(line: TownDueLine): string {
  if (!line.itemCount) return '—';
  if (line.upiOrderCount != null && line.upiOrderCount > 0 && line.upiOrderCount !== line.itemCount) {
    return `${line.itemCount} (${line.upiOrderCount} UPI)`;
  }
  return String(line.itemCount);
}

function shopCodCell(line: TownDueLine): string {
  return feeCell(line.shopCodCash);
}

type LedgerAmtKind = 'upi' | 'cod' | 'count' | 'fee' | 'total';

function ledgerNumTd(display: string, kind: LedgerAmtKind, moneyStart?: boolean) {
  const empty = display === '—' || display === '…';
  const classes = [
    'dues-td-num',
    `dues-amt-${kind}`,
    empty ? 'is-empty' : '',
    moneyStart ? 'dues-money-start' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <td className={classes}>{display}</td>;
}

function ledgerMoneyTd(value?: number | null, kind: LedgerAmtKind = 'fee') {
  const empty = value == null;
  return ledgerNumTd(empty ? '—' : money(value), kind, kind === 'upi');
}

/** A blank total is not ₹0. Show the figure only after the report has arrived. */
function figure(ready: boolean, value?: number | null): string {
  return ready ? money(value) : '…';
}

function day(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function period(line: TownDueLine): string {
  if (!line.periodStart && !line.periodEnd) return '—';
  const start = line.periodStart || line.periodEnd;
  const end = line.periodEnd || line.periodStart;
  if (!start || !end) return day(start || end);
  if (start.slice(0, 10) === end.slice(0, 10)) return dayCompact(start);
  return `${dayCompact(start)}–${dayCompact(end)}`;
}

function dayCompact(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Detail for context only — fee amounts live in columns. */
function compactDetail(line: TownDueLine): string | null {
  const raw = line.detail?.trim();
  if (!raw) return null;
  const stripped = raw
    .replace(/\s*·\s*commission\s*₹[\d,.]+/gi, '')
    .replace(/\s*·\s*platform fee\s*₹[\d,.]+/gi, '')
    .replace(/\s*·\s*COD fee\s*₹[\d,.]+/gi, '')
    .replace(/\s*·\s*delivery plan\s*₹[\d,.]+/gi, '')
    .replace(/\s*·\s*fees\s*₹[\d,.]+/gi, '')
    .replace(/\s*·\s*membership\s*₹[\d,.]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || null;
}

function partyLabel(party: DueParty): string {
  if (party === 'HUB') return 'Hub';
  if (party === 'VENDOR') return 'Vendor';
  return 'Delivery agent';
}

function isSubscription(line: TownDueLine): boolean {
  return (line.what || '').toLowerCase().includes('subscription');
}

function actionLabel(line: TownDueLine): string {
  if (line.action === 'PAY') return 'Pay';
  if (line.action === 'COLLECT') return 'Collect';
  if (line.action === 'CONFIRM') return 'Confirm';
  if (line.party === 'VENDOR' && (line.commission != null || isSubscription(line))) return 'Collect';
  return 'Bill';
}

function sendBillButtonLabel(line: TownDueLine): string {
  if (line.action !== 'SEND_BILL') return actionLabel(line);
  if (isSubscription(line)) return 'Send bill';
  if (line.party === 'VENDOR' && line.commission != null) return 'Send bill';
  if (line.party === 'HUB') return 'Send bill';
  return 'Send bill';
}

function isHubFranchiseSend(line: TownDueLine): boolean {
  return line.party === 'HUB' && (line.what || '').toLowerCase().includes('franchise');
}

function hubCodPeriodParams(line: TownDueLine): {
  periodKind: string;
  periodStart: string;
  periodEnd?: string;
} {
  const start = line.periodStart!.slice(0, 10);
  const end = (line.periodEnd || line.periodStart)!.slice(0, 10);
  if (start === end) {
    return { periodKind: 'DAILY', periodStart: start, periodEnd: start };
  }
  return { periodKind: 'CUSTOM', periodStart: start, periodEnd: end };
}

const PAY_METHODS: { value: string; label: string }[] = [
  { value: 'UPI', label: 'UPI / GPay' },
  { value: 'NEFT', label: 'Bank — NEFT' },
  { value: 'IMPS', label: 'Bank — IMPS' },
  { value: 'RTGS', label: 'Bank — RTGS' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
];

function shopHoldsCash(item: SettlementCandidate): boolean {
  if ((item.paymentMethod || '').trim().toUpperCase() !== 'COD') return false;
  const loc = (item.codCashLocation || 'WITH_AGENT').trim();
  if (loc === 'WITH_VENDOR' || loc === 'DECLARED_TO_VENDOR') return true;
  if (item.vendorAgentDelivery) return loc !== 'AT_HUB' && loc !== 'DECLARED_TO_HUB';
  return false;
}

function whatHeadline(line: TownDueLine): string {
  if (isSubscription(line)) return 'Monthly subscription';
  if (line.party === 'VENDOR' && line.commission != null && line.action !== 'PAY') {
    return 'Shop-held COD — collect fees (right)';
  }
  if (line.party === 'VENDOR' && line.action === 'PAY') {
    return Number(line.commission ?? 0) > 0
      ? 'KoyaKart payout to shop (commission already withheld).'
      : 'KoyaKart pays the shop. No commission on these bags.';
  }
  return line.what;
}

export function TownDuesPage() {
  const { session } = useAuth();
  const { canMoveMoney, canIssueBills } = usePlatformAdminAccess();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkApplied = useRef(false);
  const token = session?.accessToken ?? '';
  const [preset, setPreset] = useState<Preset>('open');
  const [layout, setLayout] = useState<'list' | 'week' | 'month'>('list');
  const [cursor, setCursor] = useState(todayIso);
  const [tab, setTab] = useState<LedgerTab>('dues');
  const [townId, setTownId] = useState('');
  const [party, setParty] = useState<DueParty | ''>('');
  const [partyId, setPartyId] = useState('');
  const [action, setAction] = useState<DueAction | ''>('');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [hubNames, setHubNames] = useState<Map<string, string>>(new Map());
  const [loginPhones, setLoginPhones] = useState<Map<string, string>>(new Map());
  const [report, setReport] = useState<TownDuesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanningOpen, setScanningOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState<{ line: TownDueLine; who: string } | null>(null);
  const [comment, setComment] = useState('');
  const [confirmBankPaidOn, setConfirmBankPaidOn] = useState('');
  const [pay, setPay] = useState<{ line: TownDueLine; who: string; townId: string } | null>(null);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [billSend, setBillSend] = useState<{ line: TownDueLine; who: string; townId: string } | null>(null);
  const [franchiseRemove, setFranchiseRemove] = useState<{
    line: TownDueLine;
    who: string;
    townId: string;
  } | null>(null);

  const range = preset === 'open' ? undefined : rangeForReportPreset(preset);
  const loadDirectory = useCallback(async () => {
    if (!token) return;
    try {
      const [townList, hubs, agents] = await Promise.all([
        listTowns(token),
        listHubs(token).catch(() => []),
        listAllAgents(token).catch(() => []),
      ]);
      setTowns(townList);
      const phones = new Map<string, string>();
      for (const hub of hubs) {
        const login = (hub.adminPhone || hub.phone || '').trim();
        if (hub.hubId && login) phones.set(hub.hubId, login);
      }
      for (const agent of agents) {
        const login = agent.phone?.trim();
        if (agent.agentId && login) phones.set(agent.agentId, login);
      }
      setHubNames(new Map(hubs.map((hub) => [hub.hubId, hub.name])));
      setLoginPhones(phones);
    } catch {
      // Shop names come from the dues report; phones are optional.
    }
  }, [token]);

  const loadDues = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setScanningOpen(false);
    setError(null);
    try {
      const town = townId || undefined;
      const [ledger, payOpen] = await Promise.all([
        fetchTownDues(token, range, town, false),
        fetchTownDues(token, range, town, true, true, 'PAY'),
      ]);
      setReport(mergeTownDuesReports(ledger, payOpen));
      setLoading(false);
      setScanningOpen(true);
      const receiveOpen = await fetchTownDues(
        token,
        range,
        town,
        true,
        true,
        'SEND_BILL,COLLECT,CONFIRM',
      );
      const openWork = mergeTownDuesReports(payOpen, receiveOpen);
      setReport(mergeTownDuesReports(ledger, openWork));
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load accounts');
    } finally {
      setLoading(false);
      setScanningOpen(false);
    }
  }, [token, range?.from, range?.to, townId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (deepLinkApplied.current) return;
    const qTown = searchParams.get('townId') ?? '';
    const qParty = (searchParams.get('party') ?? '') as DueParty | '';
    const qPartyId = searchParams.get('partyId') ?? '';
    const qAction = (searchParams.get('action') ?? '') as DueAction | '';
    if (!qTown && !qParty && !qPartyId && !qAction) return;
    deepLinkApplied.current = true;
    if (qTown) setTownId(qTown);
    if (qParty === 'HUB' || qParty === 'VENDOR' || qParty === 'AGENT') setParty(qParty);
    if (qPartyId) setPartyId(qPartyId);
    if (qAction === 'SEND_BILL' || qAction === 'COLLECT' || qAction === 'CONFIRM') {
      setTab('dues');
      setAction(qAction);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('townId');
    next.delete('party');
    next.delete('partyId');
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    void loadDues();
  }, [loadDues]);

  const townName = useCallback(
    (id: string) => towns.find((town) => town.id === id)?.displayName || 'Town',
    [towns],
  );

  const partyName = useCallback(
    (line: TownDueLine) =>
      line.party === 'HUB'
        ? hubNames.get(line.partyId || '') || line.partyName || 'Hub'
        : line.partyName || partyLabel(line.party),
    [hubNames],
  );

  const partyPhone = useCallback(
    (line: TownDueLine) => (line.partyId ? loginPhones.get(line.partyId) : undefined),
    [loginPhones],
  );

  const scoped = useMemo(() => {
    const source = report?.towns ?? [];
    return source
      .filter((town) => !townId || town.townId === townId)
      .map((town) => ({
        ...town,
        lines: town.lines.filter((line) => {
          if (party && line.party !== party) return false;
          if (partyId && (line.partyId ?? '') !== partyId) return false;
          return true;
        }),
      }))
      .filter((town) => town.lines.length > 0);
  }, [report, townId, party, partyId]);

  const ready = report != null;

  const headline = useMemo(() => {
    const sum = (actions: DueAction[]) =>
      scoped.reduce(
        (total, town) =>
          total + town.lines.filter((line) => actions.includes(line.action)).reduce((inner, line) => inner + Number(line.amount || 0), 0),
        0,
      );
    const chip = (id: DueAction) =>
      scoped.reduce(
        (total, town) => total + town.lines.filter((line) => line.action === id).reduce((inner, line) => inner + Number(line.amount || 0), 0),
        0,
      );
    return {
      receive: sum(RECEIVE_ACTIONS),
      pay: sum(['PAY']),
      sendBill: chip('SEND_BILL'),
      collect: chip('COLLECT'),
      confirm: chip('CONFIRM'),
    };
  }, [scoped]);

  const view = useMemo(() => {
    const allowed = tab === 'pay' ? (['PAY'] as DueAction[]) : RECEIVE_ACTIONS;
    return scoped
      .map((town) => ({
        ...town,
        lines: town.lines.filter((line) => allowed.includes(line.action) && (!action || line.action === action)),
      }))
      .filter((town) => town.lines.length > 0);
  }, [scoped, tab, action]);

  function canConfirm(line: TownDueLine): boolean {
    return line.action === 'CONFIRM' && Boolean(line.settlementId || line.submissionId);
  }

  function canPay(line: TownDueLine): boolean {
    return line.action === 'PAY' && Boolean(line.partyId && line.periodStart && line.periodEnd);
  }

  function canSendBill(line: TownDueLine): boolean {
    if (line.action !== 'SEND_BILL') return false;
    if (!line.partyId || !line.periodStart || !line.periodEnd) return false;
    return line.party === 'VENDOR' || line.party === 'HUB';
  }

  function canCollect(line: TownDueLine): boolean {
    if (line.action !== 'COLLECT') return false;
    if (!line.partyId) return false;
    return line.party === 'VENDOR' || line.party === 'HUB';
  }

  function openCollectWorkspace(line: TownDueLine, townIdForLine: string) {
    if (line.party === 'VENDOR') {
      navigate(
        settlementsVendorCollectUrl({
          townId: townIdForLine,
          vendorId: line.partyId!,
          paysSubTab: line.settlementId ? 'records' : 'collect',
        }),
      );
      return;
    }
    if (line.party === 'HUB') {
      navigate(`/settlements?townId=${encodeURIComponent(townIdForLine)}&tab=HUB`);
    }
  }

  function canRemoveHubFranchise(line: TownDueLine): boolean {
    if (line.party !== 'HUB' || !isHubFranchiseSend(line) || !line.partyId || !line.periodStart) return false;
    return line.action === 'SEND_BILL' || line.action === 'COLLECT';
  }

  function openPay(line: TownDueLine, who: string, townIdForLine: string) {
    setPayMethod('UPI');
    setPayRef('');
    setPayNotes('');
    setError(null);
    setPay({ line, who, townId: townIdForLine });
  }

  function payerWord(party: DueParty): string {
    if (party === 'HUB') return 'hub';
    if (party === 'AGENT') return 'agent';
    return 'vendor';
  }

  async function submitFranchiseRemove() {
    if (!franchiseRemove || !token) return;
    const { line, who, townId: tid } = franchiseRemove;
    const start = line.periodStart!.slice(0, 10);
    const [y, m] = start.split('-').map(Number);
    setSaving(true);
    setError(null);
    try {
      await waiveHubFranchiseMonth(token, {
        townId: tid,
        hubId: line.partyId!,
        billingYear: y,
        billingMonth: m,
        reason: 'Removed from Accounts by admin',
      });
      setNotice(`Franchise ${period(line)} removed for ${who}. This month will not show on Accounts.`);
      setFranchiseRemove(null);
      await loadDues();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove franchise bill');
    } finally {
      setSaving(false);
    }
  }

  async function submitSendBill() {
    if (!billSend || !token) return;
    const { line, who, townId: tid } = billSend;
    setSaving(true);
    setError(null);
    try {
      if (line.party === 'HUB') {
        if (isHubFranchiseSend(line)) {
          const start = line.periodStart!.slice(0, 10);
          const [y, m] = start.split('-').map(Number);
          const created = await createHubFranchisePaymentRequest(token, {
            townId: tid,
            hubId: line.partyId!,
            billingYear: y,
            billingMonth: m,
          });
          setNotice(`Franchise bill ${created.documentRef ?? ''} sent to ${who} · ${money(line.amount)}`);
        } else {
          const created = await createHubCodPaymentRequest(token, {
            townId: tid,
            hubId: line.partyId!,
            ...hubCodPeriodParams(line),
          });
          setNotice(`COD bill ${created.documentRef ?? ''} sent to ${who} · ${money(line.amount)}`);
        }
      } else if (isSubscription(line)) {
        const month = line.periodStart!.slice(0, 7);
        const sent = await sendSubscriptionBill(token, {
          townId: tid,
          vendorId: line.partyId!,
          vendorName: who,
          month,
        });
        setNotice(
          `Subscription bill ${sent.invoiceNumber ?? ''} sent to ${who} · ${money(sent.amount)}. They pay in their portal — confirm here when it arrives.`,
        );
      } else if (line.settlementId) {
        const created = await sendVendorCollectionBill(token, line.settlementId);
        setNotice(
          `Bill ${created.serviceInvoiceNumber ?? ''} for ${money(created.netAmount)} sent to ${who}. They pay in their portal — confirm in Accounts when it arrives.`,
        );
      } else {
        const from = line.periodStart!.slice(0, 10);
        const to = line.periodEnd!.slice(0, 10);
        const candidates = await fetchSettlementCandidates(token, {
          townId: tid,
          vendorId: line.partyId!,
          from,
          to,
        });
        const subOrderIds = candidates.items
          .filter((item) => !item.alreadySettled && shopHoldsCash(item))
          .map((item) => item.subOrderId);
        if (subOrderIds.length === 0) {
          throw new Error('Nothing left to bill on this row. Refresh accounts.');
        }
        const created = await createSettlement(token, {
          townId: tid,
          vendorId: line.partyId!,
          vendorName: who,
          periodStart: from,
          periodEnd: to,
          periodType: 'CUSTOM',
          direction: 'COLLECTION',
          subOrderIds,
          markPaid: false,
          sendBill: true,
        });
        setNotice(
          `Bill ${created.serviceInvoiceNumber ?? ''} for ${money(created.netAmount)} sent to ${who}. They pay in their portal — confirm in Accounts when it arrives.`,
        );
      }
      setBillSend(null);
      await loadDues();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not send the bill');
    } finally {
      setSaving(false);
    }
  }

  async function submitPay() {
    if (!pay || !token) return;
    const reference = payRef.trim();
    if (!reference) {
      setError('Enter the UTR, UPI, or bank reference');
      return;
    }
    const line = pay.line;
    const notes = payNotes.trim() || undefined;
    setSaving(true);
    setError(null);
    try {
      let saved: SettlementVm;
      if (line.settlementId) {
        saved = await markSettlementPaid(token, line.settlementId, {
          payoutMethod: payMethod,
          transactionReference: reference,
          transactionNotes: notes,
        });
      } else if (line.party === 'VENDOR') {
        const candidates = await fetchSettlementCandidates(token, {
          townId: pay.townId,
          vendorId: line.partyId!,
          from: line.periodStart!,
          to: line.periodEnd!,
        });
        const subOrderIds = candidates.items
          .filter((item) => !item.alreadySettled && !shopHoldsCash(item))
          .map((item) => item.subOrderId);
        if (subOrderIds.length === 0) {
          throw new Error('Nothing left to pay on this row. Refresh accounts.');
        }
        saved = await createSettlement(token, {
          townId: pay.townId,
          vendorId: line.partyId!,
          vendorName: pay.who,
          periodStart: line.periodStart!,
          periodEnd: line.periodEnd!,
          periodType: 'CUSTOM',
          direction: 'PAYOUT',
          subOrderIds,
          markPaid: true,
          payoutMethod: payMethod,
          transactionReference: reference,
          transactionNotes: notes,
        });
      } else {
        const candidates = await fetchDeliverySettlementCandidates(token, {
          townId: pay.townId,
          payeeType: line.party === 'HUB' ? 'HUB' : 'AGENT',
          payeeId: line.partyId!,
          from: line.periodStart!,
          to: line.periodEnd!,
        });
        const orderIds = [...new Set(
          candidates.items
            .filter((item) => !item.alreadySettled && !(item.skipReason || '').trim() && Number(item.amount) > 0)
            .map((item) => item.orderId),
        )];
        if (orderIds.length === 0) {
          throw new Error('Nothing left to pay on this row. Refresh accounts.');
        }
        saved = await createDeliverySettlement(token, {
          townId: pay.townId,
          payeeType: line.party === 'HUB' ? 'HUB' : 'AGENT',
          payeeId: line.partyId!,
          payeeName: pay.who,
          periodStart: line.periodStart!,
          periodEnd: line.periodEnd!,
          periodType: 'CUSTOM',
          kind: 'PER_ORDER',
          orderIds,
          markPaid: true,
          payoutMethod: payMethod,
          transactionReference: reference,
          transactionNotes: notes,
        });
      }
      setNotice(
        `Paid ${money(saved.netAmount)} to ${pay.who} · ${saved.payoutMethod || payMethod} · ref ${saved.transactionReference || reference}`,
      );
      setPay(null);
      await loadDues();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not record the payout');
    } finally {
      setSaving(false);
    }
  }

  async function markNotReceived() {
    if (!ask || !token) return;
    const reason = comment.trim();
    if (!reason) {
      setError('Write a comment so they know the payment was not received');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (ask.line.submissionId) {
        await rejectHubPaymentSubmission(token, ask.line.submissionId, reason);
      } else if (ask.line.settlementId) {
        await rejectVendorBillPayment(token, ask.line.settlementId, reason);
      }
      setNotice(`Told ${ask.who} the payment was not received`);
      setAsk(null);
      setComment('');
      await loadDues();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not send Not received');
      setAsk(null);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAsked() {
    if (!ask || !token) return;
    if (ask.line.settlementId) {
      const bankErr = validateBankPaidOn(confirmBankPaidOn);
      if (bankErr) {
        setError(bankErr);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      if (ask.line.settlementId) {
        await confirmVendorBillPayment(token, ask.line.settlementId, {
          bankPaidOn: confirmBankPaidOn.trim(),
          ...(comment.trim() ? { transactionNotes: comment.trim() } : {}),
        });
      } else if (ask.line.submissionId) {
        await verifyHubPaymentSubmission(token, ask.line.submissionId);
      }
      const ref = ask.line.paymentReference || ask.line.reference;
      setNotice(`Payment ${money(ask.line.amount)} from ${ask.who} confirmed${ref ? ` · ${ref}` : ''}`);
      setAsk(null);
      await loadDues();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not confirm payment');
      setAsk(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell
      title="Accounts"
      subtitle="What KoyaKart should receive, and what KoyaKart should pay"
      onRefresh={() => void loadDues()}
    >
      <style>{DUES_CSS}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {scanningOpen ? (
        <Banner tone="info">Loading unbilled shop bags and delivery fees… ledger rows above are already up to date.</Banner>
      ) : null}
      <Card padding="sm" style={styles.card}>
        <div className="dues-tabs" role="tablist" aria-label="Accounts">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'dues'}
            className={tab === 'dues' ? 'dues-tab on dues' : 'dues-tab dues'}
            onClick={() => {
              setTab('dues');
              setAction('');
            }}
          >
            <span>Dues</span>
            <strong>{figure(ready, headline.receive)}</strong>
            <em>To receive</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pay'}
            className={tab === 'pay' ? 'dues-tab on pay' : 'dues-tab pay'}
            onClick={() => {
              setTab('pay');
              setAction('');
            }}
          >
            <span>What I have to pay</span>
            <strong>{figure(ready, headline.pay)}</strong>
            <em>To shops, hubs, and agents</em>
          </button>
        </div>
        {tab === 'dues' ? (
          <div className="dues-presets" role="group" aria-label="Dues steps">
            {RECEIVE_CHIPS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={action === item.id ? `dues-chip on ${item.id}` : `dues-chip ${item.id}`}
                onClick={() => setAction((current) => (current === item.id ? '' : item.id))}
              >
                {item.label} · {figure(ready, headline[item.id === 'SEND_BILL' ? 'sendBill' : item.id === 'COLLECT' ? 'collect' : 'confirm'])}
              </button>
            ))}
          </div>
        ) : null}
        <div className="dues-filters">
          <label className="dues-field town">
            Town
            <select value={townId} onChange={(e) => setTownId(e.target.value)}>
              <option value="">All towns</option>
              {towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="dues-field party">
            Party
            <select value={party} onChange={(e) => setParty(e.target.value as DueParty | '')}>
              <option value="">All</option>
              <option value="HUB">Hub</option>
              <option value="VENDOR">Vendor</option>
              <option value="AGENT">Delivery agent</option>
            </select>
          </label>
          <div className="dues-presets" role="group" aria-label="View">
            {LAYOUTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={layout === item.id ? 'dues-chip on' : 'dues-chip'}
                onClick={() => {
                  setLayout(item.id);
                  if (item.id !== 'list' && preset === 'previousMonth') {
                    setCursor(rangeForReportPreset('previousMonth').from);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="dues-presets">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={preset === item.id ? 'dues-chip on' : 'dues-chip'}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            style={styles.refresh}
            disabled={loading || scanningOpen}
            onClick={() => void loadDues()}
          >
            {loading ? 'Loading…' : scanningOpen ? 'Scanning…' : 'Refresh'}
          </Button>
        </div>
        <p style={styles.hint}>
          Bills and settlements in the ledger load first; unbilled shop bags and hub or agent delivery fees follow (last 120 days on All open). Pick a town or date chip to narrow the scan.
        </p>
      </Card>

      {loading && !report ? <p style={styles.hint}>Loading accounts…</p> : null}
      {!loading && view.length === 0 ? (
        <p style={styles.hint}>{tab === 'pay' ? 'Nothing to pay for this filter.' : 'Nothing to receive for this filter.'}</p>
      ) : null}

      {layout !== 'list' && view.length > 0 ? (
        <TownDuesCalendar
          mode={layout}
          cursor={cursor}
          onCursor={setCursor}
          items={view.flatMap((town) =>
            town.lines.map(
              (line, index): DuesCalendarItem => ({
                id: `${town.townId}-${line.party}-${line.partyId}-${line.action}-${line.periodStart}-${index}`,
                action: line.action,
                who: [partyName(line), partyPhone(line)].filter(Boolean).join(' · '),
                town: townName(town.townId),
                what: line.detail ? `${line.what} — ${line.detail}` : line.what,
                amount: Number(line.amount || 0),
                periodStart: line.periodStart,
                periodEnd: line.periodEnd,
              }),
            ),
          )}
        />
      ) : null}

      {layout === 'list'
        ? view.map((town) => (
        <section key={town.townId} className="dues-town-block">
          <header className="dues-town-head">
            <h2 className="dues-town-title">{townName(town.townId)}</h2>
            <span className="dues-town-badge">
              {town.lines.length} item{town.lines.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="dues-ledger-wrap">
            <table className="dues-ledger" style={styles.table}>
              <thead>
                <tr>
                  <th className="dues-th dues-col-who">Who</th>
                  <th className="dues-th dues-col-do">Do</th>
                  <th className="dues-th dues-col-what">What</th>
                  <th className="dues-th dues-col-period">Period</th>
                  <th
                    className="dues-th-num dues-col-fee dues-money-start"
                    title="Buyer UPI collected by KoyaKart on this row"
                  >
                    App UPI
                  </th>
                  <th className="dues-th-num dues-col-fee" title="Goods COD cash with the shop or vendor">
                    Vendor COD
                  </th>
                  <th className="dues-th-num dues-col-count" title="Bags or orders on this row">
                    Orders
                  </th>
                  <th className="dues-th-num dues-col-fee" title="Commission">
                    Comm
                  </th>
                  <th className="dues-th-num dues-col-fee" title="Platform fee">
                    Plat
                  </th>
                  <th className="dues-th-num dues-col-fee" title="Penalty">
                    Pen
                  </th>
                  <th className="dues-th-num dues-col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {town.lines.map((line, index) => (
                  <tr key={`${line.party}-${line.partyId}-${line.action}-${line.periodStart}-${index}`}>
                    <td className="dues-td dues-col-who">
                      <div className="dues-who-name">{partyName(line)}</div>
                      {partyPhone(line) ? <div className="dues-who-phone">{partyPhone(line)}</div> : null}
                    </td>
                    <td className="dues-td dues-col-do">
                      <div className="dues-do-stack">
                        {canConfirm(line) ? (
                          <button
                            type="button"
                            className="dues-action CONFIRM"
                            disabled={saving || !canMoveMoney}
                            title={canMoveMoney ? undefined : 'Super admin only'}
                            onClick={() => {
                              setComment('');
                              setConfirmBankPaidOn(defaultBankPaidOn({}));
                              setAsk({ line, who: partyName(line) });
                            }}
                          >
                            Confirm payment
                          </button>
                        ) : canPay(line) ? (
                          <button
                            type="button"
                            className="dues-action PAY"
                            disabled={saving || !canMoveMoney}
                            title={canMoveMoney ? undefined : 'Super admin only'}
                            onClick={() => openPay(line, partyName(line), town.townId)}
                          >
                            KoyaKart pays
                          </button>
                        ) : canSendBill(line) ? (
                          <button
                            type="button"
                            className="dues-action SEND_BILL"
                            disabled={saving || !canIssueBills}
                            onClick={() => {
                              setError(null);
                              setBillSend({ line, who: partyName(line), townId: town.townId });
                            }}
                          >
                            {sendBillButtonLabel(line)}
                          </button>
                        ) : canCollect(line) ? (
                          <button
                            type="button"
                            className="dues-action COLLECT"
                            disabled={saving || !canMoveMoney}
                            title={canMoveMoney ? 'Open Payouts to collect or confirm this bill' : 'Super admin only'}
                            onClick={() => openCollectWorkspace(line, town.townId)}
                          >
                            Collect
                          </button>
                        ) : (
                          <span className={`dues-action ${line.action}`}>{actionLabel(line)}</span>
                        )}
                        {canRemoveHubFranchise(line) ? (
                          <button
                            type="button"
                            className="dues-action REMOVE"
                            disabled={saving || !canMoveMoney}
                            title={
                              canMoveMoney
                                ? 'Skip this franchise month — cancels an open bill if one was already sent'
                                : 'Super admin only'
                            }
                            onClick={() => {
                              setError(null);
                              setFranchiseRemove({ line, who: partyName(line), townId: town.townId });
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="dues-td dues-col-what">
                      <div className="dues-what-head">{whatHeadline(line)}</div>
                      {compactDetail(line) ? <div className="dues-what-detail">{compactDetail(line)}</div> : null}
                      {line.paymentNotes?.trim() ? (
                        <div className="dues-what-detail">Vendor note: {line.paymentNotes.trim()}</div>
                      ) : null}
                    </td>
                    <td className="dues-td dues-col-period">
                      <span className="dues-period-pill">{period(line)}</span>
                    </td>
                    {ledgerMoneyTd(line.upiAppReceived, 'upi')}
                    {ledgerNumTd(shopCodCell(line), 'cod')}
                    {ledgerNumTd(orderCountCell(line), 'count')}
                    {ledgerMoneyTd(line.commission, 'fee')}
                    {ledgerMoneyTd(line.platformFee, 'fee')}
                    {ledgerMoneyTd(line.penalty, 'fee')}
                    {ledgerNumTd(money(line.amount), 'total')}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))
        : null}
      <ConfirmDialog
        open={ask != null}
        title="Confirm payment received?"
        description={
          ask ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>{ask.line.reference || 'Bill'}</span>
                <strong style={styles.dlgHeroValue}>{money(ask.line.amount)}</strong>
                <span>{ask.who}</span>
              </div>
              <div style={styles.dlgRow}>
                <span>Paid by</span>
                <strong>
                  {[ask.line.paymentMethod, ask.line.paymentReference].filter(Boolean).join(' · ') || '—'}
                </strong>
              </div>
              {ask.line.paymentNotes?.trim() ? (
                <div style={styles.dlgRow}>
                  <span>Vendor note</span>
                  <strong>{ask.line.paymentNotes.trim()}</strong>
                </div>
              ) : null}
              <div style={styles.dlgRow}>
                <span>Period</span>
                <strong>{period(ask.line)}</strong>
              </div>
              {ask.line.settlementId ? (
                <BankPaidOnField
                  value={confirmBankPaidOn}
                  max={todayIstDate()}
                  onChange={setConfirmBankPaidOn}
                />
              ) : null}
              <label style={styles.dlgField}>
                Comment for the {ask ? payerWord(ask.line.party) : 'payer'}
                <textarea
                  style={styles.dlgInput}
                  maxLength={500}
                  rows={2}
                  placeholder="What should they check on the statement?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <p style={styles.dlgNote}>
                Not received sends this comment to the {ask ? payerWord(ask.line.party) : 'payer'}. Yes, received marks the money in
                {ask.line.settlementId ? ' with the bank statement date you enter above' : ''}.
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="Yes, received"
        cancelLabel="Cancel"
        danger={false}
        busy={saving}
        extraLabel="Not received"
        extraDisabled={!comment.trim()}
        onExtra={() => void markNotReceived()}
        confirmDisabled={Boolean(ask?.line.settlementId) && !confirmBankPaidOn.trim()}
        onClose={() => {
          if (!saving) {
            setAsk(null);
            setComment('');
            setConfirmBankPaidOn('');
          }
        }}
        onConfirm={() => void confirmAsked()}
      />
      <ConfirmDialog
        open={billSend != null}
        title="Send bill to shop?"
        description={
          billSend ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>{whatHeadline(billSend.line)}</span>
                <strong style={styles.dlgHeroValue}>{money(billSend.line.amount)}</strong>
                <span>{billSend.who}</span>
              </div>
              <div style={styles.dlgRow}>
                <span>Period</span>
                <strong>{period(billSend.line)}</strong>
              </div>
              {billSend.line.itemCount > 0 ? (
                <div style={styles.dlgRow}>
                  <span>Items</span>
                  <strong>
                    {billSend.line.itemCount} bag{billSend.line.itemCount === 1 ? '' : 's'}
                  </strong>
                </div>
              ) : null}
              <p style={styles.dlgNote}>
                Same as Payouts: the shop gets the bill in their portal, pays KoyaKart, and you confirm payment under Confirm when they submit the UTR.
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={billSend ? `Send bill · ${money(billSend.line.amount)}` : 'Send bill'}
        cancelLabel="Cancel"
        danger={false}
        busy={saving}
        onClose={() => {
          if (!saving) setBillSend(null);
        }}
        onConfirm={() => void submitSendBill()}
      />
      <ConfirmDialog
        open={franchiseRemove != null}
        title="Remove franchise from Accounts?"
        description={
          franchiseRemove ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>{whatHeadline(franchiseRemove.line)}</span>
                <strong style={styles.dlgHeroValue}>{money(franchiseRemove.line.amount)}</strong>
                <span>{franchiseRemove.who}</span>
              </div>
              <div style={styles.dlgRow}>
                <span>Period</span>
                <strong>{period(franchiseRemove.line)}</strong>
              </div>
              <p style={styles.dlgNote}>
                Skips franchise rent for this month. If a bill was already issued to the hub, it is cancelled. Use Town
                Incentives to turn franchise billing off for future months.
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        busy={saving}
        onClose={() => {
          if (!saving) setFranchiseRemove(null);
        }}
        onConfirm={() => void submitFranchiseRemove()}
      />
      <ConfirmDialog
        open={pay != null}
        title="Pay from KoyaKart?"
        description={
          pay ? (
            <div style={styles.dlgBody}>
              <div style={styles.dlgHero}>
                <span style={styles.dlgHeroLabel}>{pay.who}</span>
                <strong style={styles.dlgHeroValue}>{money(pay.line.amount)}</strong>
                <span>{period(pay.line)}</span>
              </div>
              <div style={styles.payGrid}>
                <label style={styles.dlgField}>
                  Mode
                  <select
                    style={styles.dlgControl}
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAY_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.dlgField}>
                  UTR / reference *
                  <input
                    style={styles.dlgControl}
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="UPI / bank / cheque"
                    autoFocus
                  />
                </label>
              </div>
              <label style={styles.dlgField}>
                Notes
                <textarea
                  style={styles.dlgInput}
                  rows={2}
                  maxLength={500}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <p style={styles.dlgNote}>
                This records the payout in accounts, the audit log, and money transactions.
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={`Pay ${pay ? money(pay.line.amount) : ''}`}
        cancelLabel="Cancel"
        danger={false}
        busy={saving}
        confirmDisabled={!payRef.trim()}
        onClose={() => {
          if (!saving) setPay(null);
        }}
        onConfirm={() => void submitPay()}
      />
    </PortalShell>
  );
}

const DUES_CSS = `
.dues-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.dues-tab {
  display: grid; gap: 0.04rem; text-align: left; min-height: 46px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg);
  padding: 0.4rem 0.6rem; cursor: pointer; font-family: inherit; color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent);
}
.dues-tab:hover:not(.on) { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
.dues-tab span { font-size: 0.78rem; font-weight: 800; letter-spacing: -0.01em; }
.dues-tab strong { font-size: 1.08rem; font-variant-numeric: tabular-nums; min-width: 5.5rem; display: inline-block; }
.dues-tab em { font-style: normal; font-size: 0.68rem; font-weight: 650; color: var(--text-muted); }
.dues-tab.dues strong { color: #15803d; }
.dues-tab.pay strong { color: #b91c1c; }
.dues-tab.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), 0 2px 8px color-mix(in srgb, var(--accent) 12%, transparent);
}
.dues-chip.SEND_BILL { color: #c2410c; }
.dues-chip.COLLECT { color: #15803d; }
.dues-chip.CONFIRM { color: #1d4ed8; }

.dues-town-block {
  margin-bottom: 0.85rem;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--text-muted));
  background: var(--bg-elevated);
  box-shadow: 0 2px 10px color-mix(in srgb, #0f172a 5%, transparent);
  overflow: hidden;
}
.dues-town-head {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(
    92deg,
    color-mix(in srgb, var(--accent, #009111) 10%, var(--bg-elevated)) 0%,
    var(--bg-elevated) 55%
  );
  border-bottom: 1px solid var(--border);
}
.dues-town-title {
  margin: 0; font-size: 0.92rem; font-weight: 850; letter-spacing: -0.02em; color: var(--text);
}
.dues-town-badge {
  flex-shrink: 0;
  font-size: 0.66rem; font-weight: 750; color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.14rem 0.55rem;
  font-variant-numeric: tabular-nums;
}

.dues-ledger-wrap { overflow-x: auto; overflow-y: visible; }
.dues-ledger {
  table-layout: fixed;
  width: 100%;
  font-size: 0.71rem;
  line-height: 1.25;
  border-collapse: separate;
  border-spacing: 0;
}
.dues-ledger thead { position: sticky; top: 0; z-index: 2; }
.dues-th, .dues-th-num {
  padding: 0.32rem 0.28rem;
  border-bottom: 1px solid var(--border);
  color: color-mix(in srgb, var(--text-muted) 92%, var(--text));
  font-weight: 800;
  background: color-mix(in srgb, var(--text-muted) 7%, var(--bg-elevated));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dues-th { text-align: left; }
.dues-th-num {
  text-align: right;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 850;
}
.dues-td, .dues-td-num {
  padding: 0.3rem 0.28rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  vertical-align: top;
  transition: background 0.12s;
}
.dues-ledger tbody tr:nth-child(even) .dues-td,
.dues-ledger tbody tr:nth-child(even) .dues-td-num {
  background: color-mix(in srgb, var(--text) 2.2%, var(--bg-elevated));
}
.dues-ledger tbody tr:hover .dues-td,
.dues-ledger tbody tr:hover .dues-td-num {
  background: color-mix(in srgb, var(--accent, #009111) 7%, var(--bg-elevated)) !important;
}
.dues-td-num {
  text-align: right;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  font-size: 0.68rem;
  white-space: nowrap;
}
.dues-money-start { border-left: 2px solid color-mix(in srgb, var(--accent) 35%, var(--border)); }
.dues-th-num.dues-money-start { background: color-mix(in srgb, var(--text-muted) 9%, var(--bg-elevated)); }
.dues-amt-upi:not(.is-empty) { color: #0369a1; font-weight: 800; }
.dues-amt-cod:not(.is-empty) { color: #b45309; font-weight: 800; }
.dues-amt-total { font-weight: 900; font-size: 0.74rem; color: var(--text); }
.dues-amt-count:not(.is-empty) { font-weight: 800; color: color-mix(in srgb, var(--text) 88%, var(--text-muted)); }
.dues-td-num.is-empty { color: color-mix(in srgb, var(--text-muted) 45%, transparent); font-weight: 550; }

.dues-col-who { width: 10%; }
.dues-col-do { width: 7%; }
.dues-col-what { width: 20%; }
.dues-col-period { width: 8%; }
.dues-col-count { width: 4.8%; }
.dues-col-fee { width: 5.4%; }
.dues-col-total { width: 6.8%; }

.dues-period-pill {
  display: inline-block;
  max-width: 100%;
  padding: 0.12rem 0.35rem;
  border-radius: 6px;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-muted) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dues-who-name {
  font-weight: 850;
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.dues-who-phone {
  font-size: 0.61rem;
  font-weight: 650;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.dues-what-head { font-weight: 780; font-size: 0.68rem; line-height: 1.22; color: var(--text); }
.dues-what-detail {
  margin-top: 0.12rem;
  font-size: 0.62rem;
  line-height: 1.3;
  color: var(--text-muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-word;
}

.dues-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: end; }
.dues-field { display: grid; gap: 0.12rem; font-size: 0.68rem; font-weight: 700; color: var(--text-muted); }
.dues-field select {
  height: 2.25rem; border: 1px solid var(--border); border-radius: 8px; padding: 0 0.45rem;
  background: var(--bg); color: var(--text); font: inherit; font-size: 0.8rem; font-weight: 650;
  width: 100%; box-sizing: border-box;
}
.dues-field.town { width: 16rem; max-width: 100%; }
.dues-field.party { width: 9.5rem; max-width: 100%; }
.dues-presets { display: flex; flex-wrap: wrap; gap: 0.28rem; align-items: center; }
.dues-chip, .dues-action {
  border: 1px solid var(--border); background: var(--bg); color: var(--text-muted);
  border-radius: 999px; min-height: 1.75rem; padding: 0.16rem 0.58rem;
  font-size: 0.72rem; font-weight: 750; font-family: inherit; cursor: pointer;
  transition: transform 0.1s, box-shadow 0.12s, border-color 0.12s;
}
.dues-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 850;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--accent) 18%, transparent);
}
.dues-action { cursor: default; font-size: 0.6rem; padding: 0.18rem 0.38rem; max-width: 100%; border-radius: 8px; }
.dues-td .dues-action { display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; }
.dues-do-stack { display: flex; flex-direction: column; gap: 0.14rem; align-items: stretch; }
button.dues-action.CONFIRM, button.dues-action.PAY, button.dues-action.SEND_BILL, button.dues-action.REMOVE { cursor: pointer; }
button.dues-action:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 6px color-mix(in srgb, #0f172a 8%, transparent); }
button.dues-action.CONFIRM:disabled, button.dues-action.PAY:disabled, button.dues-action.SEND_BILL:disabled, button.dues-action.REMOVE:disabled { opacity: 0.55; cursor: wait; transform: none; box-shadow: none; }
.dues-action.REMOVE { color: #991b1b; border-color: #fecaca; background: linear-gradient(180deg, #fff, #fef2f2); }
.dues-action.SEND_BILL { color: #c2410c; border-color: #fdba74; background: linear-gradient(180deg, #fff, #fff7ed); }
.dues-action.COLLECT { color: #15803d; border-color: #86efac; background: linear-gradient(180deg, #fff, #f0fdf4); }
.dues-action.PAY { color: #b91c1c; border-color: #fecaca; background: linear-gradient(180deg, #fff, #fef2f2); }
.dues-action.CONFIRM { color: #1d4ed8; border-color: #bfdbfe; background: linear-gradient(180deg, #fff, #eff6ff); }

@media (max-width: 640px) {
  .dues-tabs { grid-template-columns: 1fr; }
  .dues-ledger { font-size: 0.66rem; }
}
`;

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.45rem', marginBottom: '0.55rem' },
  refresh: { minHeight: 44, marginLeft: 'auto' },
  hint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  dlgBody: { display: 'grid', gap: '0.3rem' },
  dlgHero: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md, 10px)',
    background: 'color-mix(in srgb, var(--brand, #009111) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--brand, #009111) 25%, transparent)',
    color: 'var(--text)',
    marginBottom: '0.2rem',
  },
  dlgHeroLabel: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' },
  dlgHeroValue: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand, #009111)', lineHeight: 1.15 },
  dlgRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.2rem 0',
    borderBottom: '1px dashed var(--border)',
  },
  dlgNote: { margin: '0.25rem 0 0', fontSize: '0.8rem' },
  payGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' },
  dlgField: { display: 'grid', gap: '0.15rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' },
  dlgControl: {
    width: '100%',
    height: 34,
    padding: '0 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 650,
  },
  dlgInput: {
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
    fontWeight: 650,
  },
  town: { display: 'grid', gap: '0.28rem', marginBottom: '0.65rem' },
  townHead: { display: 'flex', alignItems: 'baseline', gap: '0.45rem' },
  townTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  townMeta: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 },
  tableWrap: { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)' },
  table: {},
  th: {
    textAlign: 'left',
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    background: 'var(--bg)',
  },
  thNum: {
    textAlign: 'right',
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    background: 'var(--bg)',
  },
  td: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' },
  tdWhat: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    overflowWrap: 'anywhere',
  },
  tdStrong: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', fontWeight: 800, verticalAlign: 'top' },
  whoLine: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.4rem', rowGap: '0.05rem' },
  whoPhone: { fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  tdMuted: { padding: '0.32rem 0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'top' },
  tdNum: {
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  ref: { color: 'var(--text-muted)', fontWeight: 650 },
};
