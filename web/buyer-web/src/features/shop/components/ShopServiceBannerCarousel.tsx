import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ShopServiceBanner } from '../config/shopServiceBanners';
import { ServiceGlamIcon, ServiceLaundryIcon } from './JumpCardIcons';

const GRID_CSS = `
  .hlm-service-banner-wrap {
    margin: 0.25rem 0 0.45rem;
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

function ServiceIcon({ id, accent }: { id: ShopServiceBanner['id']; accent: string }) {
  const wrap: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: `color-mix(in srgb, ${accent} 11%, var(--bg-muted))`,
    color: accent,
    flexShrink: 0,
  };
  return (
    <span style={wrap} aria-hidden>
      {id === 'glam' ? <ServiceGlamIcon /> : <ServiceLaundryIcon />}
    </span>
  );
}

function ServiceBannerCard({ banner }: { banner: ShopServiceBanner }) {
  return (
    <Link to={banner.to} style={styles.card} aria-label={banner.ariaLabel}>
      <ServiceIcon id={banner.id} accent={banner.accent} />
      <span style={styles.copy}>
        <strong style={styles.title}>{banner.title}</strong>
        <span style={styles.hint}>{banner.hint}</span>
      </span>
      <span style={{ ...styles.cta, color: banner.accent }}>{banner.cta}</span>
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
          <ServiceBannerCard key={banner.id} banner={banner} />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.55rem',
    minHeight: 56,
    borderRadius: 12,
    textDecoration: 'none',
    color: 'var(--text)',
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    boxShadow: 'var(--shadow-card)',
    minWidth: 0,
  },
  copy: { flex: 1, minWidth: 0, display: 'grid', gap: '0.12rem' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  hint: {
    fontSize: '0.64rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cta: {
    flexShrink: 0,
    minHeight: 32,
    padding: '0 0.65rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    fontSize: '0.68rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
  },
};
