import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
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
  type SettlementCandidate,
  type SettlementVm,
} from '@/features/settlements/api/settlementsApi';
import { rejectHubPaymentSubmission, verifyHubPaymentSubmission } from '@/features/settlements/api/hubPaymentApi';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listHubs } from '@/features/hubs/api/hubsApi';
import { listAllAgents } from '@/features/agents/api/agentsApi';
import { listVendors } from '@/features/vendors/api/vendorsApi';
import { rangeForReportPreset, type ReportDatePreset } from '@/shared/dates/istReportPresets';
import {
  fetchTownDues,
  type DueAction,
  type DueParty,
  type TownDueLine,
  type TownDuesReport,
} from '../api/townDuesApi';
import { TownDuesCalendar, type DuesCalendarItem } from '../components/TownDuesCalendar';

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
  if (line.periodStart && line.periodEnd && line.periodStart !== line.periodEnd) {
    return `${day(line.periodStart)} – ${day(line.periodEnd)}`;
  }
  return day(line.periodStart || line.periodEnd);
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
  if (line.action === 'PAY') return 'KoyaKart pays';
  if (line.action === 'COLLECT') return 'Shop pays';
  if (line.action === 'CONFIRM') return 'Confirm payment';
  if (line.party === 'VENDOR' && (line.commission != null || isSubscription(line))) return 'Shop pays';
  return 'Send bill';
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
  if (isSubscription(line)) return 'Monthly subscription. Not commission.';
  if (line.party === 'VENDOR' && line.commission != null && line.action !== 'PAY') {
    return 'Shop kept the customer’s cash, so the shop pays this commission. Not paid yet.';
  }
  if (line.party === 'VENDOR' && line.action === 'PAY') {
    return Number(line.commission ?? 0) > 0
      ? 'Shop does not send this commission. It is cut from the payout KoyaKart still has to send.'
      : 'KoyaKart pays the shop. No commission on these bags.';
  }
  return line.what;
}

