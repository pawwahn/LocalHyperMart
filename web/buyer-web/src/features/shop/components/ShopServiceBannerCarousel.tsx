import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ShopServiceBanner } from '../config/shopServiceBanners';

const GRID_CSS = `
  .hlm-service-banner-wrap {
    margin: 0.35rem 0 0.4rem;
    min-width: 0;
  }
  .hlm-service-banner-grid {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }
  .hlm-service-banner-grid--one {
    grid-template-columns: minmax(0, 1fr);
  }
  .hlm-service-banner-grid--multi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

type Props = {
  banners: ShopServiceBanner[];
};

function ServiceBannerCard({ banner, compact }: { banner: ShopServiceBanner; compact: boolean }) {
  if (compact) {
    return (
      <Link
        to={banner.to}
        style={{ ...styles.bannerCompact, background: banner.background }}
        aria-label={banner.ariaLabel}
      >
        <span style={styles.emojiCompact} aria-hidden>
          {banner.emoji}
        </span>
        <strong style={styles.titleCompact}>{banner.title}</strong>
        <span style={styles.hintCompact}>{banner.hint}</span>
        <span style={{ ...styles.ctaCompact, color: banner.ctaColor }}>{banner.cta}</span>
      </Link>
    );
  }

  return (
    <Link to={banner.to} style={{ ...styles.banner, background: banner.background }} aria-label={banner.ariaLabel}>
      <span style={styles.emoji} aria-hidden>
        {banner.emoji}
      </span>
      <span style={styles.copy}>
        <strong style={styles.title}>{banner.title}</strong>
        <span style={styles.hint}>{banner.hint}</span>
      </span>
      <span style={{ ...styles.cta, color: banner.ctaColor }}>{banner.cta}</span>
    </Link>
  );
}

export function ShopServiceBannerCarousel({ banners }: Props) {
  if (banners.length === 0) return null;

  const multi = banners.length > 1;

  return (
    <div className="hlm-service-banner-wrap" aria-label="Local services">
      <style>{GRID_CSS}</style>
      <div className={`hlm-service-banner-grid ${multi ? 'hlm-service-banner-grid--multi' : 'hlm-service-banner-grid--one'}`}>
        {banners.map((banner) => (
          <ServiceBannerCard key={banner.id} banner={banner} compact={multi} />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.42rem 0.5rem',
    minHeight: 48,
    borderRadius: 14,
    textDecoration: 'none',
    color: '#fff',
    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
  },
  emoji: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.18)',
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
    fontSize: '0.72rem',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
  },
  bannerCompact: {
    display: 'grid',
    gap: '0.28rem',
    padding: '0.45rem 0.5rem 0.5rem',
    minHeight: 0,
    borderRadius: 14,
    textDecoration: 'none',
    color: '#fff',
    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
    alignContent: 'start',
    minWidth: 0,
  },
  emojiCompact: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: 'rgba(255, 255, 255, 0.18)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1rem',
  },
  titleCompact: { fontSize: '0.82rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 },
  hintCompact: {
    fontSize: '0.6rem',
    fontWeight: 600,
    opacity: 0.92,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  ctaCompact: {
    justifySelf: 'start',
    marginTop: '0.12rem',
    minHeight: 28,
    padding: '0 0.65rem',
    borderRadius: 999,
    background: '#fff',
    fontSize: '0.68rem',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
  },
};
