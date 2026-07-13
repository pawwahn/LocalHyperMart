import type { CSSProperties } from 'react';
import { getAdForSlot, type AdSlotId } from '../adsInventory';

type Props = {
  slot: AdSlotId;
  /** home_mid_grid: span full product grid width */
  variant?: 'hero' | 'strip' | 'card';
  onCta?: () => void;
};

/**
 * Monetization surface — clearly labelled Sponsored.
 * Easy to remove: stop rendering AdSlot / set ADS_ENABLED=false.
 */
export function AdSlot({ slot, variant = 'strip', onCta }: Props) {
  const ad = getAdForSlot(slot);
  if (!ad) return null;

  const shell =
    variant === 'hero' ? styles.hero : variant === 'card' ? styles.card : styles.strip;

  return (
    <aside
      style={{
        ...shell,
        background: ad.tint,
      }}
      aria-label={`Sponsored: ${ad.sponsor}`}
    >
      <div style={styles.topRow}>
        <span style={styles.sponsored}>Sponsored</span>
        <span style={styles.sponsor}>{ad.sponsor}</span>
      </div>
      <div style={styles.body}>
        <span style={styles.emoji} aria-hidden>
          {ad.emoji}
        </span>
        <div style={styles.copy}>
          <p style={variant === 'hero' ? styles.titleHero : styles.title}>{ad.title}</p>
          <p style={variant === 'hero' ? styles.subHero : styles.sub}>{ad.subtitle}</p>
        </div>
        <button type="button" style={variant === 'hero' ? styles.ctaHero : styles.cta} onClick={onCta}>
          {ad.ctaLabel}
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    borderRadius: 'var(--radius-lg)',
    padding: '0.95rem 1rem',
    color: 'var(--text-inverse)',
    boxShadow: '0 8px 20px rgba(12, 131, 31, 0.22)',
  },
  strip: {
    borderRadius: 12,
    padding: '0.75rem 0.85rem',
    border: '1px solid var(--border)',
  },
  card: {
    gridColumn: '1 / -1',
    borderRadius: 12,
    padding: '0.85rem 1rem',
    border: '1px dashed rgba(12, 131, 31, 0.35)',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.45rem',
  },
  sponsored: {
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    opacity: 0.9,
    background: 'rgba(0,0,0,0.12)',
    color: 'inherit',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
  sponsor: { fontSize: '0.75rem', fontWeight: 700, opacity: 0.95 },
  body: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  emoji: { fontSize: '1.75rem', lineHeight: 1, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, display: 'grid', gap: '0.1rem' },
  titleHero: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    lineHeight: 1.25,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.95rem',
    color: 'var(--text)',
    lineHeight: 1.25,
  },
  subHero: { margin: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.92 },
  sub: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' },
  ctaHero: {
    flexShrink: 0,
    border: 'none',
    borderRadius: 999,
    padding: '0.45rem 0.75rem',
    background: 'rgba(255,255,255,0.95)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  cta: {
    flexShrink: 0,
    border: 'none',
    borderRadius: 999,
    padding: '0.45rem 0.7rem',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
};
