import type { CSSProperties } from 'react';
import { Button } from '@/shared/ui';

type Props = {
  open: boolean;
  townLabel: string;
  onClose: () => void;
};

const BALLOONS = [
  { left: '5%', color: '#F97316', delay: '0s', duration: '4.6s', size: 34 },
  { left: '16%', color: '#EC4899', delay: '0.6s', duration: '5.1s', size: 28 },
  { left: '29%', color: '#EAB308', delay: '0.2s', duration: '4.2s', size: 38 },
  { left: '43%', color: '#22C55E', delay: '1s', duration: '5.4s', size: 30 },
  { left: '57%', color: '#3B82F6', delay: '0.4s', duration: '4.8s', size: 36 },
  { left: '70%', color: '#A855F7', delay: '1.3s', duration: '5.2s', size: 29 },
  { left: '83%', color: '#EF4444', delay: '0.1s', duration: '4.4s', size: 35 },
  { left: '94%', color: '#14B8A6', delay: '0.9s', duration: '5s', size: 27 },
] as const;

export function OrderCelebration({ open, townLabel, onClose }: Props) {
  if (!open) return null;

  const town = townLabel === 'Choose your town' ? 'home town' : townLabel.split(',')[0];

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Order placed">
      <div style={styles.balloons} aria-hidden>
        {BALLOONS.map((balloon, index) => (
          <span
            key={index}
            className="hlm-order-balloon"
            style={{
              ...styles.balloon,
              left: balloon.left,
              width: balloon.size,
              height: balloon.size * 1.22,
              background: balloon.color,
              animationDelay: balloon.delay,
              animationDuration: balloon.duration,
            }}
          />
        ))}
      </div>

      <section style={styles.card}>
        <div style={styles.check} aria-hidden>
          ✓
        </div>
        <p style={styles.eyebrow}>ORDER CONFIRMED</p>
        <h2 style={styles.title}>Your local order is on its way!</h2>
        <p style={styles.message}>
          Thanks for supporting your home town
          {town !== 'home town' ? <strong style={styles.town}> — {town}</strong> : null}.
        </p>
        <Button size="lg" fullWidth onClick={onClose}>
          View my order
        </Button>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--highlight) 42%, transparent), transparent 35%), color-mix(in srgb, var(--bg) 94%, white)',
  },
  balloons: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  balloon: {
    position: 'absolute',
    bottom: -80,
    borderRadius: '52% 48% 48% 52% / 45% 45% 55% 55%',
    boxShadow: 'inset -6px -5px 0 rgba(0,0,0,0.1), inset 5px 4px 0 rgba(255,255,255,0.25)',
    animationName: 'hlm-balloon-rise',
    animationTimingFunction: 'ease-in',
    animationIterationCount: 'infinite',
  },
  card: {
    position: 'relative',
    zIndex: 2,
    width: 'min(410px, 100%)',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.65rem',
    padding: '1.4rem',
    border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--border))',
    borderRadius: 'var(--radius-xl)',
    background: 'color-mix(in srgb, var(--bg-elevated) 94%, transparent)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'var(--shadow-elevated)',
    textAlign: 'center',
    animation: 'hlm-celebration-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
  },
  check: {
    width: 62,
    height: 62,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '2rem',
    fontWeight: 900,
    boxShadow: '0 10px 25px color-mix(in srgb, var(--accent) 38%, transparent)',
  },
  eyebrow: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 900,
    letterSpacing: '0.09em',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.65rem, 7vw, 2.15rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.035em',
  },
  message: {
    margin: '0 0 0.35rem',
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    lineHeight: 1.45,
  },
  town: { color: 'var(--accent)', fontWeight: 800 },
};
