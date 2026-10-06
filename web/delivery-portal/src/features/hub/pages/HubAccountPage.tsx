import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Card } from '@/shared/ui';
import { HubShell } from '../layout/HubShell';
import { fetchMyHub } from '../api/hubApi';
import { fetchHubAccountSummary, payoutsReceivedTotal, type HubAccountSummary, type HubCommissionOrder } from '../api/hubAccountApi';
import { HubPaymentHistoryPanel } from '../components/HubPaymentHistoryPanel';
import { HubPaymentRequestsPanel } from '../components/HubPaymentRequestsPanel';
import { fetchHubPaymentRequests } from '../api/hubPaymentRequestApi';
import { HubCodDuePanel } from '../components/HubCodDuePanel';
import { HubFranchiseDuePanel } from '../components/HubFranchiseDuePanel';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { formatIsoDateRange } from '../lib/codFormat';
import { isoIstDate, rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';
/** KoyaKart → hub vs hub → KoyaKart — separate screens. */
type AccountTab = 'receive' | 'pay';
type OrderBucket = 'earned' | 'paid' | 'due';
type PaySubTab = 'cod' | 'cod-due' | 'franchise' | 'franchise-due';
type PaySectionTab = 'bills' | 'history' | 'balances';

const PAY_BILL_TABS: { id: PaySubTab; label: string }[] = [
  { id: 'cod', label: 'COD statement' },
  { id: 'cod-due', label: 'COD due' },
  { id: 'franchise', label: 'Franchise fee' },
  { id: 'franchise-due', label: 'Franchise due' },
];

const PAY_SECTION_TABS: { id: PaySectionTab; label: string; icon: string }[] = [
  { id: 'bills', label: 'Pay bills', icon: '₹' },
  { id: 'history', label: 'Transfer history', icon: '↗' },
  { id: 'balances', label: 'Balances', icon: '◎' },
];

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function formatIstDay(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function tripDateMs(row: HubCommissionOrder, preferPaid: boolean): number {
  const raw = preferPaid ? row.paidAt || row.deliveredAt : row.deliveredAt || row.paidAt;
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function sortTripsByDateAsc(rows: HubCommissionOrder[], preferPaid: boolean): HubCommissionOrder[] {
  return [...rows].sort((a, b) => {
    const byDate = tripDateMs(a, preferPaid) - tripDateMs(b, preferPaid);
    if (byDate !== 0) return byDate;
    return (a.orderNumber || '').localeCompare(b.orderNumber || '', undefined, { numeric: true });
  });
}

export function HubAccountPage() {
  const { session } = useAuth();
  const [hubName, setHubName] = useState('');
  const [tab, setTab] = useState<AccountTab>('receive');
  const [paySub, setPaySub] = useState<PaySubTab>('cod');
  const [paySection, setPaySection] = useState<PaySectionTab>('bills');
  const initialCommissionRange = rangeForReportPreset('month');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initialCommissionRange.from);
  const [to, setTo] = useState(initialCommissionRange.to);
  const [data, setData] = useState<HubAccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [orderBucket, setOrderBucket] = useState<OrderBucket>('due');
  const [codPending, setCodPending] = useState(0);
  const [franchisePending, setFranchisePending] = useState(0);

  useEffect(() => {
    if (!session) return;
    void fetchMyHub(session.accessToken).then((me) => setHubName(me.hubName)).catch(() => {});
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchHubAccountSummary(session.accessToken, from, to));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load accounts');
    } finally {
      setLoading(false);
    }
  }, [session, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadBillCounts = useCallback(async () => {
    if (!session) return;
    try {
      const [cod, franchise] = await Promise.all([
        fetchHubPaymentRequests(session.accessToken, 'COD'),
        fetchHubPaymentRequests(session.accessToken, 'FRANCHISE'),
      ]);
      const pending = (rows: { status: string }[]) =>
        rows.filter((r) => r.status === 'ISSUED' || r.status === 'PAYMENT_PENDING').length;
      setCodPending(pending(cod));
      setFranchisePending(pending(franchise));
    } catch {
      setCodPending(0);
      setFranchisePending(0);
    }
  }, [session]);

  useEffect(() => {
    void loadBillCounts();
  }, [loadBillCounts, historyRefresh]);

  const youOwe = useMemo(() => {
    if (!data) return 0;
    if (data.payableToPlatformNow != null) return Number(data.payableToPlatformNow);
    return 0;
  }, [data]);

  const platformOwes = Number(data?.commissionDue ?? 0);
  const paidReceived = data ? payoutsReceivedTotal(data) : 0;
  const hasPending = Boolean(data?.hasPendingPaymentSubmission);
  const earnedOrders = data?.earnedOrders ?? data?.unpaidOrders ?? [];
  const paidOrders = data?.paidOrders ?? [];
  const dueOrders = data?.unpaidOrders ?? [];
  const bucketOrders = sortTripsByDateAsc(
    orderBucket === 'earned' ? earnedOrders : orderBucket === 'paid' ? paidOrders : dueOrders,
    orderBucket === 'paid',
  );
  const bucketCount =
    orderBucket === 'earned'
      ? Number(data?.earnedOrderCount ?? earnedOrders.length)
      : orderBucket === 'paid'
        ? Number(data?.paidOrderCount ?? paidOrders.length)
        : Number(data?.unpaidOrderCount ?? dueOrders.length);
  const bucketTotal =
    orderBucket === 'earned'
      ? Number(data?.commissionEarned ?? 0)
      : orderBucket === 'paid'
        ? paidReceived
        : Number(data?.commissionDue ?? 0);
  const bucketTitle =
    orderBucket === 'earned' ? 'Earned trips' : orderBucket === 'paid' ? 'Paid trips' : 'Unpaid trips';
  const bucketEmpty =
    orderBucket === 'earned'
      ? 'No earned commission in this period.'
      : orderBucket === 'paid'
        ? 'No payouts received in this period.'
        : 'No unpaid commission in this period.';

  const refreshAll = useCallback(() => {
    setHistoryRefresh((k) => k + 1);
    void load();
  }, [load]);

  return (
    <HubShell
      title="Accounts"
      subtitle={hubName ? `${hubName}` : 'KoyaKart money'}
      onRefresh={refreshAll}
    >
      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && !data ? <p style={styles.muted}>Loading…</p> : null}

      {data ? (
        <>
          <nav style={styles.tabs} role="tablist" aria-label="Money direction">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'receive'}
              style={tab === 'receive' ? styles.tabOnReceive : styles.tabOff}
              onClick={() => setTab('receive')}
            >
              KoyaKart pays you
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'pay'}
              style={tab === 'pay' ? styles.tabOnPay : styles.tabOff}
              onClick={() => setTab('pay')}
            >
              You pay KoyaKart
              {youOwe > 0 && !hasPending ? <span style={styles.tabDot} /> : null}
            </button>
          </nav>

          {tab === 'receive' ? (
            <div style={styles.tabPanel}>
              <Card style={styles.scopeReceive}>
                <p style={styles.scopeTitle}>Delivery commission</p>
                <strong style={styles.scopeAmount}>{money(platformOwes)}</strong>
                <p style={styles.scopeHint}>Due from KoyaKart for trips in the period below — not franchise or COD.</p>
              </Card>

              <DateRangePresetBar
                preset={preset}
                from={from}
                to={to}
                onPresetChange={setPreset}
                onFromChange={setFrom}
                onToChange={setTo}
                maxDate={isoIstDate()}
                ariaLabel="Commission period"
              />
              <p style={styles.periodMeta}>
                {formatIsoDateRange(data.from, data.to)} · {data.deliveredOrdersInRange} trips
              </p>

              <Card style={styles.block}>
                <div style={styles.statRow} role="tablist" aria-label="Commission trips">
                  <Stat
                    label="Earned"
                    value={money(data.commissionEarned)}
                    selected={orderBucket === 'earned'}
                    onSelect={() => setOrderBucket('earned')}
                  />
                  <Stat
                    label="Paid"
                    value={money(paidReceived)}
                    selected={orderBucket === 'paid'}
                    onSelect={() => setOrderBucket('paid')}
                  />
                  <Stat
                    label="Due"
                    value={money(data.commissionDue)}
                    selected={orderBucket === 'due'}
                    onSelect={() => setOrderBucket('due')}
                  />
                </div>
                <p style={styles.blockMeta}>
                  {data.commissionEnabled
                    ? `Pickup ${money(data.pickupRate)} · Home ${money(data.lastMileRate)} · Order ${money(data.completedOrderRate)}`
                    : 'Per-order pay off'}
                  {' · '}
                  <Link to="/hub/incentives" style={styles.link}>
                    Agent rates
                  </Link>
                </p>
                {bucketCount > 0 ? (
                  <>
                    <p style={styles.listHead}>
                      {bucketCount} {bucketTitle.toLowerCase()} · {money(bucketTotal)}
                    </p>
                    {orderBucket === 'paid' && data.payoutsFromPlatform.length > 0 ? (
                      <p style={styles.blockMeta}>
                        {data.payoutsFromPlatform
                          .map((p) => {
                            const paidOn = formatIstDay(p.recordedAt);
                            return `${money(p.amount)}${paidOn ? ` · paid ${paidOn}` : ''}${p.reference ? ` · ${p.reference}` : ''}`;
                          })
                          .join(' · ')}
                      </p>
                    ) : null}
                    {bucketOrders.length < bucketCount ? (
                      <p style={styles.listWarn}>
                        Showing {bucketOrders.length} of {bucketCount} — narrow the date range or refresh.
                      </p>
                    ) : null}
                    <div style={styles.orderTableWrap}>
                      <table style={styles.orderTable}>
                        <thead>
                          <tr>
                            <th style={styles.thOrder}>Order</th>
                            <th style={styles.thPaid}>Paid</th>
                            <th style={styles.thAmt}>₹</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bucketOrders.map((o) => {
                            const paidOn = formatIstDay(o.paidAt);
                            const paidCell = paidOn
                              ? `${paidOn}${o.reference ? ` · ${o.reference}` : ''}`
                              : orderBucket === 'earned' && o.settled
                                ? 'Paid'
                                : '—';
                            return (
                              <tr key={o.orderId}>
                                <td style={styles.tdOrder}>{o.orderNumber}</td>
                                <td style={styles.tdPaid}>{paidCell}</td>
                                <td style={styles.tdAmt}>{money(o.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p style={styles.muted}>{bucketEmpty}</p>
                )}
              </Card>
            </div>
          ) : null}

          {tab === 'pay' ? (
            <div style={styles.tabPanel}>
              <div style={styles.scopePay}>
                <p style={styles.scopeTitle}>You pay KoyaKart</p>
                <strong style={styles.scopeAmountPay}>{money(youOwe)}</strong>
                <p style={styles.scopeHint}>
                  Pay issued bills, or pick a term on COD due / Franchise due to see what that period would cost.
                </p>
              </div>

              <div style={styles.payNavBlock}>
                <nav style={styles.paySectionTrack} role="tablist" aria-label="You pay KoyaKart sections">
                  {PAY_SECTION_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={paySection === t.id}
                      style={paySection === t.id ? styles.paySectionOn : styles.paySectionOff}
                      onClick={() => setPaySection(t.id)}
                    >
                      <span style={styles.payTabInner}>
                        <span style={styles.payTabIcon} aria-hidden>
                          {t.icon}
                        </span>
                        <span>{t.label}</span>
                        {t.id === 'history' && hasPending ? <span style={styles.tabPendingDot} aria-hidden /> : null}
                      </span>
                    </button>
                  ))}
                </nav>

                {paySection === 'bills' ? (
                  <div style={styles.paySubRow}>
                    <nav style={styles.paySubTrack} role="tablist" aria-label="Bill type">
                      {PAY_BILL_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          aria-selected={paySub === t.id}
                          style={paySub === t.id ? styles.paySubOn : styles.paySubOff}
                          onClick={() => setPaySub(t.id)}
                        >
                          {t.id === 'cod'
                            ? `${t.label} (${codPending})`
                            : t.id === 'franchise'
                              ? `${t.label} (${franchisePending})`
                              : t.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                ) : null}
              </div>

              {paySection === 'bills' ? (
                <>

                  {hasPending && data.pendingPaymentStatusLabel ? (
                    <p style={styles.pendingBanner}>
                      {data.pendingPaymentStatusLabel}
                      {data.pendingPaymentTotal != null ? ` · ${money(Number(data.pendingPaymentTotal))}` : ''}
                      {' · '}
                      <button
                        type="button"
                        style={styles.inlineLinkBtn}
                        onClick={() => setPaySection('history')}
                      >
                        View transfer history
                      </button>
                    </p>
                  ) : null}

                  {session ? (
                    <Card style={styles.block}>
                      {paySub === 'cod' ? (
                        <HubPaymentRequestsPanel
                          token={session.accessToken}
                          kind="COD"
                          onSubmitted={() => {
                            setHistoryRefresh((k) => k + 1);
                            void load();
                            setPaySection('history');
                          }}
                        />
                      ) : null}
                      {paySub === 'cod-due' ? <HubCodDuePanel token={session.accessToken} /> : null}
                      {paySub === 'franchise' ? (
                        <HubPaymentRequestsPanel
                          token={session.accessToken}
                          kind="FRANCHISE"
                          onSubmitted={() => {
                            setHistoryRefresh((k) => k + 1);
                            void load();
                            setPaySection('history');
                          }}
                        />
                      ) : null}
                      {paySub === 'franchise-due' ? <HubFranchiseDuePanel token={session.accessToken} /> : null}
                    </Card>
                  ) : null}
                </>
              ) : null}

              {paySection === 'history' && session ? (
                <HubPaymentHistoryPanel token={session.accessToken} refreshKey={historyRefresh} />
              ) : null}

              {paySection === 'balances' ? (
                <Card style={styles.block}>
                  <p style={styles.listHead}>Pay KoyaKart</p>
                  <div style={styles.oweGrid}>
                    <div style={styles.oweCard}>
                      <span style={styles.oweKind}>COD</span>
                      <strong style={styles.oweAmt}>{money(data.codOwedToCompany)}</strong>
                      <span style={codStatusStyle(data)}>
                        {data.codPendingVerification ? 'Payment sent — waiting KoyaKart' : data.codOwedToCompany > 0 ? 'Due' : 'Cleared'}
                      </span>
                    </div>
                    {data.franchiseEnabled ? (
                      <div style={styles.oweCard}>
                        <span style={styles.oweKind}>Franchise</span>
                        <strong style={styles.oweAmt}>{money(data.franchiseAmount)}</strong>
                        <span style={franchiseStatusStyle(data)}>
                          {data.franchiseCollected
                            ? 'Paid'
                            : data.franchisePendingVerification
                              ? 'Payment sent — waiting KoyaKart'
                              : 'Due'}
                        </span>
                        {franchiseMonthHint(data.franchiseLabel) ? (
                          <span style={styles.oweHint}>{franchiseMonthHint(data.franchiseLabel)}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div style={styles.oweCardMuted}>
                        <span style={styles.oweKind}>Franchise</span>
                        <strong style={styles.oweAmtMuted}>—</strong>
                        <span style={styles.oweHint}>Not enrolled</span>
                      </div>
                    )}
                  </div>

                  <p style={styles.listHead}>COD already at this hub</p>
                  <p style={styles.mutedSmall}>Cash you confirmed from agents, minus what you already remitted.</p>
                  <div style={styles.trailRow}>
                    <MiniStat label="Confirmed" value={money(data.codConfirmedAtHubAllTime)} />
                    <MiniStat label="Remitted" value={money(data.codRemittedToCompanyAllTime)} />
                    <MiniStat label="Still to pay" value={money(data.codOwedToCompany)} />
                  </div>
                  <Link to="/hub/cod?view=account" style={styles.link}>
                    COD ledger →
                  </Link>

                  <p style={styles.listHead}>COD not at hub yet</p>
                  <p style={styles.mutedSmall}>Does not add to “Pay KoyaKart” until you confirm the handover.</p>
                  <div style={styles.miniRow}>
                    <MiniStat label="Still with agents" value={money(data.codStillWithAgents)} />
                    <MiniStat label="Handovers to confirm" value={money(data.codDeclaredAwaitingConfirm)} />
                  </div>
                  {data.handoversAwaitingConfirm > 0 ? (
                    <Link to="/hub/cod" style={styles.actionLink}>
                      Confirm {data.handoversAwaitingConfirm} handover
                      {data.handoversAwaitingConfirm === 1 ? '' : 's'} →
                    </Link>
                  ) : null}
                </Card>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </HubShell>
  );
}

function franchiseMonthHint(label?: string | null): string | null {
  if (!label) return null;
  const cleaned = label.replace(/\s*₹[\d.,]+.*$/u, '').trim();
  return cleaned || null;
}

function statusTone(kind: 'due' | 'ok' | 'wait'): CSSProperties {
  if (kind === 'ok') return { fontSize: '0.68rem', fontWeight: 800, color: '#15803d' };
  if (kind === 'wait') return { fontSize: '0.68rem', fontWeight: 800, color: '#b45309' };
  return { fontSize: '0.68rem', fontWeight: 800, color: '#c2410c' };
}

function codStatusStyle(data: HubAccountSummary): CSSProperties {
  if (data.codPendingVerification) return statusTone('wait');
  return statusTone(data.codOwedToCompany > 0 ? 'due' : 'ok');
}

function franchiseStatusStyle(data: HubAccountSummary): CSSProperties {
  if (data.franchiseCollected) return statusTone('ok');
  if (data.franchisePendingVerification) return statusTone('wait');
  return statusTone('due');
}

function Stat({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      style={{ ...styles.stat, ...(selected ? styles.statAccent : null) }}
    >
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniStat}>
      <span style={styles.miniLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  mutedSmall: { margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  error: { color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 650, margin: '0 0 0.5rem' },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.35rem',
    padding: '0.3rem',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    marginBottom: '0.65rem',
  },
  tabOnReceive: {
    border: '1px solid #a7f3d0',
    borderRadius: 11,
    padding: '0.55rem 0.4rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #ecfdf5, #d1fae5)',
    color: '#14532d',
    fontFamily: 'inherit',
  },
  tabOnPay: {
    border: '1px solid #fed7aa',
    borderRadius: 11,
    padding: '0.55rem 0.4rem',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'linear-gradient(145deg, #fff7ed, #ffedd5)',
    color: '#9a3412',
    fontFamily: 'inherit',
    position: 'relative',
  },
  payNavBlock: {
    display: 'grid',
    gap: '0.45rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 16,
    border: '1px solid color-mix(in srgb, #fed7aa 55%, var(--border))',
    background:
      'linear-gradient(165deg, color-mix(in srgb, #fff7ed 70%, var(--bg-elevated)), var(--bg-elevated))',
    boxShadow: 'var(--shadow-soft)',
  },
  paySectionTrack: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem',
    borderRadius: 12,
    background: 'color-mix(in srgb, var(--bg-muted) 25%, var(--bg))',
    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
  },
  paySectionOn: {
    border: 'none',
    borderRadius: 9,
    padding: '0.48rem 0.85rem',
    fontWeight: 800,
    fontSize: '0.74rem',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    background: 'linear-gradient(180deg, #ffffff 0%, #ffedd5 100%)',
    color: '#9a3412',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 2px 10px rgba(234, 88, 12, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
  },
  paySectionOff: {
    border: 'none',
    borderRadius: 9,
    padding: '0.48rem 0.85rem',
    fontWeight: 650,
    fontSize: '0.74rem',
    lineHeight: 1.2,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--text-muted)',
  },
  payTabInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    position: 'relative',
  },
  payTabIcon: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '1.35rem',
    height: '1.35rem',
    borderRadius: 8,
    fontSize: '0.72rem',
    fontWeight: 900,
    background: 'color-mix(in srgb, #fed7aa 35%, transparent)',
    color: '#c2410c',
    flexShrink: 0,
  },
  tabPendingDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 25%, white)',
    flexShrink: 0,
  },
  paySubRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  paySubTrack: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.22rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, #ffedd5 50%, var(--bg))',
    border: '1px solid #fdba74',
  },
  inlineLinkBtn: {
    border: 'none',
    background: 'none',
    padding: 0,
    font: 'inherit',
    fontWeight: 800,
    color: '#b45309',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  paySubOn: {
    border: 'none',
    borderRadius: 999,
    padding: '0.4rem 1rem',
    fontWeight: 800,
    fontSize: '0.72rem',
    background: '#ffffff',
    color: '#c2410c',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 5px rgba(15, 23, 42, 0.08)',
  },
  paySubOff: {
    border: 'none',
    borderRadius: 999,
    padding: '0.4rem 1rem',
    fontWeight: 650,
    fontSize: '0.72rem',
    background: 'transparent',
    color: '#b45309',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabOff: {
    border: 'none',
    borderRadius: 11,
    padding: '0.55rem 0.4rem',
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
    position: 'relative',
  },
  tabDot: {
    position: 'absolute',
    top: 8,
    right: '12%',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
  },
  tabPanel: { display: 'grid', gap: '0.55rem', paddingBottom: '0.5rem', width: '100%', minWidth: 0 },
  scopeReceive: {
    padding: '0.65rem 0.75rem',
    borderRadius: 16,
    border: '1px solid #a7f3d0',
    background: 'color-mix(in srgb, #ecfdf5 50%, var(--bg-elevated))',
    display: 'grid',
    gap: '0.2rem',
  },
  scopePay: {
    padding: '0.7rem 0.85rem',
    borderRadius: 16,
    border: '1px solid #fed7aa',
    background: 'linear-gradient(135deg, #fff7ed 0%, color-mix(in srgb, #fff7ed 40%, var(--bg-elevated)) 100%)',
    display: 'grid',
    gap: '0.22rem',
    boxShadow: 'var(--shadow-soft)',
  },
  scopeTitle: { margin: 0, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  scopeAmount: { fontSize: '1.4rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#15803d' },
  scopeAmountPay: { fontSize: '1.4rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c' },
  scopeHint: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  pendingBanner: {
    margin: 0,
    padding: '0.4rem 0.55rem',
    borderRadius: 10,
    fontSize: '0.72rem',
    fontWeight: 750,
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
  },
  periodBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' },
  periodLabel: { fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' },
  periodPills: { display: 'flex', gap: '0.25rem' },
  pillOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.28rem 0.6rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pillOff: {
    border: '1px solid var(--border)',
    background: 'transparent',
    borderRadius: 999,
    padding: '0.28rem 0.6rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontFamily: 'inherit',
  },
  customRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  dateField: { display: 'grid', gap: '0.15rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  dateInput: { font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.45rem', borderRadius: 8, border: '1px solid var(--border)' },
  periodMeta: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  block: { padding: '0.65rem 0.75rem', borderRadius: 16, display: 'grid', gap: '0.4rem' },
  blockTitle: { margin: 0, fontSize: '0.88rem', fontWeight: 800 },
  blockMeta: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  subHead: { margin: '0.15rem 0 0', fontSize: '0.78rem', fontWeight: 800 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' },
  stat: {
    padding: '0.4rem 0.45rem',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.08rem',
    textAlign: 'left',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
    width: '100%',
  },
  statAccent: { borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))', background: 'var(--accent-soft)' },
  statLabel: { fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  statValue: { fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' },
  listHead: { margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' },
  listWarn: { margin: 0, fontSize: '0.68rem', fontWeight: 650, color: 'var(--danger)' },
  orderTableWrap: {
    maxHeight: 'min(16rem, 42vh)',
    overflowY: 'auto',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  },
  orderTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' },
  thOrder: {
    textAlign: 'left',
    fontWeight: 800,
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '0.28rem 0.35rem 0.28rem 0',
    width: '42%',
  },
  thPaid: {
    textAlign: 'left',
    fontWeight: 800,
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '0.28rem 0.35rem',
    width: '40%',
  },
  thAmt: {
    textAlign: 'right',
    fontWeight: 800,
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '0.28rem 0 0.28rem 0.35rem',
    width: '18%',
  },
  tdOrder: {
    padding: '0.22rem 0.35rem 0.22rem 0',
    fontWeight: 650,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tdPaid: {
    padding: '0.22rem 0.35rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tdAmt: {
    padding: '0.22rem 0 0.22rem 0.35rem',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  simpleList: {
    margin: 0,
    paddingLeft: '1.1rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    display: 'grid',
    gap: '0.2rem',
  },
  orderItem: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.25rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    padding: '0.35rem 0',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
  },
  miniRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' },
  trailRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' },
  oweGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.35rem' },
  oweCard: {
    display: 'grid',
    gap: '0.12rem',
    padding: '0.45rem 0.5rem',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid color-mix(in srgb, #fed7aa 70%, var(--border))',
    background: 'color-mix(in srgb, #fff7ed 55%, var(--bg-elevated))',
    textAlign: 'left',
  },
  oweCardMuted: {
    display: 'grid',
    gap: '0.12rem',
    padding: '0.45rem 0.5rem',
    borderRadius: 12,
    border: '1px dashed var(--border)',
    background: 'var(--bg-elevated)',
  },
  oweKind: { fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  oweAmt: { fontSize: '1.05rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c' },
  oweAmtMuted: { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-muted)' },
  oweHint: { fontSize: '0.68rem', fontWeight: 650, color: 'var(--text-muted)', lineHeight: 1.3 },
  miniStat: {
    padding: '0.35rem 0.45rem',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    fontSize: '0.72rem',
    display: 'grid',
    gap: '0.08rem',
  },
  miniLabel: { fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' },
  link: { fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' },
  actionLink: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' },
};
