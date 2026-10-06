import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, KpiCard } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { fetchPlatformReport, type PlatformReport } from '../api/platformReportsApi';
import { coverMonth, DailyCalendar } from '../components/DailyCalendar';
import { fetchMembershipReport, type MembershipReport } from '@/features/memberships/api/membershipsApi';
import { fetchScratchGiftReport, type ScratchGiftReport } from '@/features/scratch/api/scratchGiftApi';
import {
  fetchAdRevenue,
  fetchMoneyAssurance,
  fetchOpsAssurance,
  fetchReferralReport,
  type AdRevenueReport,
  type MoneyAssuranceReport,
  type OpsAssuranceReport,
  type ReferralReport,
} from '../api/opsReportsApi';
import {
  isoIstDate,
  rangeForReportPreset,
  REPORT_DATE_PRESET_OPTIONS,
  type ReportDatePreset,
} from '@/shared/dates/istReportPresets';
import { displayPayeeLabel } from '@/shared/display/displayNames';
import { GMV_SHORT, GMV_TIPS } from '@/shared/glossary/gmv';
import { MEMBERSHIP_DELIVERY_TIPS } from '@/shared/glossary/membershipDeliveryTips';
type ReportTab =
  | 'sales'
  | 'membership'
  | 'towns'
  | 'vendors'
  | 'daily'
  | 'mix'
  | 'gst'
  | 'claims'
  | 'sla'
  | 'money'
  | 'growth'
  | 'scratch'
  | 'referrals';

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'membership', label: 'Membership' },
  { id: 'towns', label: 'Towns' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'daily', label: 'Daily' },
  { id: 'mix', label: 'Mix' },
  { id: 'gst', label: 'GST' },
  { id: 'claims', label: 'Claims' },
  { id: 'sla', label: 'SLA' },
  { id: 'money', label: 'Money' },
  { id: 'growth', label: 'Ads' },
  { id: 'scratch', label: 'Scratch' },
  { id: 'referrals', label: 'Referrals' },
];

