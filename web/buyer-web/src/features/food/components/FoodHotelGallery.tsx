import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { resolveMediaContentUrl } from '@/shared/media/resolveMediaContentUrl';
import type { FoodHotelPhoto } from '../api/foodApi';

type Props = {
  title: string;
  subtitle?: string | null;
  photos: FoodHotelPhoto[];
  /** Compact strip for listing cards; hero fills width on hotel page. */
  variant?: 'card' | 'hero';
  pureVeg?: boolean;
  offerLabel?: string | null;
  /** When the page header already shows the hotel name. */
  hideTitleInHero?: boolean;
};

export function FoodHotelGallery({
  title,
  subtitle,
  photos,
  variant = 'hero',
  pureVeg,
  offerLabel,
  hideTitleInHero = false,
}: Props) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setActive(0);
  }, [photos.map((p) => p.mediaId).join('|')]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, variant === 'card' ? 5200 : 4500);
    return () => window.clearInterval(timer);
  }, [photos.length, variant]);

  const cover = photos[active] ?? photos[0];
  const hasPhotos = photos.length > 0;

  if (variant === 'card') {
    return (
      <div style={styles.cardShell}>
        {hasPhotos ? (
          <div style={styles.cardMedia}>
            {photos.slice(0, 3).map((p, i) => (
              <img
                key={p.mediaId}
                src={resolveMediaContentUrl(p.url)}
                alt=""
                style={{
                  ...styles.cardImg,
                  opacity: i === 0 ? 1 : 0.45,
                  zIndex: 3 - i,
                  transform: `scale(${1.02 - i * 0.03}) translateX(${i * 8}px)`,
                }}
                loading="lazy"
              />
            ))}
            <div style={styles.cardShade} />
            {photos.length > 1 ? <span style={styles.countPill}>{photos.length} photos</span> : null}
          </div>
        ) : (
          <div style={styles.cardPlaceholder} aria-hidden>
            <span style={styles.placeholderEmoji}>🍽️</span>
          </div>
        )}
        <div style={styles.cardCopy}>
          {offerLabel ? <span style={styles.offerMini}>{offerLabel}</span> : null}
          <h2 style={styles.cardTitle}>{title}</h2>
          {subtitle ? <p style={styles.cardSub}>{subtitle}</p> : null}
          {pureVeg ? <span style={styles.pureTag}>Pure veg</span> : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.heroWrap}>
        {hasPhotos ? (
          <div style={styles.heroMedia}>
            {photos.map((p, i) => (
              <img
                key={p.mediaId}
                src={resolveMediaContentUrl(p.url)}
                alt=""
                style={{
                  ...styles.heroSlide,
                  opacity: i === active ? 1 : 0,
                  transform: i === active ? 'scale(1.06)' : 'scale(1)',
                }}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ))}
            <motionOverlay />
            <div style={styles.heroCopy}>
              {offerLabel ? <span style={styles.offerHero}>{offerLabel}</span> : null}
              {hideTitleInHero ? null : <h1 style={styles.heroTitle}>{title}</h1>}
              {subtitle ? <p style={styles.heroSub}>{subtitle}</p> : null}
              <motionRow>
                {pureVeg ? <span style={styles.pureHero}>Pure veg</span> : null}
                {photos.length > 0 ? (
                  <button type="button" style={styles.galleryBtn} onClick={() => setLightbox(true)}>
                    View gallery · {photos.length}
                  </button>
                ) : null}
              </motionRow>
            </div>
            {photos.length > 1 ? (
              <motionDots>
                {photos.map((p, i) => (
                  <button
                    key={p.mediaId}
                    type="button"
                    aria-label={`Photo ${i + 1}`}
                    style={i === active ? styles.dotOn : styles.dot}
                    onClick={() => setActive(i)}
                  />
                ))}
              </motionDots>
            ) : null}
          </div>
        ) : (
          <div style={styles.heroEmpty} aria-hidden>
            {offerLabel ? <span style={styles.offerCompact}>{offerLabel}</span> : null}
            {subtitle ? <p style={styles.heroSubCompact}>{subtitle}</p> : null}
            {pureVeg ? <span style={styles.pureCompact}>Pure veg</span> : null}
          </div>
        )}
      </div>

      {lightbox && hasPhotos ? (
        <div style={styles.lbBackdrop} role="presentation" onClick={() => setLightbox(false)}>
          <div style={styles.lbSheet} role="dialog" aria-label={`${title} photos`} onClick={(e) => e.stopPropagation()}>
            <button type="button" style={styles.lbClose} onClick={() => setLightbox(false)} aria-label="Close">
              ✕
            </button>
            <div style={styles.lbScroller}>
              {photos.map((p) => (
                <div key={p.mediaId} style={styles.lbSlide}>
                  <img src={resolveMediaContentUrl(p.url)} alt="" style={styles.lbImg} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes foodKenBurns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}

function motionOverlay() {
  return (
    <div
      style={{
        ...styles.heroShade,
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.72) 100%)',
      }}
    />
  );
}

function motionRow({ children }: { children: ReactNode }) {
  return <div style={styles.heroMetaRow}>{children}</div>;
}

function motionDots({ children }: { children: ReactNode }) {
  return <div style={styles.dotRow}>{children}</div>;
}

const styles: Record<string, CSSProperties> = {
  cardShell: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid color-mix(in srgb, var(--accent, #009111) 18%, #e5e7eb)',
    background: '#fff',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
    minHeight: 168,
  },
  cardMedia: { position: 'relative', height: 110, overflow: 'hidden', background: '#0f172a' },
  cardImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.35s ease, transform 0.35s ease',
  },
  cardShade: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 35%, rgba(15,23,42,0.55) 100%)',
  },
  countPill: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    fontSize: '0.65rem',
    fontWeight: 800,
    color: '#fff',
    background: 'rgba(15,23,42,0.55)',
    padding: '0.18rem 0.45rem',
    borderRadius: 999,
    backdropFilter: 'blur(6px)',
  },
  cardPlaceholder: {
    height: 110,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #ecfdf5, #fef3c7)',
  },
  placeholderEmoji: { fontSize: '2rem' },
  cardCopy: { padding: '0.65rem 0.7rem 0.75rem', position: 'relative' },
  offerMini: {
    position: 'absolute',
    top: -12,
    right: 10,
    background: '#2563eb',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.2rem 0.45rem',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
  },
  cardTitle: { margin: 0, fontSize: '1.02rem', lineHeight: 1.25, fontWeight: 800 },
  cardSub: { margin: '0.2rem 0 0', fontSize: '0.76rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.35 },
  pureTag: {
    display: 'inline-block',
    marginTop: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#16a34a',
  },
  heroWrap: {
    margin: '0 0 0.55rem',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-card)',
  },
  heroMedia: { position: 'relative', height: 'min(42vw, 200px)', background: '#0f172a', overflow: 'hidden' },
  heroSlide: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.8s ease, transform 8s ease',
    animation: 'foodKenBurns 8s ease-in-out infinite alternate',
  },
  heroShade: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  heroCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '1rem 1rem 1.1rem',
    color: '#fff',
    zIndex: 2,
  },
  offerHero: {
    display: 'inline-block',
    marginBottom: '0.35rem',
    background: 'rgba(37, 99, 235, 0.92)',
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.5rem',
    borderRadius: 8,
  },
  heroTitle: { margin: 0, fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 },
  heroSub: { margin: '0.3rem 0 0', fontSize: '0.82rem', opacity: 0.92, lineHeight: 1.35 },
  heroMetaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center', marginTop: '0.55rem' },
  pureHero: {
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    background: 'rgba(22, 163, 74, 0.85)',
  },
  galleryBtn: {
    border: '1px solid rgba(255,255,255,0.65)',
    background: 'rgba(15,23,42,0.35)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.75rem',
    padding: '0.3rem 0.65rem',
    borderRadius: 999,
    backdropFilter: 'blur(8px)',
    cursor: 'pointer',
  },
  dotRow: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    display: 'flex',
    gap: 6,
    zIndex: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
  },
  dotOn: {
    width: 18,
    height: 7,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: '#fff',
    cursor: 'pointer',
  },
  heroEmpty: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.5rem',
    padding: '0.55rem 0.65rem',
    minHeight: 0,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  offerCompact: {
    display: 'inline-block',
    background: 'var(--info)',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '0.15rem 0.4rem',
    borderRadius: 6,
  },
  heroSubCompact: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    flex: '1 1 100%',
    lineHeight: 1.35,
  },
  pureCompact: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--success)',
  },
  lbBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(15, 23, 42, 0.78)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0.5rem',
  },
  lbSheet: {
    width: 'min(100%, 480px)',
    maxHeight: '85vh',
    background: '#0f172a',
    borderRadius: '18px 18px 12px 12px',
    overflow: 'hidden',
    position: 'relative',
  },
  lbClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    border: 'none',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    borderRadius: 999,
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  lbScroller: {
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
  },
  lbSlide: {
    flex: '0 0 100%',
    scrollSnapAlign: 'start',
    display: 'grid',
    placeItems: 'center',
    minHeight: 'min(70vh, 420px)',
  },
  lbImg: { maxWidth: '100%', maxHeight: 'min(70vh, 420px)', objectFit: 'contain' },
};