export function TownDuesPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [preset, setPreset] = useState<Preset>('open');
  const [layout, setLayout] = useState<'list' | 'week' | 'month'>('list');
  const [cursor, setCursor] = useState(todayIso);
  const [tab, setTab] = useState<LedgerTab>('dues');
  const [townId, setTownId] = useState('');
  const [party, setParty] = useState<DueParty | ''>('');
  const [action, setAction] = useState<DueAction | ''>('');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [hubNames, setHubNames] = useState<Map<string, string>>(new Map());
  const [loginPhones, setLoginPhones] = useState<Map<string, string>>(new Map());
  const [report, setReport] = useState<TownDuesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState<{ line: TownDueLine; who: string } | null>(null);
  const [comment, setComment] = useState('');
  const [pay, setPay] = useState<{ line: TownDueLine; who: string; townId: string } | null>(null);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const range = preset === 'open' ? undefined : rangeForReportPreset(preset);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const townsPromise = listTowns(token).then((townList) => {
      setTowns(townList);
      return townList;
    });
    const directory = Promise.all([
      townsPromise,
      listHubs(token).catch(() => []),
      listAllAgents(token).catch(() => []),
    ]).then(async ([townList, hubs, agents]) => {
      const vendorGroups = await Promise.all(
        townList.map((town) => listVendors(token, town.id).catch(() => [])),
      );
      const phones = new Map<string, string>();
      for (const hub of hubs) {
        const login = (hub.adminPhone || hub.phone || '').trim();
        if (hub.hubId && login) phones.set(hub.hubId, login);
      }
      for (const agent of agents) {
        const login = agent.phone?.trim();
        if (agent.agentId && login) phones.set(agent.agentId, login);
      }
      for (const vendor of vendorGroups.flat()) {
        const login = vendor.phone?.trim();
        if (vendor.id && login) phones.set(vendor.id, login);
      }
      return { hubs, phones };
    });
    try {
      const data = await fetchTownDues(token, range);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load accounts');
    } finally {
      setLoading(false);
    }
    try {
      const { hubs, phones } = await directory;
      setHubNames(new Map(hubs.map((hub) => [hub.hubId, hub.name])));
      setLoginPhones(phones);
    } catch {
      // Names and phones fill in when the directory answers. The dues list does not wait on it.
    }
  }, [token, range?.from, range?.to]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        lines: town.lines.filter((line) => !party || line.party === party),
      }))
      .filter((town) => town.lines.length > 0);
  }, [report, townId, party]);

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
      await reload();
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
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not send Not received');
      setAsk(null);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAsked() {
    if (!ask || !token) return;
    setSaving(true);
    setError(null);
    try {
      if (ask.line.settlementId) {
        await confirmVendorBillPayment(token, ask.line.settlementId);
      } else if (ask.line.submissionId) {
        await verifyHubPaymentSubmission(token, ask.line.submissionId);
      }
      const ref = ask.line.paymentReference || ask.line.reference;
      setNotice(`Payment ${money(ask.line.amount)} from ${ask.who} confirmed${ref ? ` · ${ref}` : ''}`);
      setAsk(null);
      await reload();
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
      onRefresh={() => void reload()}
    >
      <style>{DUES_CSS}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
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
          <Button type="button" size="sm" style={styles.refresh} disabled={loading} onClick={() => void reload()}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
        <p style={styles.hint}>
          All open includes unfinished bills and bags not billed yet. A date chip keeps work whose period falls in that range.
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
        <section key={town.townId} style={styles.town}>
          <header style={styles.townHead}>
            <h2 style={styles.townTitle}>{townName(town.townId)}</h2>
            <span style={styles.townMeta}>{town.lines.length} item{town.lines.length === 1 ? '' : 's'}</span>
          </header>
          <div style={styles.tableWrap}>
            <table className="dues-ledger" style={styles.table}>
              <colgroup>
                <col className="dues-col-who" />
                <col className="dues-col-do" />
                <col />
                <col className="dues-col-period" />
                <col className="dues-col-commission" />
                <col className="dues-col-amount" />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.th}>Who</th>
                  <th style={styles.th}>Do this</th>
                  <th style={styles.th}>What</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.thNum}>Commission</th>
                  <th style={styles.thNum}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {town.lines.map((line, index) => (
                  <tr key={`${line.party}-${line.partyId}-${line.action}-${line.periodStart}-${index}`}>
                    <td style={styles.tdStrong}>
                      <div style={styles.whoLine}>
                        <span>{partyName(line)}</span>
                        {partyPhone(line) ? <span style={styles.whoPhone}>{partyPhone(line)}</span> : null}
                      </div>
                      <div style={styles.ref}>{partyLabel(line.party)}</div>
                    </td>
                    <td style={styles.td}>
                      {canConfirm(line) ? (
                        <button
                          type="button"
                          className="dues-action CONFIRM"
                          disabled={saving}
                          onClick={() => {
                            setComment('');
                            setAsk({ line, who: partyName(line) });
                          }}
                        >
                          Confirm payment
                        </button>
                      ) : canPay(line) ? (
                        <button
                          type="button"
                          className="dues-action PAY"
                          disabled={saving}
                          onClick={() => openPay(line, partyName(line), town.townId)}
                        >
                          KoyaKart pays
                        </button>
                      ) : (
                        <span className={`dues-action ${line.action}`}>{actionLabel(line)}</span>
                      )}
                    </td>
                    <td style={styles.tdWhat}>
                      {whatHeadline(line)}
                      {line.detail ? <div style={styles.ref}>{line.detail}</div> : null}
                      {line.reference ? <div style={styles.ref}>{line.reference}</div> : null}
                    </td>
                    <td style={styles.tdMuted}>{period(line)}</td>
                    <td style={styles.tdNum}>
                      {line.commission == null ? '—' : money(line.commission)}
                    </td>
                    <td style={styles.tdNum}>{money(line.amount)}</td>
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
              <div style={styles.dlgRow}>
                <span>Period</span>
                <strong>{period(ask.line)}</strong>
              </div>
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
                Not received sends this comment to the {ask ? payerWord(ask.line.party) : 'payer'}. Yes, received marks the money in.
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
        onClose={() => {
          if (!saving) {
            setAsk(null);
            setComment('');
          }
        }}
        onConfirm={() => void confirmAsked()}
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
.dues-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
.dues-tab {
  display: grid; gap: 0.02rem; text-align: left; min-height: 44px;
  border: 1px solid var(--border); border-radius: 10px; background: var(--bg);
  padding: 0.35rem 0.55rem; cursor: pointer; font-family: inherit; color: var(--text);
}
.dues-tab span { font-size: 0.78rem; font-weight: 800; }
.dues-tab strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; min-width: 5.5rem; display: inline-block; }
.dues-tab em { font-style: normal; font-size: 0.68rem; font-weight: 650; color: var(--text-muted); }
.dues-tab.dues strong { color: #15803d; }
.dues-tab.pay strong { color: #b91c1c; }
.dues-tab.on { border-color: var(--accent); background: var(--accent-soft); }
.dues-chip.SEND_BILL { color: #c2410c; }
.dues-chip.COLLECT { color: #15803d; }
.dues-chip.CONFIRM { color: #1d4ed8; }
.dues-col-do { width: 8.25rem; }
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
  border-radius: 999px; min-height: 1.7rem; padding: 0.15rem 0.55rem;
  font-size: 0.72rem; font-weight: 700; font-family: inherit; cursor: pointer;
}
.dues-chip.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 800; }
.dues-action { cursor: default; }
button.dues-action.CONFIRM, button.dues-action.PAY { cursor: pointer; }
button.dues-action.CONFIRM:disabled, button.dues-action.PAY:disabled { opacity: 0.6; cursor: wait; }
.dues-action.SEND_BILL { color: #c2410c; border-color: #fdba74; background: #fff7ed; }
.dues-action.COLLECT { color: #15803d; border-color: #86efac; background: #f0fdf4; }
.dues-action.PAY { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.dues-action.CONFIRM { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
.dues-ledger { table-layout: fixed; }
.dues-col-who { width: 16.5rem; }
.dues-col-period { width: 12.5rem; }
.dues-col-commission { width: 7rem; }
.dues-col-amount { width: 6.75rem; }
@media (max-width: 640px) {
  .dues-tabs { grid-template-columns: 1fr; }
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
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
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
