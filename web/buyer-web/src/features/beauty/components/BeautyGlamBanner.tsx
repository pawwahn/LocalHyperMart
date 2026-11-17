import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { GLAM_HERO_BANNER_THUMB } from '@hlm-beauty';

export function BeautyGlamBanner() {
  return (
    <Link to="/beauty" style={styles.banner} aria-label="Book makeup and beauty">
      <span style={styles.thumbWrap} aria-hidden>
        <img
          src={GLAM_HERO_BANNER_THUMB}
          alt=""
          width={44}
          height={44}
          style={styles.thumb}
          loading="lazy"
          decoding="async"
        />
      </span>
      <span style={styles.copy}>
        <strong style={styles.title}>Koya Glam</strong>
        <span style={styles.hint}>Premium artists · home or studio · curated looks</span>
      </span>
      <span style={styles.cta}>Book</span>
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    margin: '0.35rem 0 0.4rem',
    padding: '0.38rem 0.48rem',
    minHeight: 52,
    borderRadius: 14,
    textDecoration: 'none',
    color: '#fff',
    background:
      'linear-gradient(118deg, rgba(76,5,25,0.94) 0%, rgba(131,24,67,0.92) 58%, rgba(157,23,77,0.85) 100%)',
    boxShadow: '0 8px 24px rgba(76, 5, 25, 0.22)',
    border: '1px solid rgba(255,255,255,0.14)',
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    overflow: 'hidden',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.28)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  emoji: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.2)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.1rem',
    flexShrink: 0,
  },
  copy: { flex: 1, minWidth: 0, display: 'grid', gap: '0.05rem' },
  title: { fontSize: '0.88rem', fontWeight: 900, letterSpacing: '-0.02em' },
  hint: { fontSize: '0.65rem', fontWeight: 600, opacity: 0.92 },
  cta: {
    flexShrink: 0,
    minHeight: 30,
    padding: '0 0.75rem',
    borderRadius: 999,
    background: '#fff',
    color: '#be185d',
    fontSize: '0.72rem',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
  },
};
