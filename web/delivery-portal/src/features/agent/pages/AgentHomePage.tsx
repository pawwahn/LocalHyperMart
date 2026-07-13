import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';

export function AgentHomePage() {
  const { workSummary, stats, loading, error, notice, reload } = useAgentWorkspace({ scope: 'active' });

  const pickupCount = workSummary.pickupAtShop + workSummary.pickupToHub;
  const deliveryCount = workSummary.deliveryAtHub + workSummary.deliveryEnRoute;

  return (
    <AgentShell title="Your jobs" subtitle="Tap one big button" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      {loading && workSummary.totalActive === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : (
        <section style={styles.grid}>
          <Link to="/agent/pickups" style={{ ...styles.job, ...styles.jobShop }}>
            <span style={styles.jobIcon} aria-hidden>
              🛍️
            </span>
            <h2 style={styles.jobTitle}>Go to shop</h2>
            <p style={styles.jobText}>Take bag from shop → bring to hub</p>
            <span style={pickupCount > 0 ? styles.countHot : styles.countIdle}>
              {pickupCount > 0 ? `${pickupCount} job${pickupCount === 1 ? '' : 's'}` : 'No job'}
            </span>
            <span style={styles.tap}>TAP HERE</span>
          </Link>

          <Link to="/agent/deliveries" style={{ ...styles.job, ...styles.jobHome }}>
            <span style={styles.jobIcon} aria-hidden>
              🛵
            </span>
            <h2 style={styles.jobTitle}>Go to customer</h2>
            <p style={styles.jobText}>Take order from hub → give to customer</p>
            <span style={deliveryCount > 0 ? styles.countHot : styles.countIdle}>
              {deliveryCount > 0 ? `${deliveryCount} job${deliveryCount === 1 ? '' : 's'}` : 'No job'}
            </span>
            <span style={styles.tap}>TAP HERE</span>
          </Link>
        </section>
      )}

      {stats ? (
        <section style={styles.stats}>
          <Stat icon="🛍️" label="Bags from shop today" value={String(stats.vendorPickupsCollectedToday)} />
          <Stat icon="🏢" label="Bags at hub today" value={String(stats.vendorPickupsAtHubToday)} />
          <Stat icon="✅" label="Home deliveries today" value={String(stats.buyerDeliveriesCompletedToday)} />
        </section>
      ) : null}

      <p style={styles.muted}>
        {workSummary.totalActive === 0 && !loading
          ? 'No job now. Wait for hub uncle to give you work.'
          : `${workSummary.totalActive} job(s) open for you.`}
      </p>
    </AgentShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <p style={styles.statIcon} aria-hidden>
        {icon}
      </p>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  job: {
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: 18,
    padding: '1.35rem 1.25rem',
    display: 'grid',
    gap: '0.45rem',
    justifyItems: 'start',
    border: '3px solid',
    minHeight: 220,
  },
  jobShop: {
    background: 'rgba(129, 199, 132, 0.12)',
    borderColor: 'rgba(76, 175, 80, 0.65)',
  },
  jobHome: {
    background: 'rgba(66, 165, 245, 0.12)',
    borderColor: 'rgba(66, 165, 245, 0.65)',
  },
  jobIcon: { fontSize: '2.6rem', lineHeight: 1 },
  jobTitle: {
    margin: 0,
    fontSize: '1.65rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
  },
  jobText: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.35 },
  countHot: {
    marginTop: '0.35rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 999,
    background: '#ef6c00',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1rem',
  },
  countIdle: {
    marginTop: '0.35rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  tap: {
    marginTop: 'auto',
    fontWeight: 900,
    fontSize: '1.05rem',
    letterSpacing: '0.04em',
    color: 'var(--text)',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.85rem',
    textAlign: 'center',
  },
  statIcon: { margin: 0, fontSize: '1.4rem' },
  statLabel: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 },
  statValue: { margin: '0.15rem 0 0', fontWeight: 800, fontSize: '1.55rem', fontFamily: 'var(--font-display)' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  notice: { margin: 0, color: 'var(--success)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 },
};