function labelOf(name: string): string {
  const known: Record<string, string> = {
    ONLINE: 'Online',
    COD: 'Cash on delivery',
    UNKNOWN: 'Unknown',
    PAYMENT_PENDING: 'Waiting for payment',
    PLACED: 'Placed',
    PAYMENT_FAILED: 'Payment failed',
    CANCELLED: 'Cancelled',
    DELIVERED: 'Delivered',
    QUARTERLY: '3 months',
    HALF_YEAR: '6 months',
    ANNUAL: 'Annual',
    CASH: 'Cash',
    ADMIN_GIFT: 'Gift',
    WRONG_ITEM: 'Wrong item',
    MISSING: 'Missing',
    DAMAGED: 'Damaged',
    HOME_HERO: 'Home strip',
    HOME_MID_GRID: 'Mid-grid',
    CART_UPSELL: 'Cart ad',
    ISSUED: 'Issued',
    PAID: 'Paid',
    VOID: 'Void',
    VENDOR: 'Vendor',
    HUB: 'Hub',
    AGENT: 'Agent',
    SCRATCH_CARD: 'Scratch card',
    REFERRAL_REFEREE: 'Referral welcome',
    REFERRAL_REFERRER: 'Referral referrer',
    ORDER_ITEM_CANCEL: 'Store credit',
    ORDER_CHECKOUT: 'Used at checkout',
  };
  return known[name] ?? name;
}

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function ReportsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const initial = rangeForReportPreset('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [membership, setMembership] = useState<MembershipReport | null>(null);
  const [ops, setOps] = useState<OpsAssuranceReport | null>(null);
  const [moneyPack, setMoneyPack] = useState<MoneyAssuranceReport | null>(null);
  const [ads, setAds] = useState<AdRevenueReport | null>(null);
  const [referrals, setReferrals] = useState<ReferralReport | null>(null);
  const [scratch, setScratch] = useState<ScratchGiftReport | null>(null);
  const [tab, setTab] = useState<ReportTab>('sales');
  const [referralQ, setReferralQ] = useState('');
  const [referralUserId, setReferralUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const applyPreset = (next: ReportDatePreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const r = rangeForReportPreset(next);
    setFrom(r.from);
    setTo(r.to);
  };

  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    setMembershipLoading(true);
    setError(null);
    setMembership(null);
    try {
      const range = { townId: townId || undefined, from, to };
      const settled = await Promise.allSettled([
        listTowns(token),
        fetchPlatformReport(token, range),
        fetchOpsAssurance(token, range),
        fetchMoneyAssurance(token, range),
        fetchAdRevenue(token, range),
        fetchReferralReport(token, { from, to }),
        fetchScratchGiftReport(token, range),
      ]);
      if (seq !== loadSeq.current) return;

      const value = <T,>(i: number): T | null =>
        settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : null;
      setTowns(value<TownVm[]>(0) ?? []);
      setReport(value<PlatformReport>(1));
      setOps(value<OpsAssuranceReport>(2));
      setMoneyPack(value<MoneyAssuranceReport>(3));
      setAds(value<AdRevenueReport>(4));
      setReferrals(value<ReferralReport>(5));
      setScratch(value<ScratchGiftReport>(6));

      const failures = settled
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : 'Request failed'));
      if (failures.length === settled.length) {
        setError(failures[0] ?? 'Could not load reports');
      } else if (failures.length > 0) {
        setError(`Some sections did not load (${failures.length} failed). Try Run again or restart payment-service if Money/Membership hang.`);
      }

      void fetchMembershipReport(token, { from, to }, { timeoutMs: 45_000 })
        .then((data) => {
          if (seq !== loadSeq.current) return;
          setMembership(data);
        })
        .catch(() => {
          if (seq !== loadSeq.current) return;
          setMembership(null);
        })
        .finally(() => {
          if (seq !== loadSeq.current) return;
          setMembershipLoading(false);
        });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setReport(null);
      setOps(null);
      setMoneyPack(null);
      setAds(null);
      setReferrals(null);
      setScratch(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load reports');
      setMembershipLoading(false);
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
      }
    }
  }, [token, townId, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const townLabel = useMemo(() => {
    if (!townId) return 'All towns';
    return towns.find((t) => t.id === townId)?.displayName ?? 'Town';
  }, [townId, towns]);

  const referralView = useMemo(() => {
    const q = referralQ.trim().toLowerCase();
    const candidates = (referrals?.candidates ?? []).filter((row) => {
      if (!q) return true;
      return [row.name, row.phone, row.code].some((v) => (v ?? '').toLowerCase().includes(q));
    });
    const selected = referralUserId;
    const lines = (referrals?.lines ?? []).filter((row) => {
      if (selected && row.referrerUserId !== selected) return false;
      if (!q) return true;
      return [row.referrerName, row.referrerPhone, row.refereeName, row.refereePhone, row.code].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      );
    });
    return { candidates, selected, lines };
  }, [referrals, referralQ, referralUserId]);

  function downloadCsv() {
    const stamp = report?.from ?? from;
    const stampTo = report?.to ?? to;
    let lines: string[] = [];
    let name = 'platform';
    if (tab === 'gst' && ops) {
      name = 'gst-hsn';
      lines = [
        ['HSN', 'GST%', 'Lines', 'Taxable', 'CGST', 'SGST', 'IGST', 'Cess', 'Amount'].join(','),
        ...ops.gstByHsn.map((row) =>
          [csvEscape(row.hsn), row.gstPercent, row.lines, row.taxable, row.cgst, row.sgst, row.igst, row.cess, row.amount].join(','),
        ),
      ];
    } else if (tab === 'claims' && ops) {
      name = 'claims';
      lines = [
        ['Type', 'Count', 'Credited'].join(','),
        ...ops.claimsByType.map((row) => [csvEscape(labelOf(row.name)), row.count, row.amount ?? 0].join(',')),
      ];
    } else if (tab === 'sla' && ops) {
      name = 'sla';
      lines = [
        ['Metric', 'Value'].join(','),
        ['On time', ops.deliveredOnTime].join(','),
        ['Late >90m', ops.deliveredLate].join(','),
        ['Still open', ops.stillOpen].join(','),
        ['Open >24h', ops.openOverdue].join(','),
        ['Cancelled', ops.cancelled].join(','),
      ];
    } else if (tab === 'money' && moneyPack) {
      name = 'money';
      lines = [
        ['Bucket', 'Count', 'Amount'].join(','),
        ...moneyPack.aging.map((row) => [csvEscape(row.label), row.count, row.amount].join(',')),
        '',
        ['Payee', 'Type', 'Status', 'Age days', 'Net', 'Period end'].join(','),
        ...moneyPack.oldestUnpaid.map((row) =>
          [csvEscape(row.payeeName), row.payeeType, row.status, row.ageDays, row.netAmount, row.periodEnd ?? ''].join(','),
        ),
        '',
        ['Wallet reason', 'Count', 'Amount'].join(','),
        ...(moneyPack.walletCreditsByReason ?? []).map((row) =>
          [csvEscape(labelOf(row.name)), row.count, row.amount ?? 0].join(','),
        ),
      ];
    } else if (tab === 'growth' && ads) {
      name = 'ads';
      lines = [
        ['Ads billed', ads.billed].join(','),
        ['Ads collected', ads.collected].join(','),
        ['Ads outstanding', ads.outstanding].join(','),
        ['Ad GST', ads.taxCollected].join(','),
        '',
        ['Slot', 'Count', 'Amount'].join(','),
        ...ads.bySlot.map((row) => [csvEscape(labelOf(row.name)), row.count, row.amount ?? 0].join(',')),
      ];
    } else if (tab === 'scratch' && scratch) {
      name = 'scratch';
      lines = [
        ['Gifted', scratch.giftedAmount].join(','),
        ['Scratched', scratch.scratched].join(','),
        ['Issued', scratch.issued].join(','),
        ['Unopened', scratch.unopened].join(','),
        ['Pending min', scratch.pendingMin ?? 0].join(','),
        ['Pending max', scratch.pendingMax ?? 0].join(','),
        '',
        ['Town', 'Issued', 'Scratched', 'Gifted', 'Unopened'].join(','),
        ...(scratch.towns ?? []).map((row) =>
          [csvEscape(row.townName ?? row.townId), row.issued, row.scratched, row.giftedAmount, row.unopened].join(','),
        ),
        '',
        ['Issued', 'Buyer', 'Order', 'Town', 'Status', 'Gifted', 'Band min', 'Band max'].join(','),
        ...(scratch.lines ?? []).map((row) =>
          [
            row.issuedAt,
            csvEscape(row.buyerPhone ?? ''),
            csvEscape(row.orderNumber ?? ''),
            csvEscape(row.townName ?? ''),
            row.status,
            row.companySpent,
            row.rewardMin,
            row.rewardMax,
          ].join(','),
        ),
      ];
    } else if (tab === 'referrals' && referrals) {
      name = 'referrals';
      lines = [
        ['From', referrals.from].join(','),
        ['To', referrals.to].join(','),
        ['Program on', referrals.programEnabled ? 'yes' : 'no'].join(','),
        ['Referrer rate', referrals.referrerRewardAmount].join(','),
        ['Referee rate', referrals.refereeRewardAmount].join(','),
        ['Amounts from wallet', referrals.amountsFromWallet ? 'yes' : 'no'].join(','),
        ['Signups', referrals.signups].join(','),
        ['Candidates', referrals.uniqueReferrers].join(','),
        ['Converted (1st delivery)', referrals.converted].join(','),
        ['Paid to referrers', referrals.spentOnReferrers].join(','),
        ['Paid to referees', referrals.spentOnReferees].join(','),
        ['Company spent', referrals.companySpent].join(','),
        ['Pending liability', referrals.companyPending].join(','),
        ['If all close', referrals.companyIfAllPaid].join(','),
        '',
        ['CANDIDATES'].join(','),
        ['Name', 'Phone', 'Code', 'Referred', 'Converted', 'Earned', 'Company spent', 'Pending'].join(','),
        ...referrals.candidates.map((row) =>
          [
            csvEscape(row.name),
            csvEscape(row.phone),
            csvEscape(row.code),
            row.referred,
            row.converted,
            row.earned,
            row.companySpent,
            row.companyPending,
          ].join(','),
        ),
        '',
        ['LINES'].join(','),
        [
          'Date',
          'Code',
          'Referrer',
          'Referrer phone',
          'Referee',
          'Referee phone',
          'Referee paid',
          'Referee ₹',
          'Referrer paid',
          'Referrer ₹',
          'Company spent',
          'Pending',
          'Order',
        ].join(','),
        ...referrals.lines.map((row) =>
          [
            row.createdAt,
            csvEscape(row.code),
            csvEscape(row.referrerName),
            csvEscape(row.referrerPhone),
            csvEscape(row.refereeName),
            csvEscape(row.refereePhone),
            row.refereePaid ? 'yes' : 'no',
            row.refereeAmount,
            row.referrerPaid ? 'yes' : 'no',
            row.referrerAmount,
            row.companySpent,
            row.companyPending,
            row.qualifyingOrderId ?? '',
          ].join(','),
        ),
      ];
    } else if (report) {
      lines = [
        ['Town', 'Orders', 'Delivered', 'Cancelled', 'Placed GMV', 'Delivered GMV', 'COD GMV'].join(','),
        ...report.towns.map((row) =>
          [
            csvEscape(row.townName ?? row.townId),
            row.orders,
            row.delivered,
            row.cancelled,
            row.placedGmv,
            row.deliveredGmv,
            row.codGmv,
          ].join(','),
        ),
      ];
    } else {
      return;
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koyakart-${name}-${stamp}-${stampTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell title="Reports" onRefresh={() => void reload()}>
      <div style={styles.filters}>
        <label style={styles.field}>
          Town
          <select
            value={townId}
            onChange={(e) => setTownId(e.target.value)}
            style={styles.input}
          >
            <option value="">All towns</option>
            {towns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </label>
        <div style={styles.presets}>
          {REPORT_DATE_PRESET_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={preset === id ? styles.chipOn : styles.chip}
              onClick={() => applyPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label style={styles.field}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPreset('custom');
              setFrom(e.target.value);
            }}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPreset('custom');
              setTo(e.target.value);
            }}
            style={styles.input}
          />
        </label>
        <Button size="sm" onClick={() => void reload()} disabled={loading}>
          {loading ? 'Loading…' : 'Run'}
        </Button>
        <Button size="sm" variant="secondary" onClick={downloadCsv} disabled={!report && !ops && !moneyPack && !ads && !referrals && !scratch}>
          CSV
        </Button>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading && !report && !ops && !moneyPack && !referrals && !scratch ? (
        <p style={styles.muted}>Loading reports…</p>
      ) : null}
      {membershipLoading && tab === 'membership' && !membership ? (
        <p style={styles.muted}>Loading membership figures…</p>
      ) : null}

      {report || ops || moneyPack || ads || referrals || scratch ? (
        <>
          <p style={styles.range}>
            {(report ?? ops ?? moneyPack)?.from} → {(report ?? ops ?? moneyPack)?.to} · {townLabel}
          </p>
          <div style={styles.tabs} role="tablist" aria-label="Report sections">
            {REPORT_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                style={tab === item.id ? styles.tabActive : styles.tab}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'sales' && !report ? (
            <p style={styles.muted}>Sales report did not load.</p>
          ) : null}

          {tab === 'sales' && report ? (
            <>
            <p style={styles.gmvIntro}>{GMV_SHORT}</p>
            <div style={styles.kpis}>
              <KpiCard
                label="Order value (placed)"
                value={money(report.placedGmv)}
                hint="All orders in range"
                tip={GMV_TIPS.placed}
              />
              <KpiCard
                label="Order value (delivered)"
                value={money(report.deliveredGmv)}
                hint="Reached buyer"
                tip={GMV_TIPS.delivered}
              />
              <KpiCard label="AOV" value={money(report.averageOrderValue)} hint="Average order value" />
              <KpiCard label="Orders" value={String(report.ordersPlaced)} hint={`${report.uniqueBuyers} buyers`} />
              <KpiCard label="Delivered" value={String(report.ordersDelivered)} hint={`${report.deliveryRate}%`} />
              <KpiCard label="Cancelled" value={String(report.ordersCancelled)} hint={`${report.cancelRate}%`} />
              <KpiCard
                label="COD order value"
                value={money(report.codGmv)}
                hint="Delivered, cash on delivery"
                tip={GMV_TIPS.cod}
              />
              <KpiCard
                label="Online order value"
                value={money(report.onlineGmv)}
                hint="UPI/card delivered"
                tip={GMV_TIPS.online}
              />
              <KpiCard
                label="Delivery fees collected"
                value={money(report.deliveryFeesCollected ?? 0)}
                hint="On delivered orders"
                tip={MEMBERSHIP_DELIVERY_TIPS.deliveryFeesCollected}
              />
              <KpiCard
                label="Platform fees"
                value={money(report.platformFees)}
                hint="Separate buyer charge"
                tip="Small platform/service fee on orders (not the delivery fee or goods total)."
              />
              <KpiCard label="Promo given" value={money(report.promoDiscounts)} hint="Discounts" />
              <KpiCard
                label="Vendor ready"
                value={report.avgReadyMinutes == null ? '—' : `${report.avgReadyMinutes}m`}
                hint="Avg place → packed"
              />
              <KpiCard
                label="Delivery cycle"
                value={report.avgDeliveryMinutes == null ? '—' : `${report.avgDeliveryMinutes}m`}
                hint="Avg place → delivered"
              />
              <KpiCard
                label="Member deliveries"
                value={String(report.membershipDeliveriesWaived ?? 0)}
                hint="Orders that used a credit"
                tip={MEMBERSHIP_DELIVERY_TIPS.memberDeliveriesCount}
              />
              <KpiCard
                label="Delivery waived"
                value={money(report.membershipFeeWaived)}
                hint="Sum of fees not charged"
                tip={MEMBERSHIP_DELIVERY_TIPS.deliveryWaivedAmount}
              />
            </div>
            </>
          ) : null}

          {tab === 'membership' ? (
            membership ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Active members" value={String(membership.activeMembers)} hint="Usable now" />
                  <KpiCard label="Packs sold" value={String(membership.packsSold)} hint={`${money(membership.paidRevenue)} collected for the app`} />
                  <KpiCard label="Gifts" value={String(membership.gifts)} hint="Free. Not a sale" />
                  <KpiCard label="Cash pending" value={String(membership.cashPending)} hint="Hub to confirm" />
                  <KpiCard label="Credits granted" value={String(membership.creditsGranted)} hint="In this range" />
                  <KpiCard
                    label="Credits used"
                    value={String(membership.deliveriesWaived)}
                    hint={`Waived ${money(membership.deliveryFeeWaived)}`}
                    tip={MEMBERSHIP_DELIVERY_TIPS.creditsUsedInRange}
                  />
                  <KpiCard label="Credits restored" value={String(membership.creditsRestored)} hint="We cancelled / failed" />
                  <KpiCard label="Credits left" value={String(membership.usableCreditsOutstanding)} hint="Outstanding" />
                  <KpiCard label="Expiring 7d" value={String(membership.expiringIn7Days)} hint="Need renew" />
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Plans sold</h2>
                    {(membership.slabMix ?? []).length === 0 ? (
                      <p style={styles.empty}>None in this range.</p>
                    ) : (
                      membership.slabMix.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{labelOf(row.name)}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>How paid</h2>
                    {(membership.channelMix ?? []).length === 0 ? (
                      <p style={styles.empty}>None in this range.</p>
                    ) : (
                      membership.channelMix.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{labelOf(row.name)}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <p style={styles.muted}>Membership figures did not load.</p>
            )
          ) : null}

          {tab === 'towns' && !report ? <p style={styles.muted}>Town report did not load.</p> : null}

          {tab === 'towns' && report ? (
            <Card style={styles.tableCard}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Town</th>
                    <th style={styles.th}>Orders</th>
                    <th style={styles.th}>Deliv.</th>
                    <th style={styles.th}>Canx</th>
                    <th style={styles.th} title={GMV_TIPS.townColumn}>
                      Order value
                    </th>
                    <th style={styles.th}>COD</th>
                  </tr>
                </thead>
                <tbody>
                  {report.towns.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={styles.empty}>
                        No orders in this range.
                      </td>
                    </tr>
                  ) : (
                    report.towns.map((row) => (
                      <tr key={row.townId}>
                        <td style={styles.td}>{row.townName ?? row.townId.slice(0, 8)}</td>
                        <td style={styles.td}>{row.orders}</td>
                        <td style={styles.td}>{row.delivered}</td>
                        <td style={styles.td}>{row.cancelled}</td>
                        <td style={styles.td}>{money(row.placedGmv)}</td>
                        <td style={styles.td}>{money(row.codGmv)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          ) : null}

          {tab === 'vendors' && !report ? <p style={styles.muted}>Vendor report did not load.</p> : null}

          {tab === 'vendors' && report ? (
            <Card style={styles.tableCard}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Shop</th>
                    <th style={styles.th}>Bags</th>
                    <th style={styles.th}>Ready</th>
                    <th style={styles.th}>Reject</th>
                    <th style={styles.th}>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.vendors.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={styles.empty}>
                        No vendor bags.
                      </td>
                    </tr>
                  ) : (
                    report.vendors.map((row) => (
                      <tr key={row.vendorId}>
                        <td style={styles.td}>{row.shopName}</td>
                        <td style={styles.td}>{row.bags}</td>
                        <td style={styles.td}>{row.ready}</td>
                        <td style={styles.td}>{row.rejected}</td>
                        <td style={styles.td}>{money(row.sales)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          ) : null}

          {tab === 'daily' && !report ? <p style={styles.muted}>Daily report did not load.</p> : null}

          {tab === 'daily' && report ? (
            <Card style={styles.tableCard}>
              <DailyCalendar
                rows={report.daily}
                from={from}
                to={to}
                today={isoIstDate()}
                onEnsureMonth={(monthKey) => {
                  const covered = coverMonth(from, to, monthKey, isoIstDate());
                  setPreset('custom');
                  setFrom(covered.from);
                  setTo(covered.to);
                }}
              />
            </Card>
          ) : null}

          {tab === 'mix' && !report ? <p style={styles.muted}>Mix report did not load.</p> : null}

          {tab === 'mix' && report ? (
            <div style={styles.split}>
              <Card style={styles.tableCard}>
                <h2 style={styles.h2}>How buyers paid</h2>
                {report.paymentMix.length === 0 ? (
                  <p style={styles.empty}>None</p>
                ) : (
                  report.paymentMix.map((row) => (
                    <p key={row.name} style={styles.mixRow}>
                      <strong>{labelOf(row.name)}</strong>
                      <span>
                        {row.count} · {money(row.amount)}
                      </span>
                    </p>
                  ))
                )}
              </Card>
              <Card style={styles.tableCard}>
                <h2 style={styles.h2}>Order status</h2>
                {(report.statusMix ?? []).length === 0 ? (
                  <p style={styles.empty}>None</p>
                ) : (
                  report.statusMix.map((row) => (
                    <p key={row.name} style={styles.mixRow}>
                      <strong>{labelOf(row.name)}</strong>
                      <span>{row.count}</span>
                    </p>
                  ))
                )}
              </Card>
              <Card style={styles.tableCard}>
                <h2 style={styles.h2}>Cancel reasons</h2>
                {report.cancelReasons.length === 0 ? (
                  <p style={styles.empty}>None</p>
                ) : (
                  report.cancelReasons.map((row) => (
                    <p key={row.name} style={styles.mixRow}>
                      <strong>{labelOf(row.name)}</strong>
                      <span>{row.count}</span>
                    </p>
                  ))
                )}
                <p style={styles.hint}>Bag reject rate {report.rejectRate}%</p>
              </Card>
            </div>
          ) : null}

          {tab === 'gst' ? (
            ops ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Taxable" value={money(ops.gstTaxable)} hint="Delivered lines" />
                  <KpiCard label="CGST" value={money(ops.gstCgst)} hint="Item snapshots" />
                  <KpiCard label="SGST" value={money(ops.gstSgst)} hint="Item snapshots" />
                  <KpiCard label="IGST" value={money(ops.gstIgst)} hint="Inter-state" />
                  <KpiCard label="Cess" value={money(ops.gstCess)} hint="Item snapshots" />
                  <KpiCard label="Total GST" value={money(ops.gstTotal)} hint="For GSTR working" />
                </div>
                <Card style={styles.tableCard}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>HSN</th>
                        <th style={styles.th}>GST%</th>
                        <th style={styles.th}>Lines</th>
                        <th style={styles.th}>Taxable</th>
                        <th style={styles.th}>CGST</th>
                        <th style={styles.th}>SGST</th>
                        <th style={styles.th}>IGST</th>
                        <th style={styles.th}>Cess</th>
                        <th style={styles.th}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.gstByHsn.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={styles.empty}>
                            No delivered taxable lines in this range.
                          </td>
                        </tr>
                      ) : (
                        ops.gstByHsn.map((row) => (
                          <tr key={`${row.hsn}-${row.gstPercent}`}>
                            <td style={styles.td}>{row.hsn}</td>
                            <td style={styles.td}>{row.gstPercent}</td>
                            <td style={styles.td}>{row.lines}</td>
                            <td style={styles.td}>{money(row.taxable)}</td>
                            <td style={styles.td}>{money(row.cgst)}</td>
                            <td style={styles.td}>{money(row.sgst)}</td>
                            <td style={styles.td}>{money(row.igst)}</td>
                            <td style={styles.td}>{money(row.cess)}</td>
                            <td style={styles.td}>{money(row.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Card>
              </>
            ) : (
              <p style={styles.muted}>GST report did not load.</p>
            )
          ) : null}

          {tab === 'claims' ? (
            ops ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Opened" value={String(ops.claimsOpened)} hint="Filed in range" />
                  <KpiCard label="Still open" value={String(ops.claimsOpen)} hint="Need hub action" />
                  <KpiCard label="Resolved" value={String(ops.claimsResolved)} hint={money(ops.claimsCredited)} />
                  <KpiCard label="Rejected" value={String(ops.claimsRejected)} hint="No credit" />
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>By type</h2>
                    {ops.claimsByType.length === 0 ? (
                      <p style={styles.empty}>None</p>
                    ) : (
                      ops.claimsByType.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{labelOf(row.name)}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>By town</h2>
                    {ops.claimsByTown.length === 0 ? (
                      <p style={styles.empty}>None</p>
                    ) : (
                      ops.claimsByTown.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{row.name}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <p style={styles.muted}>Claims report did not load.</p>
            )
          ) : null}

          {tab === 'sla' ? (
            ops ? (
              <div style={styles.kpis}>
                <KpiCard label="On time" value={String(ops.deliveredOnTime)} hint="≤ 90 min place → door" />
                <KpiCard label="Late" value={String(ops.deliveredLate)} hint={`${ops.lateDeliveryRate ?? 0}% of delivered`} />
                <KpiCard
                  label="Avg cycle"
                  value={ops.avgDeliveryMinutes == null ? '—' : `${ops.avgDeliveryMinutes}m`}
                  hint="Delivered orders"
                />
                <KpiCard label="Still open" value={String(ops.stillOpen)} hint="Placed, not delivered" />
                <KpiCard label="Open >24h" value={String(ops.openOverdue)} hint="Stuck bags" />
                <KpiCard label="Cancelled" value={String(ops.cancelled)} hint="In this range" />
              </div>
            ) : (
              <p style={styles.muted}>SLA report did not load.</p>
            )
          ) : null}

          {tab === 'money' ? (
            moneyPack ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Unpaid payouts" value={String(moneyPack.unpaidPayouts)} hint={money(moneyPack.unpaidPayoutAmount)} />
                  <KpiCard label="Wallet liability" value={money(moneyPack.walletLiability)} hint={`${moneyPack.walletsWithBalance} wallets`} />
                  <KpiCard
                    label="Credits issued"
                    value={money(moneyPack.walletCreditsInRange)}
                    hint={`${moneyPack.walletCreditCount} txns`}
                  />
                  <KpiCard
                    label="Credits used"
                    value={money(moneyPack.walletDebitsInRange)}
                    hint={`${moneyPack.walletDebitCount} txns`}
                  />
                  <KpiCard label="Scratch gifts" value={money(moneyPack.walletScratch)} hint="Wallet CREDIT" />
                  <KpiCard label="Referral gifts" value={money(moneyPack.walletReferral)} hint="Both sides" />
                  <KpiCard label="Store credit" value={money(moneyPack.walletStoreCredit)} hint="Item cancel" />
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Payout aging</h2>
                    {moneyPack.aging.map((row) => (
                      <p key={row.label} style={styles.mixRow}>
                        <strong>{row.label}</strong>
                        <span>
                          {row.count} · {money(row.amount)}
                        </span>
                      </p>
                    ))}
                    {(moneyPack.walletCreditsByReason ?? []).length > 0 ? (
                      <>
                        <h2 style={{ ...styles.h2, marginTop: '0.55rem' }}>Wallet gifts by reason</h2>
                        {moneyPack.walletCreditsByReason!.map((row) => (
                          <p key={row.name} style={styles.mixRow}>
                            <strong>{labelOf(row.name)}</strong>
                            <span>
                              {row.count} · {money(row.amount)}
                            </span>
                          </p>
                        ))}
                      </>
                    ) : null}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Oldest unpaid</h2>
                    {moneyPack.oldestUnpaid.length === 0 ? (
                      <p style={styles.empty}>All payouts marked paid.</p>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Payee</th>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Age</th>
                            <th style={styles.th}>Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moneyPack.oldestUnpaid.map((row) => (
                            <tr key={row.settlementId}>
                              <td style={styles.td}>{displayPayeeLabel(row.payeeName, null, row.payeeType)}</td>
                              <td style={styles.td}>{row.payeeType}</td>
                              <td style={styles.td}>{row.ageDays}d</td>
                              <td style={styles.td}>{money(row.netAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <p style={styles.muted}>Money report did not load.</p>
            )
          ) : null}

          {tab === 'growth' ? (
            ads ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Ads billed" value={money(ads.billed)} hint={`${ads.invoiceCount} invoices`} />
                  <KpiCard label="Ads collected" value={money(ads.collected)} hint={`${ads.paidCount} paid`} />
                  <KpiCard label="Ads due" value={money(ads.outstanding)} hint={`${ads.issuedCount} issued`} />
                  <KpiCard label="Ad GST" value={money(ads.taxCollected)} hint="On live invoices" />
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Ads by slot</h2>
                    {ads.bySlot.length === 0 ? (
                      <p style={styles.empty}>None in this range.</p>
                    ) : (
                      ads.bySlot.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{labelOf(row.name)}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Ad invoice status</h2>
                    {ads.byStatus.length === 0 ? (
                      <p style={styles.empty}>None</p>
                    ) : (
                      ads.byStatus.map((row) => (
                        <p key={row.name} style={styles.mixRow}>
                          <strong>{labelOf(row.name)}</strong>
                          <span>
                            {row.count} · {money(row.amount)}
                          </span>
                        </p>
                      ))
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <p style={styles.muted}>Ad revenue did not load.</p>
            )
          ) : null}

          {tab === 'scratch' ? (
            scratch ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Gifted" value={money(scratch.giftedAmount)} hint="Wallet after scratch" />
                  <KpiCard label="Scratched" value={String(scratch.scratched)} hint={`Avg ${money(scratch.avgGift ?? 0)}`} />
                  <KpiCard label="Issued" value={String(scratch.issued)} hint="Cards in range" />
                  <KpiCard label="Unopened" value={String(scratch.unopened)} hint="Still waiting" />
                  <KpiCard
                    label="Pending"
                    value={`${money(scratch.pendingMin ?? 0)}–${money(scratch.pendingMax ?? 0)}`}
                    hint="Unopened band"
                  />
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>By town</h2>
                    {(scratch.towns ?? []).length === 0 ? (
                      <p style={styles.empty}>None in this range.</p>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Town</th>
                            <th style={styles.th}>Issued</th>
                            <th style={styles.th}>Scratched</th>
                            <th style={styles.th}>Gifted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scratch.towns.map((row) => (
                            <tr key={row.townId}>
                              <td style={styles.td}>{row.townName ?? row.townId.slice(0, 8)}</td>
                              <td style={styles.td}>{row.issued}</td>
                              <td style={styles.td}>{row.scratched}</td>
                              <td style={styles.td}>{money(row.giftedAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>Cards</h2>
                    {(scratch.lines ?? []).length === 0 ? (
                      <p style={styles.empty}>No cards in this range.</p>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Issued</th>
                            <th style={styles.th}>Buyer</th>
                            <th style={styles.th}>Order</th>
                            <th style={styles.th}>Status</th>
                            <th style={styles.th}>Gifted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(scratch.lines ?? []).slice(0, 80).map((row) => (
                            <tr key={row.cardId}>
                              <td style={styles.td}>{row.issuedAt}</td>
                              <td style={styles.td}>{row.buyerPhone || '—'}</td>
                              <td style={styles.td}>{row.orderNumber || '—'}</td>
                              <td style={styles.td}>{row.status === 'REVEALED' ? 'Scratched' : 'Unopened'}</td>
                              <td style={styles.td}>
                                {row.status === 'REVEALED' ? money(row.companySpent) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </div>
              </>
            ) : (
              <p style={styles.muted}>Scratch report did not load.</p>
            )
          ) : null}

          {tab === 'referrals' ? (
            referrals ? (
              <>
                <div style={styles.kpis}>
                  <KpiCard label="Company spent" value={money(referrals.companySpent)} hint={`${referrals.amountsFromWallet ? 'Wallet credits' : 'At current rates'}`} />
                  <KpiCard label="Pending burn" value={money(referrals.companyPending)} hint={`${referrals.pendingReferee + referrals.pendingReferrer} unpaid legs`} />
                  <KpiCard label="If all close" value={money(referrals.companyIfAllPaid)} hint="Spent + pending" />
                  <KpiCard label="Paid referrers" value={money(referrals.spentOnReferrers)} hint={`${referrals.referrerRewarded} first deliveries`} />
                  <KpiCard label="Paid referees" value={money(referrals.spentOnReferees)} hint={`${referrals.refereeRewarded} welcome credits`} />
                  <KpiCard label="Signups" value={String(referrals.signups)} hint={`${referrals.uniqueReferrers} candidates`} />
                  <KpiCard
                    label="Rates"
                    value={`${money(referrals.referrerRewardAmount)} / ${money(referrals.refereeRewardAmount)}`}
                    hint="Referrer / referee"
                  />
                </div>
                <div style={styles.filters}>
                  <label style={styles.field}>
                    Find candidate
                    <input
                      value={referralQ}
                      onChange={(e) => {
                        setReferralQ(e.target.value);
                        setReferralUserId('');
                      }}
                      placeholder="Phone, name or code"
                      style={styles.input}
                    />
                  </label>
                </div>
                <div style={styles.split}>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>
                      By candidate
                      {referralUserId ? (
                        <button type="button" style={styles.linkBtn} onClick={() => setReferralUserId('')}>
                          Show all
                        </button>
                      ) : null}
                    </h2>
                    {referralView.candidates.length === 0 ? (
                      <p style={styles.empty}>No referrals in this range.</p>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Candidate</th>
                            <th style={styles.th}>Code</th>
                            <th style={styles.th}>Referred</th>
                            <th style={styles.th}>Converted</th>
                            <th style={styles.th}>Earned</th>
                            <th style={styles.th}>Company</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referralView.candidates.map((row) => (
                            <tr
                              key={row.userId}
                              onClick={() => setReferralUserId(row.userId)}
                              style={
                                referralView.selected === row.userId
                                  ? { ...styles.rowOn, cursor: 'pointer' }
                                  : { cursor: 'pointer' }
                              }
                            >
                              <td style={styles.td}>
                                {row.name}
                                {row.phone && row.phone !== row.name ? ` · ${row.phone}` : ''}
                              </td>
                              <td style={styles.td}>{row.code}</td>
                              <td style={styles.td}>{row.referred}</td>
                              <td style={styles.td}>{row.converted}</td>
                              <td style={styles.td}>{money(row.earned)}</td>
                              <td style={styles.td}>{money(row.companySpent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                  <Card style={styles.tableCard}>
                    <h2 style={styles.h2}>
                      {referralView.selected
                        ? `Friends of ${referralView.candidates.find((c) => c.userId === referralView.selected)?.name ?? 'candidate'}`
                        : 'Referral lines'}
                    </h2>
                    {referralView.lines.length === 0 ? (
                      <p style={styles.empty}>No lines for this filter.</p>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Friend</th>
                            <th style={styles.th}>Welcome</th>
                            <th style={styles.th}>Referrer</th>
                            <th style={styles.th}>Burn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referralView.lines.map((row) => (
                            <tr key={row.attributionId}>
                              <td style={styles.td}>{row.createdAt}</td>
                              <td style={styles.td}>
                                {row.refereeName}
                                {row.refereePhone ? ` · ${row.refereePhone}` : ''}
                              </td>
                              <td style={styles.td}>
                                {row.refereePaid ? money(row.refereeAmount) : 'Due'}
                              </td>
                              <td style={styles.td}>
                                {row.referrerPaid ? money(row.referrerAmount) : 'Await 1st delivery'}
                              </td>
                              <td style={styles.td}>{money(row.companySpent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </div>
                <p style={styles.hint}>
                  Company pays both sides: welcome credit on code apply, referrer on the friend’s first delivery.
                  CSV includes every candidate and every line in the date range.
                </p>
              </>
            ) : (
              <p style={styles.muted}>Referral report did not load.</p>
            )
          ) : null}
        </>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'end',
    gap: '0.45rem',
  },
  field: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    minHeight: 34,
    minWidth: 120,
  },
  presets: { display: 'flex', gap: '0.28rem', flexWrap: 'wrap' },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    padding: '0.28rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: 999,
    padding: '0.28rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  range: { margin: '0.2rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    padding: '0.2rem',
    background: 'var(--bg-muted)',
    borderRadius: 999,
    width: 'fit-content',
    maxWidth: '100%',
  },
  tab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.78rem',
    padding: '0.35rem 0.7rem',
    borderRadius: 999,
    cursor: 'pointer',
  },
  tabActive: {
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.35rem 0.7rem',
    borderRadius: 999,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-soft)',
  },
  muted: { margin: 0, color: 'var(--text-muted)' },
  gmvIntro: { margin: '0 0 0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 640 },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.4rem',
  },
  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.55rem' },
  tableCard: { padding: '0.55rem', overflowX: 'auto' },
  h2: { margin: '0 0 0.35rem', fontSize: '0.92rem', fontWeight: 800 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', padding: '0.25rem 0.3rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.28rem 0.3rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  empty: { padding: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' },
  mixRow: { margin: '0.2rem 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' },
  hint: { margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' },
  rowOn: { background: 'var(--accent-soft)' },
  linkBtn: {
    marginLeft: '0.5rem',
    border: 'none',
    background: 'none',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
};
