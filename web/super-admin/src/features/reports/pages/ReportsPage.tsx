import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { fetchPlatformReport, type PlatformReport } from '../api/platformReportsApi';
import { fetchMembershipReport, type MembershipReport } from '@/features/memberships/api/membershipsApi';

type Preset = 'today' | 'week' | 'month' | 'custom';

function isoIst(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function rangeFor(preset: Preset): { from: string; to: string } {
  const to = isoIst();
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: isoIst(from), to };
  }
  const [y, m] = to.split('-');
  return { from: `${y}-${m}-01`, to };
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
  const initial = rangeFor('week');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<Preset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [membership, setMembership] = useState<MembershipReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === 'custom') return;
    const r = rangeFor(next);
    setFrom(r.from);
    setTo(r.to);
  };

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [townList, data, memberReport] = await Promise.all([
        listTowns(token),
        fetchPlatformReport(token, {
          townId: townId || undefined,
          from,
          to,
        }),
        fetchMembershipReport(token, { from, to }),
      ]);
      setTowns(townList);
      setReport(data);
      setMembership(memberReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load reports');
    } finally {
      setLoading(false);
    }
  }, [token, townId, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const townLabel = useMemo(() => {
    if (!townId) return 'All towns';
    return towns.find((t) => t.id === townId)?.displayName ?? 'Town';
  }, [townId, towns]);

  function downloadCsv() {
    if (!report) return;
    const lines = [
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
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hlm-platform-report-${report.from}-${report.to}.csv`;
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
          {(['today', 'week', 'month', 'custom'] as Preset[]).map((id) => (
            <button
              key={id}
              type="button"
              style={preset === id ? styles.chipOn : styles.chip}
              onClick={() => applyPreset(id)}
            >
              {id === 'today' ? 'Today' : id === 'week' ? '7 days' : id === 'month' ? 'Month' : 'Custom'}
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
        <Button size="sm" variant="secondary" onClick={downloadCsv} disabled={!report}>
          CSV
        </Button>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading && !report ? <p style={styles.muted}>Loading Swiggy-style ops report…</p> : null}

      {report ? (
        <>
          <p style={styles.range}>
            {report.from} → {report.to} · {townLabel}
          </p>
          <div style={styles.kpis}>
            <Kpi label="GMV placed" value={money(report.placedGmv)} hint="All orders in range" />
            <Kpi label="GMV delivered" value={money(report.deliveredGmv)} hint="Reached buyer" />
            <Kpi label="AOV" value={money(report.averageOrderValue)} hint="Average order value" />
            <Kpi label="Orders" value={String(report.ordersPlaced)} hint={`${report.uniqueBuyers} buyers`} />
            <Kpi label="Delivered" value={String(report.ordersDelivered)} hint={`${report.deliveryRate}%`} />
            <Kpi label="Cancelled" value={String(report.ordersCancelled)} hint={`${report.cancelRate}%`} />
            <Kpi label="COD collected" value={money(report.codGmv)} hint="Delivered COD" />
            <Kpi label="Online GMV" value={money(report.onlineGmv)} hint="UPI/card delivered" />
            <Kpi label="Platform fees" value={money(report.platformFees)} hint="Buyer fee" />
            <Kpi label="Promo given" value={money(report.promoDiscounts)} hint="Discounts" />
            <Kpi
              label="Vendor ready"
              value={report.avgReadyMinutes == null ? '—' : `${report.avgReadyMinutes}m`}
              hint="Avg place → packed"
            />
            <Kpi
              label="Delivery cycle"
              value={report.avgDeliveryMinutes == null ? '—' : `${report.avgDeliveryMinutes}m`}
              hint="Avg place → delivered"
            />
            <Kpi
              label="Member deliveries"
              value={String(report.membershipDeliveriesWaived ?? 0)}
              hint="Orders that used a credit"
            />
            <Kpi
              label="Delivery waived"
              value={money(report.membershipFeeWaived)}
              hint="Fee not collected"
            />
          </div>
          {membership ? (
            <>
              <h2 style={styles.h2}>Membership</h2>
              <div style={styles.kpis}>
                <Kpi label="Active members" value={String(membership.activeMembers)} hint="Usable now" />
                <Kpi label="Packs sold" value={String(membership.packsSold)} hint={money(membership.paidRevenue)} />
                <Kpi label="Gifts" value={String(membership.gifts)} hint="Admin granted" />
                <Kpi label="Credits granted" value={String(membership.creditsGranted)} hint="In this range" />
                <Kpi label="Credits used" value={String(membership.deliveriesWaived)} hint={money(membership.deliveryFeeWaived)} />
                <Kpi label="Credits restored" value={String(membership.creditsRestored)} hint="We cancelled / failed" />
                <Kpi label="Credits left" value={String(membership.usableCreditsOutstanding)} hint="Outstanding" />
                <Kpi label="Expiring 7d" value={String(membership.expiringIn7Days)} hint="Need renew" />
              </div>
            </>
          ) : null}

          <div style={styles.split}>
            <Card style={styles.tableCard}>
              <h2 style={styles.h2}>Towns</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Town</th>
                    <th style={styles.th}>Orders</th>
                    <th style={styles.th}>Deliv.</th>
                    <th style={styles.th}>Canx</th>
                    <th style={styles.th}>GMV</th>
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
            <Card style={styles.tableCard}>
              <h2 style={styles.h2}>Vendors</h2>
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
          </div>

          <Card style={styles.tableCard}>
            <h2 style={styles.h2}>Daily (Instamart-style trend)</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Orders</th>
                  <th style={styles.th}>Delivered</th>
                  <th style={styles.th}>Cancelled</th>
                  <th style={styles.th}>GMV</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((row) => (
                  <tr key={row.date}>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>{row.orders}</td>
                    <td style={styles.td}>{row.delivered}</td>
                    <td style={styles.td}>{row.cancelled}</td>
                    <td style={styles.td}>{money(row.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div style={styles.split}>
            <Card style={styles.tableCard}>
              <h2 style={styles.h2}>Payment mix</h2>
              {report.paymentMix.map((row) => (
                <p key={row.name} style={styles.mixRow}>
                  <strong>{row.name}</strong>
                  <span>
                    {row.count} · {money(row.amount)}
                  </span>
                </p>
              ))}
            </Card>
            <Card style={styles.tableCard}>
              <h2 style={styles.h2}>Cancel reasons</h2>
              {report.cancelReasons.length === 0 ? (
                <p style={styles.empty}>None</p>
              ) : (
                report.cancelReasons.map((row) => (
                  <p key={row.name} style={styles.mixRow}>
                    <strong>{row.name}</strong>
                    <span>{row.count}</span>
                  </p>
                ))
              )}
              <p style={styles.hint}>Bag reject rate {report.rejectRate}%</p>
            </Card>
          </div>
        </>
      ) : null}
    </PortalShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
      <span style={styles.kpiHint}>{hint}</span>
    </div>
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
  muted: { margin: 0, color: 'var(--text-muted)' },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.4rem',
  },
  kpi: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    display: 'grid',
    gap: '0.05rem',
  },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', letterSpacing: '-0.03em' },
  kpiHint: { fontSize: '0.65rem', color: 'var(--text-muted)' },
  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.55rem' },
  tableCard: { padding: '0.55rem', overflowX: 'auto' },
  h2: { margin: '0 0 0.35rem', fontSize: '0.92rem', fontWeight: 800 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', padding: '0.25rem 0.3rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.28rem 0.3rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  empty: { padding: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' },
  mixRow: { margin: '0.2rem 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' },
  hint: { margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' },
};
