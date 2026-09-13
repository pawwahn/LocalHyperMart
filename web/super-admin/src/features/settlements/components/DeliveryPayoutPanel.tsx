import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listHubs, type AdminHubVm } from '@/features/hubs/api/hubsApi';
import { listAllAgents, type AdminAgentVm } from '@/features/agents/api/agentsApi';
import {
  createDeliverySettlement,
  fetchDeliverySettlementCandidates,
  formatMoney,
  listSettlements,
  type DeliveryFranchiseDue,
  type DeliveryPayeeType,
  type DeliverySettlementCandidate,
  type SettlementVm,
} from '../api/settlementsApi';

type PeriodPreset = 'day' | 'week' | 'month' | 'custom';
type PeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const IST = 'Asia/Kolkata';
const PAYOUT_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'];

function isoDateInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function rangeForPreset(preset: PeriodPreset): { from: string; to: string; periodType: PeriodType } {
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

function cadenceLabel(cadence?: string): string {
  switch ((cadence ?? '').toUpperCase()) {
    case 'QUARTERLY':
      return 'quarter';
    case 'YEARLY':
      return 'year';
    case 'LIFETIME':
      return 'lifetime';
    default:
      return 'month';
  }
}

type Props = {
  token: string;
  payeeType: DeliveryPayeeType;
  refreshTick: number;
  onSettled?: () => void;
};

export function DeliveryPayoutPanel({ token, payeeType, refreshTick, onSettled }: Props) {
  const isHub = payeeType === 'HUB';
  const initial = rangeForPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [hubs, setHubs] = useState<AdminHubVm[]>([]);
  const [agents, setAgents] = useState<AdminAgentVm[]>([]);
  const [townId, setTownId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [periodType, setPeriodType] = useState<PeriodType>(initial.periodType);
  const [items, setItems] = useState<DeliverySettlementCandidate[]>([]);
  const [franchise, setFranchise] = useState<DeliveryFranchiseDue | null>(null);
  const [model, setModel] = useState('PER_ORDER');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<SettlementVm[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState('UPI');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'PER_ORDER' | 'FRANCHISE' | null>(null);

  const townHubs = useMemo(() => hubs.filter((h) => h.townId === townId), [hubs, townId]);
  const townAgents = useMemo(() => {
    const hubIds = new Set(townHubs.map((h) => h.hubId));
    return agents.filter((a) => a.hubId && hubIds.has(a.hubId));
  }, [agents, townHubs]);

  const selectedPayee = useMemo(() => {
    if (isHub) return townHubs.find((h) => h.hubId === payeeId) ?? null;
    return townAgents.find((a) => a.agentId === payeeId) ?? null;
  }, [isHub, townHubs, townAgents, payeeId]);

  const payeeName = isHub
    ? (selectedPayee as AdminHubVm | null)?.name
    : (selectedPayee as AdminAgentVm | null)?.name;

  const openItems = useMemo(
    () => items.filter((i) => !i.alreadySettled && !i.skipReason && Number(i.amount) > 0),
    [items],
  );

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const row of items) {
      if (selected.has(row.orderId)) sum += Number(row.amount ?? 0);
    }
    return sum;
  }, [items, selected]);

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    const range = rangeForPreset(next);
    setFrom(range.from);
    setTo(range.to);
    setPeriodType(range.periodType);
  };

  const reloadCandidates = useCallback(async () => {
    if (!token || !townId || !payeeId) {
      setItems([]);
      setFranchise(null);
      setSelected(new Set());
      setModel('PER_ORDER');
      return;
    }
    const data = await fetchDeliverySettlementCandidates(token, {
      townId,
      payeeType,
      payeeId,
      from,
      to,
    });
    const rows = data.items ?? [];
    setItems(rows);
    setFranchise(data.franchise ?? null);
    setModel(data.hubPayoutModel ?? 'PER_ORDER');
    setSelected(new Set(rows.filter((i) => !i.alreadySettled && !i.skipReason && Number(i.amount) > 0).map((i) => i.orderId)));
  }, [token, townId, payeeId, payeeType, from, to]);

  const reloadHistory = useCallback(async () => {
    if (!token) return;
    const rows = await listSettlements(token, {
      townId: townId || undefined,
      payeeId: payeeId || undefined,
      payeeType,
    });
    setHistory(
      rows.filter((s) => {
        const start = s.periodStart ?? '';
        const end = s.periodEnd ?? '';
        if (!start || !end) return true;
        return start <= to && end >= from;
      }),
    );
  }, [token, townId, payeeId, payeeType, from, to]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [townList, hubList, agentList] = await Promise.all([
        listTowns(token),
        listHubs(token),
        isHub ? Promise.resolve([] as AdminAgentVm[]) : listAllAgents(token),
      ]);
      setTowns(townList);
      setHubs(hubList);
      setAgents(agentList);
      await Promise.all([reloadCandidates(), reloadHistory()]);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [token, isHub, reloadCandidates, reloadHistory]);

  useEffect(() => {
    void reload();
  }, [reload, refreshTick]);

  useEffect(() => {
    if (!townId) {
      setPayeeId('');
      return;
    }
    const ids = isHub ? townHubs.map((h) => h.hubId) : townAgents.map((a) => a.agentId);
    if (payeeId && ids.includes(payeeId)) return;
    setPayeeId(ids.length === 1 ? ids[0] : '');
  }, [townId, isHub, townHubs, townAgents, payeeId]);

  function toggleAllOpen(checked: boolean) {
    setSelected(checked ? new Set(openItems.map((i) => i.orderId)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function requireTxn(): boolean {
    if (!transactionReference.trim()) {
      setError('Txn ref is required (UTR / UPI / cheque number)');
      setConfirmKind(null);
      return false;
    }
    return true;
  }

  async function submit(kind: 'PER_ORDER' | 'FRANCHISE') {
    if (!token || !townId || !payeeId || !requireTxn()) return;
    if (kind === 'PER_ORDER' && selected.size === 0) return;
    if (kind === 'FRANCHISE' && (!franchise?.enabled || franchise.alreadyCollected)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createDeliverySettlement(token, {
        townId,
        payeeType,
        payeeId,
        payeeName: payeeName || undefined,
        periodStart: kind === 'FRANCHISE' ? franchise!.periodStart : from,
        periodEnd: kind === 'FRANCHISE' ? franchise!.periodEnd : to,
        periodType: kind === 'FRANCHISE' ? 'CUSTOM' : periodType,
        kind,
        orderIds: kind === 'PER_ORDER' ? Array.from(selected) : [],
        markPaid: true,
        payoutMethod,
        transactionReference: transactionReference.trim(),
        transactionNotes: transactionNotes.trim() || undefined,
      });
      const who = payeeName || (isHub ? 'hub' : 'agent');
      if (kind === 'FRANCHISE') {
        setSuccess(`Received ${formatMoney(created.netAmount)} franchise from ${who} · ${created.payoutMethod} · ref ${transactionReference.trim()}`);
      } else {
        setSuccess(`Paid ${formatMoney(created.netAmount)} to ${who} · ${selected.size} order${selected.size === 1 ? '' : 's'} · ref ${transactionReference.trim()}`);
      }
      setTransactionReference('');
      setTransactionNotes('');
      setConfirmKind(null);
      await Promise.all([reloadCandidates(), reloadHistory()]);
      onSettled?.();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  }

  const canPayOrders =
    !saving && selected.size > 0 && !!townId && !!payeeId && transactionReference.trim().length > 0;
  const canCollectFranchise =
    !saving &&
    !!townId &&
    !!payeeId &&
    !!franchise?.enabled &&
    !franchise.alreadyCollected &&
    Number(franchise.amount) > 0 &&
    transactionReference.trim().length > 0;

  const showOrders = model === 'PER_ORDER' || model === 'BOTH' || !isHub;
  const showFranchise = isHub && !!franchise?.enabled;

  return (
    <>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {success ? <Banner tone="success">{success}</Banner> : null}

      <div className="dp-layout">
        <div className="dp-main">
          <Card padding="sm" style={styles.cardPad}>
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
            <div className="dp-filters">
              <label style={styles.label}>
                Town
                <select
                  style={styles.input}
                  value={townId}
                  onChange={(e) => {
                    setTownId(e.target.value);
                    setPayeeId('');
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
                {isHub ? 'Hub' : 'Agent'}
                <select
                  style={styles.input}
                  value={payeeId}
                  disabled={!townId}
                  onChange={(e) => setPayeeId(e.target.value)}
                >
                  <option value="">{isHub ? 'Select hub' : 'Select agent'}</option>
                  {isHub
                    ? townHubs.map((h) => (
                        <option key={h.hubId} value={h.hubId}>
                          {h.name} ({h.phone})
                        </option>
                      ))
                    : townAgents.map((a) => (
                        <option key={a.agentId} value={a.agentId}>
                          {a.name} ({a.phone})
                          {a.hubName ? ` · ${a.hubName}` : ''}
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
                <select style={styles.input} value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
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
                />
              </label>
              <label style={styles.label} className="dp-notes">
                Notes
                <input
                  style={styles.input}
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  placeholder="Optional remark"
                />
              </label>
            </div>
            <p style={styles.hint}>
              Rates live in Towns → Incentives. Cancelled and incomplete orders never appear as payable. Home-delivery
              agent gets the completed-order ₹.
            </p>
          </Card>

          {showFranchise && franchise ? (
            <Card padding="sm" style={styles.cardPad}>
              <div style={styles.tableHead}>
                <h2 style={styles.sectionTitle}>Franchise · hub pays us</h2>
                <span style={franchise.alreadyCollected ? styles.settled : styles.openBadge}>
                  {franchise.alreadyCollected ? 'Collected' : 'Due'}
                </span>
              </div>
              <p style={styles.muted}>
                {franchise.label} · window uses the {cadenceLabel(franchise.cadence)} of the To date
                {franchise.cadence === 'LIFETIME' ? ' · once ever' : ''}.
              </p>
            </Card>
          ) : null}

          {showOrders ? (
            <Card padding="sm" style={styles.cardPad}>
              <div style={styles.tableHead}>
                <h2 style={styles.sectionTitle}>
                  Completed orders{' '}
                  <span style={styles.count}>
                    {items.length} · {selected.size} selected
                  </span>
                </h2>
                <label style={styles.checkInline}>
                  <input
                    type="checkbox"
                    checked={openItems.length > 0 && selected.size === openItems.length}
                    onChange={(e) => toggleAllOpen(e.target.checked)}
                    disabled={openItems.length === 0}
                  />
                  All payable
                </label>
              </div>
              {!townId || !payeeId ? (
                <p style={styles.muted}>
                  Select a town and {isHub ? 'hub' : 'agent'} to load delivered orders.
                </p>
              ) : loading ? (
                <p style={styles.muted}>Loading…</p>
              ) : items.length === 0 ? (
                <p style={styles.muted}>
                  No delivered orders in this range. Cancelled orders are excluded.
                </p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th} />
                        <th style={styles.th}>Delivered</th>
                        <th style={styles.th}>Order</th>
                        <th style={styles.th}>Legs</th>
                        <th style={styles.thRight}>Pay</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const payable = !row.alreadySettled && !row.skipReason && Number(row.amount) > 0;
                        return (
                          <tr key={row.orderId} style={selected.has(row.orderId) && payable ? styles.rowSelected : undefined}>
                            <td style={styles.td}>
                              <input
                                type="checkbox"
                                disabled={!payable}
                                checked={selected.has(row.orderId)}
                                onChange={(e) => toggleOne(row.orderId, e.target.checked)}
                              />
                            </td>
                            <td style={styles.tdMuted}>
                              {row.deliveredAt
                                ? new Date(row.deliveredAt).toLocaleString(undefined, {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td style={styles.td}>
                              <strong>{row.orderNumber}</strong>
                              <div style={styles.sub}>{row.paymentStatus ?? '—'}</div>
                            </td>
                            <td style={styles.tdMuted}>
                              {row.pickupCompleted ? 'Pickup' : 'No pickup'}
                              {' · '}
                              {row.lastMileCompleted ? 'Home' : 'No home'}
                            </td>
                            <td style={styles.tdRight}>{formatMoney(row.amount)}</td>
                            <td style={styles.td}>
                              {row.alreadySettled ? (
                                <span style={styles.settled}>Settled</span>
                              ) : row.skipReason ? (
                                <span style={styles.skipBadge}>{row.skipReason}</span>
                              ) : (
                                <span style={styles.openBadge}>Open</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <Card padding="sm" style={styles.cardPad}>
              <p style={styles.muted}>
                Per-order pay is off for this town. Turn it on in Towns → Incentives, or collect franchise only.
              </p>
            </Card>
          )}
        </div>

        <aside className="dp-side">
          <Card padding="sm" elevated style={{ ...styles.cardPad, ...styles.summaryCard }}>
            <h2 style={styles.sectionTitle}>Summary</h2>
            {!townId || !payeeId ? (
              <p style={styles.muted}>Select a {isHub ? 'hub' : 'agent'} to see net.</p>
            ) : (
              <>
                {showOrders ? (
                  <div style={styles.netHero}>
                    <span style={styles.netLabel}>{isHub ? 'Net to hub' : 'Net to agent'}</span>
                    <strong style={styles.netValue}>{formatMoney(selectedTotal)}</strong>
                  </div>
                ) : null}
                {showFranchise && franchise ? (
                  <div style={styles.collectHero}>
                    <span style={styles.netLabel}>Franchise due from hub</span>
                    <strong style={styles.netValue}>{formatMoney(franchise.amount)}</strong>
                  </div>
                ) : null}
                <p style={styles.muted}>
                  {isHub
                    ? model === 'BOTH'
                      ? 'This town uses franchise + per completed order.'
                      : model === 'FRANCHISE'
                        ? 'This town is franchise-only.'
                        : 'This town pays per completed order.'
                    : 'One completed home delivery = one payable order for that agent.'}
                </p>
              </>
            )}
            <div style={styles.sideActions}>
              {showOrders ? (
                <Button size="sm" disabled={!canPayOrders} onClick={() => setConfirmKind('PER_ORDER')}>
                  {saving ? 'Saving…' : `Mark paid · ${formatMoney(selectedTotal)}`}
                </Button>
              ) : null}
              {showFranchise && franchise ? (
                <Button
                  size="sm"
                  variant={showOrders ? 'secondary' : undefined}
                  disabled={!canCollectFranchise}
                  onClick={() => setConfirmKind('FRANCHISE')}
                >
                  {saving ? 'Saving…' : `Mark received · ${formatMoney(franchise.amount)}`}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => void reload()} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {confirmKind ? (
        <div
          style={styles.confirmOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setConfirmKind(null);
          }}
        >
          <div role="dialog" aria-modal="true" style={styles.confirmDialog} onMouseDown={(e) => e.stopPropagation()}>
            <h2 style={styles.confirmTitle}>
              {confirmKind === 'FRANCHISE' ? 'Confirm franchise received?' : 'Confirm payout?'}
            </h2>
            <p style={styles.confirmBody}>
              {confirmKind === 'FRANCHISE' ? (
                <>
                  Collect <strong>{formatMoney(franchise?.amount)}</strong> from <strong>{payeeName || 'hub'}</strong>?
                </>
              ) : (
                <>
                  Pay <strong>{formatMoney(selectedTotal)}</strong> to <strong>{payeeName || (isHub ? 'hub' : 'agent')}</strong>?
                </>
              )}
            </p>
            <p style={styles.confirmMeta}>
              {confirmKind === 'PER_ORDER' ? `${selected.size} order${selected.size === 1 ? '' : 's'} · ` : ''}
              {payoutMethod} · ref <strong>{transactionReference.trim()}</strong>
            </p>
            <p style={styles.confirmWarn}>This cannot be undone from here. Check UTR / amount first.</p>
            <div style={styles.confirmActions}>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => setConfirmKind(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void submit(confirmKind)}>
                {saving ? 'Saving…' : confirmKind === 'FRANCHISE' ? 'Yes, mark received' : 'Yes, mark paid'}
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
          <p style={styles.muted}>No hub/agent settlements in this range.</p>
        ) : (
          <div style={styles.tableWrapWide}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>When</th>
                  <th style={styles.th}>{isHub ? 'Hub' : 'Agent'}</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.thRight}>Amount</th>
                  <th style={styles.th}>Type</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const collection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
                  const lines = s.lines ?? [];
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
                            {s.periodType} · {lines.length} line{lines.length === 1 ? '' : 's'}
                          </div>
                          {lines.length > 0 ? (
                            <button
                              type="button"
                              style={styles.linkBtn}
                              onClick={() => setExpandedHistoryId(open ? null : s.id)}
                            >
                              {open ? 'Hide lines' : 'Lines'}
                            </button>
                          ) : null}
                        </td>
                        <td style={styles.tdMuted}>
                          {s.payoutMethod ?? '—'}
                          <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                        </td>
                        <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                        <td style={styles.td}>
                          <span style={collection ? styles.collectBadge : styles.settled}>
                            {collection ? 'Received' : s.status}
                          </span>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={6} style={styles.detailCell}>
                            <ul style={styles.lineList}>
                              {lines.map((l) => (
                                <li key={l.id}>
                                  {formatMoney(l.amount)} · {l.orderNumber || l.description || l.lineType}
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

      <style>{`
.dp-layout { display: grid; gap: 0.55rem; align-items: start; }
.dp-main { display: grid; gap: 0.55rem; min-width: 0; }
.dp-side { min-width: 0; }
.dp-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem 0.45rem; }
.dp-notes { grid-column: span 2; }
@media (max-width: 900px) {
  .dp-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dp-notes { grid-column: 1 / -1; }
}
@media (min-width: 1040px) {
  .dp-layout { grid-template-columns: minmax(0, 1fr) minmax(240px, 270px); }
  .dp-side { position: sticky; top: 0.5rem; }
}
`}</style>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  cardPad: { display: 'grid', gap: '0.45rem' },
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
  hint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  summaryCard: { gap: '0.5rem' },
  netHero: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  collectHero: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--warning-soft)',
    border: '1px solid color-mix(in srgb, #d97706 35%, transparent)',
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
  sideActions: { display: 'grid', gap: '0.35rem' },
  req: { color: '#b91c1c', fontWeight: 800 },
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
  skipBadge: {
    fontSize: '0.64rem',
    color: '#6b7280',
    background: 'var(--bg-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.35rem',
    fontWeight: 700,
  },
  collectBadge: {
    fontSize: '0.64rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.35rem',
    fontWeight: 700,
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
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
  lineList: {
    margin: 0,
    paddingLeft: '1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
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
  confirmTitle: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem' },
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
};
