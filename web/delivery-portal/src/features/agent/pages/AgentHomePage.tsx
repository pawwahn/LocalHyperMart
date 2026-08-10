import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';

export function AgentHomePage() {
  const { workSummary, stats, loading, error, notice, reload } = useAgentWorkspace({ scope: 'active' });

  const pickupCount = workSummary.pickupAtShop + workSummary.pickupToHub;
  const deliveryCount = workSummary.deliveryAtHub + workSummary.deliveryEnRoute;

  return (
    <AgentShell title="Your jobs" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <p style={styles.summaryLine}>
        {loading && workSummary.totalActive === 0
          ? 'Checking jobs…'
          : workSummary.totalActive > 0
            ? `${workSummary.totalActive} open · tap a row`
            : 'No open jobs · waiting for hub'}
        {stats
          ? ` · today ${stats.buyerDeliveriesCompletedToday} delivered · ${stats.vendorPickupsCollectedToday} pickups`
          : ''}
      </p>

      {loading && workSummary.totalActive === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : (
        <section style={styles.list} aria-label="Job types">
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
          <JobRow
            to="/agent/deliveries"
            tone="home"
            icon="🛵"
            title="To home"
            flow="Take FULL order from hub → Give to customer → OTP → Submit"
            detail={
              deliveryCount > 0
                ? `${workSummary.deliveryAtHub} at hub · ${workSummary.deliveryEnRoute} on way`
                : 'No deliveries open'
            }
            count={deliveryCount}
          />
        </section>
      )}
    </AgentShell>
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
