import { Link } from 'react-router-dom';
import { useEffect, useState, type CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { useAuth } from '@/shared/auth/AuthContext';
import { fetchMyPay, type AgentPaySummary, type AgentPeriodStats } from '../api/agentApi';

type RangeKey = 'today' | 'week' | 'month' | 'all';

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(0)}`;
}

export function AgentHomePage() {
  const { session } = useAuth();
  const { workSummary, stats, loading, error, notice, reload } = useAgentWorkspace({ scope: 'active' });
  const [range, setRange] = useState<RangeKey>('today');
  const [pay, setPay] = useState<AgentPaySummary | null>(null);

  const pickupCount = workSummary.pickupAtShop + workSummary.pickupToHub;
  const deliveryCount = workSummary.deliveryAtHub + workSummary.deliveryEnRoute;

  useEffect(() => {
    if (!session) return;
    void fetchMyPay(session.accessToken)
      .then(setPay)
      .catch(() => setPay(null));
  }, [session]);

  const period: AgentPeriodStats =
    !stats
      ? { shopPicked: 0, droppedAtHub: 0, homeDelivered: 0, returnsToHub: 0, cancelledPickups: 0 }
      : range === 'today'
        ? stats.today
        : range === 'week'
          ? stats.week
          : range === 'month'
            ? stats.month
            : stats.allTime;

  const vendorShop = stats?.agentType === 'VENDOR';
  const vendorOpenAtShop = workSummary.deliveryAtHub;
  const vendorEnRoute = workSummary.deliveryEnRoute;
  const vendorOpen = vendorOpenAtShop + vendorEnRoute;

  return (
    <AgentShell title="Your jobs" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <p style={styles.summaryLine}>
        {loading && workSummary.totalActive === 0
          ? 'Checking jobs…'
          : workSummary.totalActive > 0
            ? `${workSummary.totalActive} open · tap a row`
            : vendorShop
              ? 'No open jobs · your shop will assign deliveries'
              : 'No open jobs · waiting for hub'}
      </p>

      {stats ? (
        <section style={styles.board} aria-label="Your work">
          <div style={styles.range} role="tablist" aria-label="Work period">
            {(['today', 'week', 'month', 'all'] as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={range === key}
                style={range === key ? styles.rangeOn : styles.rangeOff}
                onClick={() => setRange(key)}
              >
                {key === 'today' ? 'Today' : key === 'week' ? 'Week' : key === 'month' ? 'Month' : 'All'}
              </button>
            ))}
          </div>
          <div style={{ ...styles.metrics, ...(vendorShop ? styles.metricsVendor : null) }}>
            {vendorShop ? (
              <>
                <Metric label="From shop" value={period.shopPicked} hint="bag taken" />
                <Metric label="Delivered" value={period.homeDelivered} hint="to customer" />
                <Metric label="Returns" value={period.returnsToHub} hint="buyer refused" />
              </>
            ) : (
              <>
                <Metric label="Picked" value={period.shopPicked} hint="from shop" />
                <Metric label="At hub" value={period.droppedAtHub} hint="drop-off" />
                <Metric label="Delivered" value={period.homeDelivered} hint="to home" />
                <Metric label="Returns" value={period.returnsToHub} hint="buyer refused" />
              </>
            )}
          </div>
          {period.cancelledPickups > 0 ? (
            <p style={styles.note}>{period.cancelledPickups} shop pickup{period.cancelledPickups === 1 ? '' : 's'} cancelled</p>
          ) : null}
        </section>
      ) : null}

      <Link to="/agent/cod-handover" style={styles.codStrip}>
        <div>
          <p style={styles.payTitle}>Hand over COD cash</p>
          <p style={styles.payMeta}>Declare cash given to hub or shop · IST day</p>
        </div>
        <span style={styles.chevron} aria-hidden>
          ›
        </span>
      </Link>

      <Link to="/agent/pay" style={styles.payStrip}>
        <div>
          <p style={styles.payTitle}>Your pay this month</p>
          <p style={styles.payMeta}>
            {pay
              ? `${money(pay.earned)} earned · ${money(pay.paid)} paid · ${money(pay.due)} due`
              : 'Open for rates, unpaid orders, payouts'}
          </p>
        </div>
        <span style={styles.chevron} aria-hidden>
          ›
        </span>
      </Link>

      {loading && workSummary.totalActive === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : (
        <section style={styles.list} aria-label="Job types">
          {vendorShop ? null : (
            <JobRow
              to="/agent/pickups"
              tone="shop"
              icon="🛍️"
              title="From shop"
              flow="Shop → bag → hub"
              detail={
                pickupCount > 0
                  ? `${workSummary.pickupAtShop} at shop · ${workSummary.pickupToHub} to hub`
                  : 'No pickups open'
              }
              count={pickupCount}
            />
          )}
          <JobRow
            to="/agent/deliveries"
            tone="home"
            icon="🛵"
            title={vendorShop ? 'Shop deliveries' : 'To home'}
            flow={
              vendorShop
                ? 'Shop → customer · OTP · Submit'
                : 'Take FULL order from hub → Give to customer → OTP → Submit'
            }
            detail={
              vendorShop
                ? vendorOpen > 0
                  ? `${vendorOpenAtShop} at shop · ${vendorEnRoute} on way`
                  : 'No deliveries open'
                : deliveryCount > 0
                  ? `${workSummary.deliveryAtHub} at hub · ${workSummary.deliveryEnRoute} on way`
                  : 'No deliveries open'
            }
            count={vendorShop ? vendorOpen : deliveryCount}
          />
        </section>
      )}
    </AgentShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricVal}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricHint}>{hint}</span>
    </div>
  );
}

function JobRow({
  to,
  tone,
  icon,
  title,
  flow,
  detail,
  count,
}: {
  to: string;
  tone: 'shop' | 'home';
  icon: string;
  title: string;
  flow: string;
  detail: string;
  count: number;
}) {
  const hot = count > 0;
  const shop = tone === 'shop';

  return (
    <Link
      to={to}
      style={{
        ...styles.row,
        ...(shop ? styles.rowShop : styles.rowHome),
        ...(hot ? (shop ? styles.rowShopHot : styles.rowHomeHot) : null),
      }}
    >
      <span style={{ ...styles.icon, ...(shop ? styles.iconShop : styles.iconHome) }} aria-hidden>
        {icon}
      </span>

      <div style={styles.body}>
        <div style={styles.titleRow}>
          <h2 style={styles.title}>{title}</h2>
          <span
            style={{
              ...styles.badge,
              ...(hot ? (shop ? styles.badgeShop : styles.badgeHome) : styles.badgeIdle),
            }}
          >
            {count}
          </span>
        </div>
        <p style={styles.flow}>{flow}</p>
        <p style={styles.detail}>{detail}</p>
      </div>

      <span style={styles.chevron} aria-hidden>
        ›
      </span>
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  summaryLine: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 650,
    color: 'var(--text)',
    lineHeight: 1.35,
    opacity: 0.78,
  },
  board: {
    display: 'grid',
    gap: '0.4rem',
    padding: '0.5rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  range: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 3,
    padding: 3,
    borderRadius: 9,
    background: 'var(--bg)',
  },
  rangeOff: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.75rem',
    minHeight: 36,
    borderRadius: 7,
    cursor: 'pointer',
  },
  rangeOn: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.75rem',
    minHeight: 36,
    borderRadius: 7,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.35rem',
  },
  metricsVendor: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  metric: {
    display: 'grid',
    justifyItems: 'center',
    gap: 1,
    padding: '0.3rem 0.15rem',
    borderRadius: 8,
    background: 'var(--bg)',
  },
  metricVal: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.15rem',
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  metricLabel: { fontSize: '0.7rem', fontWeight: 800 },
  metricHint: { fontSize: '0.62rem', fontWeight: 650, color: 'var(--text-muted)', textAlign: 'center' },
  note: { margin: 0, fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' },
  codStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    textDecoration: 'none',
    color: 'var(--text)',
    padding: '0.55rem 0.65rem',
    borderRadius: 12,
    border: '1px solid #fbbf24',
    background: 'var(--warning-soft, #fffbeb)',
  },
  payStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    textDecoration: 'none',
    color: 'var(--text)',
    padding: '0.55rem 0.65rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--warning) 10%, var(--bg-elevated))',
  },
  payTitle: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  payMeta: { margin: '0.12rem 0 0', fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' },
  list: {
    display: 'grid',
    gap: '0.5rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr) 18px',
    alignItems: 'start',
    columnGap: '0.55rem',
    textDecoration: 'none',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '0.65rem 0.55rem 0.65rem 0.55rem',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  rowShop: {
    background: 'color-mix(in srgb, var(--success) 8%, var(--bg-elevated))',
  },
  rowHome: {
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))',
  },
  rowShopHot: {
    borderColor: 'color-mix(in srgb, var(--success) 45%, var(--border))',
  },
  rowHomeHot: {
    borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    lineHeight: 1,
    marginTop: 1,
  },
  iconShop: {
    background: 'color-mix(in srgb, var(--success) 22%, var(--bg-elevated))',
  },
  iconHome: {
    background: 'color-mix(in srgb, var(--accent) 22%, var(--bg-elevated))',
  },
  body: {
    minWidth: 0,
    display: 'grid',
    gap: '0.2rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: 'var(--text)',
  },
  flow: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1.35,
    opacity: 0.88,
  },
  detail: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 750,
    color: 'var(--text)',
    lineHeight: 1.3,
    opacity: 0.72,
  },
  badge: {
    flexShrink: 0,
    minWidth: 28,
    height: 28,
    padding: '0 0.45rem',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.82rem',
  },
  badgeShop: {
    background: 'var(--success)',
    color: '#fff',
  },
  badgeHome: {
    background: 'var(--accent)',
    color: '#fff',
  },
  badgeIdle: {
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    opacity: 0.9,
  },
  chevron: {
    fontSize: '1.2rem',
    fontWeight: 400,
    color: 'var(--text)',
    lineHeight: 1,
    marginTop: 8,
    opacity: 0.55,
  },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' },
  notice: { margin: 0, color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' },
  muted: { margin: 0, color: 'var(--text)', fontSize: '0.85rem', fontWeight: 650, opacity: 0.75 },
};
