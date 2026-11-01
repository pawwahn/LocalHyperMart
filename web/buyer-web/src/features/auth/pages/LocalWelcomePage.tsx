import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTown } from '@/shared/town/TownContext';
import { Button } from '@/shared/ui';

export function LocalWelcomePage() {
  const navigate = useNavigate();
  const { townLabel } = useTown();
  const localTown = townLabel === 'Choose your town' ? 'your town' : townLabel;

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.art} aria-hidden>
          <span style={styles.sun} />
          <span style={styles.shop}>KK</span>
        </div>

        <p style={styles.eyebrow}>Welcome to KoyaKart</p>
        <h1 style={styles.title}>Shop local. Keep {localTown} thriving.</h1>
        <p style={styles.copy}>
          Every order supports neighbourhood shopkeepers, local jobs, and families in your community.
        </p>

        <ul style={styles.impact}>
          <li style={styles.impactItem}>Local shops</li>
          <li style={styles.impactItem}>Town delivery</li>
          <li style={styles.impactItem}>Community growth</li>
        </ul>

        <Button size="lg" fullWidth onClick={() => navigate('/shop', { replace: true })}>
          Support local & shop now
        </Button>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background:
      'radial-gradient(circle at 50% 12%, color-mix(in srgb, var(--highlight) 45%, transparent), transparent 32%), var(--bg)',
  },
  card: {
    width: 'min(440px, 100%)',
    display: 'grid',
    gap: '0.8rem',
    textAlign: 'center',
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-soft)',
  },
  art: {
    position: 'relative',
    height: 170,
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(160deg, var(--highlight-soft), var(--accent-soft))',
  },
  sun: {
    position: 'absolute',
    width: 68,
    height: 68,
    top: 18,
    right: 34,
    borderRadius: '50%',
    background: 'var(--highlight)',
  },
  shop: {
    position: 'absolute',
    left: '50%',
    bottom: 36,
    transform: 'translateX(-50%)',
    width: 120,
    height: 78,
    display: 'grid',
    placeItems: 'center',
    border: '6px solid var(--text-inverse)',
    borderTop: '20px solid var(--accent)',
    borderRadius: '10px 10px 6px 6px',
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 700,
    letterSpacing: '-0.04em',
    boxShadow: 'var(--shadow-soft)',
  },
  eyebrow: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.8rem, 7vw, 2.35rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.04em',
  },
  copy: {
    margin: '0 auto',
    maxWidth: 350,
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
  },
  impact: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.35rem',
    margin: '0 0 0.15rem',
    padding: 0,
    listStyle: 'none',
  },
  impactItem: {
    padding: '0.35rem 0.55rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
};
