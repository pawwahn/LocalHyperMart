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

  if (variant === 'hero') {
    return (
      <aside
        style={{ ...styles.hero, background: ad.tint }}
        aria-label={`Sponsored: ${ad.sponsor}`}
      >
        <div style={styles.heroGlow} aria-hidden />
        <div style={styles.heroTop}>
          <span style={styles.sponsoredHero}>Sponsored</span>
          <span style={styles.sponsorHero}>{ad.sponsor}</span>
        </div>
        <div style={styles.heroMain}>
          <div style={styles.heroVisual} aria-hidden>
            <span style={styles.heroEmoji}>{ad.emoji}</span>
          </div>
          <div style={styles.heroCopy}>
            <p style={styles.titleHero}>{ad.title}</p>
            <p style={styles.subHero}>{ad.subtitle}</p>
            <button type="button" style={styles.ctaHero} onClick={onCta}>
              {ad.ctaLabel}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  const isCard = variant === 'card';
  return (
    <aside
      style={{
        ...(isCard ? styles.card : styles.strip),
        background: ad.tint,
      }}
      aria-label={`Sponsored: ${ad.sponsor}`}
    >
      <div style={styles.softMain}>
        <div style={styles.softVisual} aria-hidden>
          <span style={styles.softEmoji}>{ad.emoji}</span>
        </div>
        <div style={styles.softCopy}>
          <div style={styles.softMeta}>
            <span style={styles.sponsoredSoft}>Sponsored</span>
            <span style={styles.sponsorSoft}>{ad.sponsor}</span>
          </div>
          <p style={styles.title}>{ad.title}</p>
          <p style={styles.sub}>{ad.subtitle}</p>
        </div>
        <button type="button" style={styles.cta} onClick={onCta}>
          {ad.ctaLabel}
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: 'relative',
    borderRadius: 16,
    padding: '0.85rem 0.95rem 1rem',
    color: '#fff',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(12, 131, 31, 0.22)',
  },
  heroGlow: {
    position: 'absolute',
    right: '-18%',
    top: '-40%',
    width: '58%',
    height: '140%',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.14)',
    pointerEvents: 'none',
  },
  heroTop: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.7rem',
  },
  sponsoredHero: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: 'rgba(0,0,0,0.22)',
    color: '#fff',
    borderRadius: 999,
    padding: '0.18rem 0.55rem',
  },
  sponsorHero: {
    fontSize: '0.72rem',
    fontWeight: 700,
    opacity: 0.92,
  },
  heroMain: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '0.75rem',
    alignItems: 'center',
    minWidth: 0,
  },
  heroVisual: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.28)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  heroEmoji: { fontSize: '1.85rem', lineHeight: 1 },
  heroCopy: {
    display: 'grid',
    gap: '0.28rem',
    minWidth: 0,
    justifyItems: 'start',
  },
  titleHero: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  subHero: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 600,
    opacity: 0.92,
    lineHeight: 1.35,
  },
  ctaHero: {
    marginTop: '0.25rem',
    border: 'none',
    borderRadius: 999,
    padding: '0.42rem 0.9rem',
    background: '#fff',
    color: '#0C831F',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  },
  strip: {
    borderRadius: 14,
    padding: '0.7rem 0.75rem',
    border: '1px solid var(--border)',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  card: {
    gridColumn: '1 / -1',
    borderRadius: 14,
    padding: '0.7rem 0.75rem',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  softMain: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '0.65rem',
    alignItems: 'center',
    minWidth: 0,
  },
  softVisual: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(15, 23, 20, 0.06)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  softEmoji: { fontSize: '1.45rem', lineHeight: 1 },
  softCopy: {
    display: 'grid',
    gap: '0.12rem',
    minWidth: 0,
  },
  softMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  sponsoredSoft: {
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.12rem 0.4rem',
  },
  sponsorSoft: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.88rem',
    color: 'var(--text)',
    lineHeight: 1.25,
  },
  sub: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    whiteSpace: 'nowrap',
  },
};
