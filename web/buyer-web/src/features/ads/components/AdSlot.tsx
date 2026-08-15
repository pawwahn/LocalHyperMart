import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTown } from '@/shared/town/TownContext';
import { resolveCreative, fetchTownAds, type TownAdDto } from '../api/townAdsApi';
import { ADS_ENABLED, type AdCreative, type AdSlotId } from '../adsInventory';

type Props = {
  slot: AdSlotId;
  /** home_mid_grid: span full product grid width */
  variant?: 'hero' | 'strip' | 'card';
  onCta?: () => void;
};

const liveCache = new Map<string, TownAdDto[]>();

/**
 * Monetization surface — clearly labelled Sponsored.
 * Town-scoped creatives for the buyer's selected town.
 * Config ownership: **super admin only** (no hub / vendor edit).
 * Live ads from town-service; pilot inventory is fallback.
 */
export function AdSlot({ slot, variant = 'strip', onCta }: Props) {
  const { townId, hasTown } = useTown();
  const tid = hasTown ? townId : null;
  const [live, setLive] = useState<TownAdDto[] | null>(() =>
    tid && liveCache.has(tid) ? liveCache.get(tid)! : null,
  );

  useEffect(() => {
    if (!ADS_ENABLED || !tid) {
      setLive(null);
      return;
    }
    // Always refresh so admin image updates show without hard reload.
    let cancelled = false;
    void fetchTownAds(tid)
      .then((items) => {
        if (cancelled) return;
        liveCache.set(tid, items);
        setLive(items);
      })
      .catch(() => {
        if (!cancelled) setLive(liveCache.get(tid) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [tid]);

  if (!ADS_ENABLED) return null;
  const ad = resolveCreative(slot, tid, live);
  if (!ad) return null;

  if (variant === 'hero') {
    return <HeroAd ad={ad} townId={tid} onCta={onCta} />;
  }

  const isCard = variant === 'card';
  return <SoftAd ad={ad} townId={tid} isCard={isCard} onCta={onCta} />;
}

function useAdImages(ad: AdCreative): string[] {
  if (ad.imageUrls?.length) return ad.imageUrls.slice(0, 3);
  if (ad.imageUrl) return [ad.imageUrl];
  return [];
}

function ImageCarousel({
  images,
  height,
  rounded = 12,
  dark = false,
  fill = false,
}: {
  images: string[];
  height: number;
  rounded?: number;
  dark?: boolean;
  fill?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    setIndex(0);
  }, [images.join('|')]);

  if (!images.length) return null;

  const go = (dir: -1 | 1) => {
    setIndex((i) => (i + dir + images.length) % images.length);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    startX.current = e.clientX;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!dragging.current || startX.current == null) return;
    const dx = e.clientX - startX.current;
    dragging.current = false;
    startX.current = null;
    if (Math.abs(dx) < 36) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      style={{
        ...styles.carousel,
        height: fill ? '100%' : height,
        borderRadius: rounded,
        touchAction: 'pan-y',
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragging.current = false;
        startX.current = null;
      }}
      role="group"
      aria-roledescription="carousel"
      aria-label={`Ad images, ${index + 1} of ${images.length}`}
    >
      <div
        style={{
          ...styles.carouselTrack,
          transform: `translateX(-${index * 100}%)`,
        }}
      >
        {images.map((src) => (
          <img key={src} src={src} alt="" draggable={false} style={styles.carouselImg} />
        ))}
      </div>
      {images.length > 1 ? (
        <div style={styles.dots}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to image ${i + 1}`}
              style={{
                ...styles.dot,
                ...(i === index ? styles.dotActive : null),
                ...(dark ? styles.dotDark : null),
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeroAd({
  ad,
  townId,
  onCta,
}: {
  ad: AdCreative;
  townId: string | null;
  onCta?: () => void;
}) {
  const images = useAdImages(ad);
  return (
    <aside
      key={`${ad.id}-${townId}`}
      style={{ ...styles.hero, background: images.length ? undefined : ad.tint }}
      aria-label={`Sponsored: ${ad.sponsor}`}
    >
      {images.length ? (
        <div style={styles.heroMediaWrap}>
          <ImageCarousel images={images} height={0} fill rounded={16} dark />
          <div style={styles.heroMediaScrim} aria-hidden />
        </div>
      ) : (
        <div style={styles.heroGlow} aria-hidden />
      )}
      <div style={styles.heroTop}>
        <span style={styles.sponsoredHero}>Sponsored</span>
      </div>
      <div style={styles.heroMain}>
        {!images.length ? (
          <div style={styles.heroVisual} aria-hidden>
            <span style={styles.heroEmoji}>{ad.emoji}</span>
          </div>
        ) : null}
        <div style={styles.heroCopy}>
          <p style={styles.shopNameHero}>{ad.sponsor}</p>
          <p style={styles.titleHero}>{ad.title}</p>
          {ad.subtitle ? <p style={styles.subHero}>{ad.subtitle}</p> : null}
          {ad.ctaLabel?.trim() ? (
            <button type="button" style={styles.ctaHero} onClick={onCta}>
              {ad.ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function SoftAd({
  ad,
  townId,
  isCard,
  onCta,
}: {
  ad: AdCreative;
  townId: string | null;
  isCard: boolean;
  onCta?: () => void;
}) {
  const images = useAdImages(ad);
  if (isCard && images.length) {
    return (
      <aside
        key={`${ad.id}-${townId}`}
        style={styles.cardCarousel}
        aria-label={`Sponsored: ${ad.sponsor}`}
      >
        <ImageCarousel images={images} height={148} rounded={12} />
        <div style={styles.cardBody}>
          <span style={styles.sponsoredSoft}>Sponsored</span>
          <p style={styles.shopName}>{ad.sponsor}</p>
          <p style={styles.title}>{ad.title}</p>
          {ad.subtitle ? <p style={{ ...styles.sub, whiteSpace: 'normal' }}>{ad.subtitle}</p> : null}
          {ad.ctaLabel?.trim() ? (
            <button type="button" style={{ ...styles.cta, alignSelf: 'start', marginTop: '0.2rem' }} onClick={onCta}>
              {ad.ctaLabel}
            </button>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside
      key={`${ad.id}-${townId}`}
      style={{
        ...(isCard ? styles.card : styles.strip),
        background: images.length ? 'var(--bg-elevated)' : ad.tint,
      }}
      aria-label={`Sponsored: ${ad.sponsor}`}
    >
      <div style={images.length ? styles.softMainImage : styles.softMain}>
        <div style={images.length ? styles.softVisualImage : styles.softVisual} aria-hidden={!images.length}>
          {images.length ? (
            <ImageCarousel images={images} height={72} rounded={12} />
          ) : (
            <span style={styles.softEmoji}>{ad.emoji}</span>
          )}
        </div>
        <div style={styles.softCopy}>
          <span style={styles.sponsoredSoft}>Sponsored</span>
          <p style={styles.shopName}>{ad.sponsor}</p>
          <p style={styles.title}>{ad.title}</p>
          {ad.subtitle ? <p style={styles.sub}>{ad.subtitle}</p> : null}
        </div>
        {ad.ctaLabel?.trim() ? (
          <button type="button" style={styles.cta} onClick={onCta}>
            {ad.ctaLabel}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  carousel: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    background: 'var(--bg-muted)',
    userSelect: 'none',
    cursor: 'grab',
  },
  carouselTrack: {
    display: 'flex',
    height: '100%',
    width: '100%',
    transition: 'transform 220ms ease',
  },
  carouselImg: {
    flex: '0 0 100%',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    zIndex: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: 'rgba(0,0,0,0.28)',
    cursor: 'pointer',
  },
  dotActive: {
    background: 'var(--accent)',
    width: 14,
  },
  dotDark: {
    background: 'rgba(255,255,255,0.45)',
  },
  hero: {
    position: 'relative',
    borderRadius: 16,
    padding: '0.85rem 0.95rem 1rem',
    color: '#fff',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(12, 131, 31, 0.22)',
    background: 'linear-gradient(135deg, #0C831F 0%, #0a6b1a 100%)',
    minHeight: 140,
  },
  heroMediaWrap: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
  heroMediaScrim: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(100deg, rgba(8,40,16,0.82) 0%, rgba(8,40,16,0.45) 55%, rgba(8,40,16,0.25) 100%)',
    pointerEvents: 'none',
    zIndex: 1,
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
    zIndex: 2,
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
  shopNameHero: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.12rem',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  heroMain: {
    position: 'relative',
    zIndex: 2,
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
    fontWeight: 700,
    fontSize: '0.88rem',
    lineHeight: 1.3,
    opacity: 0.95,
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
    borderRadius: 12,
    padding: '0.45rem 0.6rem',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--text)',
  },
  card: {
    gridColumn: '1 / -1',
    borderRadius: 14,
    padding: '0.55rem',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--text)',
  },
  cardCarousel: {
    gridColumn: '1 / -1',
    borderRadius: 14,
    padding: '0.55rem',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.55rem',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--text)',
  },
  cardBody: { display: 'grid', gap: '0.2rem', padding: '0 0.15rem 0.1rem' },
  softMain: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '0.65rem',
    alignItems: 'center',
    minWidth: 0,
  },
  softMainImage: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr auto',
    gap: '0.65rem',
    alignItems: 'center',
    minWidth: 0,
  },
  softVisual: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  softVisualImage: {
    width: 110,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    background: 'var(--bg-muted)',
  },
  softEmoji: { fontSize: '1.35rem', lineHeight: 1 },
  softCopy: {
    display: 'grid',
    gap: '0.12rem',
    minWidth: 0,
  },
  shopName: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.98rem',
    color: 'var(--text)',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  sponsoredSoft: {
    justifySelf: 'start',
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
    borderRadius: 999,
    padding: '0.12rem 0.4rem',
  },
  title: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.8rem',
    color: 'var(--text)',
    lineHeight: 1.3,
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
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
