import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export function BeautyGlamBanner() {
  return (
    <Link to="/beauty" style={styles.banner} aria-label="Book makeup and beauty">
      <span style={styles.emoji} aria-hidden>
        💄
      </span>
      <span style={styles.copy}>
        <strong style={styles.title}>Koya Glam</strong>
        <span style={styles.hint}>Book makeup artists near you · home or studio</span>
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
    padding: '0.42rem 0.5rem',
    minHeight: 48,
    borderRadius: 14,
    textDecoration: 'none',
    color: '#fff',
    background:
      'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.25) 0%, transparent 55%), linear-gradient(125deg, #831843 0%, #db2777 55%, #f472b6 100%)',
    boxShadow: '0 6px 20px rgba(219, 39, 119, 0.25)',
  },
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
