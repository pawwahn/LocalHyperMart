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
          <span style={{ ...styles.shop, ...styles.shopBack }}>LOCAL</span>
          <span style={styles.shop}>♥</span>
          <span style={styles.people}>● ● ●</span>
        </div>

        <p style={styles.eyebrow}>WELCOME TO HYPERLOCALMART</p>
        <h1 style={styles.title}>Shop local. Keep {localTown} thriving.</h1>
        <p style={styles.copy}>
          Every order supports neighbourhood shopkeepers, local jobs, and families in your community.
        </p>

        <div style={styles.impact}>
          <span style={styles.impactItem}>🏪 Local shops</span>
          <span style={styles.impactItem}>🛵 Local delivery</span>
          <span style={styles.impactItem}>💚 Local growth</span>
        </div>

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
    animation: 'hlm-fade-up 300ms ease both',
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
  shopBack: {
    left: '16%',
    bottom: 44,
    width: 104,
    height: 65,
    fontSize: '0.76rem',
    background: 'var(--hero-deep)',
    transform: 'rotate(-3deg)',
  },
  shop: {
    position: 'absolute',
    left: '45%',
    bottom: 34,
    width: 132,
    height: 86,
    display: 'grid',
    placeItems: 'center',
    border: '8px solid var(--text-inverse)',
    borderTop: '24px solid var(--accent)',
    borderRadius: '8px 8px 4px 4px',
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontSize: '1.65rem',
    fontWeight: 800,
    boxShadow: '0 10px 22px rgba(12, 131, 31, 0.18)',
  },
  people: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    color: 'var(--hero-deep)',
    fontSize: '1.15rem',
    letterSpacing: '0.7rem',
  },
  eyebrow: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.09em',
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
    marginBottom: '0.15rem',
  },
  impactItem: {
    padding: '0.35rem 0.55rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
    color: 'var(--hero-deep)',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
};
