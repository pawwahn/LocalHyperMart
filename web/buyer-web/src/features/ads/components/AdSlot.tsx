import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTown } from '@/shared/town/TownContext';
import { resolveCreative, resolveCreatives, fetchTownAds, type TownAdDto } from '../api/townAdsApi';
import { ADS_ENABLED, type AdCreative, type AdSlotId } from '../adsInventory';

type Props = {
  slot: AdSlotId;
  /** home_mid_grid: span full product grid width */
  variant?: 'hero' | 'strip' | 'card';
  onCta?: () => void;
};

const liveCache = new Map<string, TownAdDto[]>();
const AD_PHOTO = 88;
const AD_FRAME_H = 108;

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

  if (slot === 'home_mid_grid') {
    const ads = resolveCreatives(slot, tid, live);
    if (!ads.length) return null;
    return <MidGridAdCarousel ads={ads} townId={tid} onCta={onCta} />;
  }

  const ad = resolveCreative(slot, tid, live);
  if (!ad) return null;

  return <SoftAd ad={ad} townId={tid} onCta={onCta} />;
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
  showDots = true,
}: {
  images: string[];
  height: number;
  rounded?: number;
  dark?: boolean;
  fill?: boolean;
  /** Strip ads: false — dots were painting over product rails below. */
  showDots?: boolean;
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
      {showDots && images.length > 1 ? (
        <div style={dark ? styles.dots : styles.dotsOverlay}>
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

function midSlideDurationMs(ads: AdCreative[], slideIndex: number, count: number): number {
  const adIndex = slideIndex >= count ? 0 : slideIndex;
  const sec = ads[adIndex]?.displayDurationSec ?? 4;
  const clamped = Math.min(60, Math.max(2, Math.round(sec)));
  return clamped * 1000;
}

function MidGridAdCarousel({
  ads,
  townId,
  onCta,
}: {
  ads: AdCreative[];
  townId: string | null;
  onCta?: () => void;
}) {
  const count = ads.length;
  const adsKey = ads.map((a) => `${a.id}:${a.displayDurationSec ?? 4}`).join('|');
  const slides = count > 1 ? [...ads, ads[0]] : ads;
  const [index, setIndex] = useState(0);
  const [enableTransition, setEnableTransition] = useState(true);
  const pausedRef = useRef(false);
  const dragging = useRef(false);
  const startX = useRef<number | null>(null);

  const activeDot = count > 1 && index >= count ? 0 : index;

  useEffect(() => {
    setIndex(0);
    setEnableTransition(true);
  }, [adsKey, townId]);

  useEffect(() => {
    if (count <= 1) return;
    let cancelled = false;
    let timeoutId = 0;

    const schedule = () => {
      if (cancelled) return;
      if (pausedRef.current || dragging.current || document.hidden) {
        timeoutId = window.setTimeout(schedule, 300);
        return;
      }
      const ms = midSlideDurationMs(ads, index, count);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setEnableTransition(true);
        setIndex((i) => i + 1);
      }, ms);
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [index, count, adsKey]);

  useEffect(() => {
    if (!enableTransition && index === 0) {
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEnableTransition(true));
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [enableTransition, index]);

  function handleTransitionEnd() {
    if (count <= 1 || index !== count) return;
    setEnableTransition(false);
    setIndex(0);
  }

  function go(dir: -1 | 1) {
    if (count <= 1) return;
    setEnableTransition(true);
    setIndex((i) => {
      if (dir === 1) return i >= count ? 0 : i + 1;
      if (i <= 0) return count - 1;
      if (i === count) return count - 1;
      return i - 1;
    });
  }

  function onPointerDown(e: ReactPointerEvent) {
    pausedRef.current = true;
    startX.current = e.clientX;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!dragging.current || startX.current == null) {
      dragging.current = false;
      pausedRef.current = false;
      return;
    }
    const dx = e.clientX - startX.current;
    dragging.current = false;
    startX.current = null;
    window.setTimeout(() => {
      pausedRef.current = false;
    }, 1200);
    if (Math.abs(dx) < 36) return;
    go(dx < 0 ? 1 : -1);
  }

  return (
    <aside style={styles.midCarousel} aria-label="Sponsored offers carousel">
      <div
        style={styles.midCarouselViewport}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragging.current = false;
          startX.current = null;
          pausedRef.current = false;
        }}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Sponsored ${activeDot + 1} of ${count}`}
      >
        <div
          style={{
            ...styles.midCarouselSlides,
            transform: `translateX(-${index * 100}%)`,
            transition: enableTransition ? 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((ad, slideIndex) => (
            <div key={`${ad.id}-${slideIndex}`} style={styles.midCarouselSlide}>
              <SoftAd ad={ad} townId={townId} onCta={onCta} />
            </div>
          ))}
        </div>
        {count > 1 ? (
          <div style={styles.midCarouselMeta}>
            <span style={styles.midCarouselCount}>
              {activeDot + 1}/{count}
            </span>
            <div style={styles.dots}>
              {ads.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to sponsored slide ${i + 1}`}
                  style={{
                    ...styles.dot,
                    background: i === activeDot ? '#fff' : 'rgba(255,255,255,0.5)',
                    width: i === activeDot ? 14 : 6,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    pausedRef.current = true;
                    setEnableTransition(true);
                    setIndex(i);
                    window.setTimeout(() => {
                      pausedRef.current = false;
                    }, midSlideDurationMs(ads, i, count));
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SoftAd({
  ad,
  townId,
  onCta,
}: {
  ad: AdCreative;
  townId: string | null;
  onCta?: () => void;
}) {
  const images = useAdImages(ad);
  const cta = ad.ctaLabel?.trim() ?? '';
  return (
    <aside
      key={`${ad.id}-${townId}`}
      style={{
        ...styles.strip,
        background: images.length ? undefined : ad.tint,
      }}
      aria-label={`Sponsored: ${ad.sponsor}`}
    >
      <div style={styles.softMain}>
        <div style={images.length ? styles.softVisualImage : styles.softVisual} aria-hidden={!images.length}>
          {images.length ? (
            <ImageCarousel images={images} height={AD_PHOTO} rounded={12} showDots={false} />
          ) : (
            <span style={styles.softEmoji}>{ad.emoji}</span>
          )}
        </div>
        <div style={styles.softCopy}>
          <span style={styles.sponsoredSoft}>Sponsored</span>
          <p style={styles.shopName}>{ad.sponsor || '\u00a0'}</p>
          <p style={styles.title}>{ad.title || '\u00a0'}</p>
          <p style={styles.sub}>{ad.subtitle || '\u00a0'}</p>
        </div>
        {cta ? (
          <button type="button" style={styles.cta} onClick={onCta}>
            {cta}
          </button>
        ) : (
          <span style={styles.ctaGhost} aria-hidden />
        )}
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
  dotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    zIndex: 2,
    pointerEvents: 'auto',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
    pointerEvents: 'auto',
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
  strip: {
    boxSizing: 'border-box',
    height: AD_FRAME_H,
    borderRadius: 16,
    padding: '0.5rem 0.6rem',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    background:
      'linear-gradient(180deg, #FFFFFF 0%, #F7FBF8 100%)',
    boxShadow: '0 8px 22px rgba(12, 131, 31, 0.08)',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--text)',
  },
  softMain: {
    display: 'grid',
    gridTemplateColumns: `${AD_PHOTO}px minmax(0, 1fr) 76px`,
    gap: '0.5rem',
    alignItems: 'center',
    height: '100%',
    minWidth: 0,
  },
  softVisual: {
    width: AD_PHOTO,
    height: AD_PHOTO,
    borderRadius: 12,
    background: 'linear-gradient(160deg, #E7F6EC 0%, #D8F0DE 100%)',
    border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  softVisualImage: {
    width: AD_PHOTO,
    height: AD_PHOTO,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    background: 'var(--bg-muted)',
    boxShadow: 'inset 0 0 0 1px rgba(12,131,31,0.08)',
  },
  softEmoji: { fontSize: '1.35rem', lineHeight: 1 },
  softCopy: {
    display: 'grid',
    gridTemplateRows: '16px 18px 17px 16px',
    alignContent: 'center',
    gap: 1,
    minWidth: 0,
  },
  shopName: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.92rem',
    color: 'var(--text)',
    lineHeight: '18px',
    letterSpacing: '-0.02em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sponsoredSoft: {
    justifySelf: 'start',
    height: 16,
    fontSize: '0.56rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0C831F',
    background: '#E7F6EC',
    borderRadius: 999,
    padding: '0 0.4rem',
    display: 'inline-flex',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.78rem',
    color: 'var(--text)',
    lineHeight: '17px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sub: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    lineHeight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cta: {
    boxSizing: 'border-box',
    width: 76,
    minHeight: 44,
    border: 'none',
    borderRadius: 999,
    padding: '0.35rem 0.4rem',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.68rem',
    cursor: 'pointer',
    lineHeight: 1.15,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  ctaGhost: {
    width: 76,
    minHeight: 44,
  },
  midCarousel: {
    minWidth: 0,
    maxWidth: '100%',
  },
  midCarouselViewport: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: AD_FRAME_H,
    touchAction: 'pan-y',
    cursor: 'grab',
    userSelect: 'none',
    borderRadius: 16,
  },
  midCarouselSlides: {
    display: 'flex',
    width: '100%',
    height: '100%',
    willChange: 'transform',
  },
  midCarouselSlide: {
    flex: '0 0 100%',
    minWidth: 0,
    height: '100%',
  },
  midCarouselMeta: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    pointerEvents: 'none',
    zIndex: 2,
  },
  midCarouselCount: {
    fontSize: '0.56rem',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.04em',
    background: 'rgba(16, 24, 16, 0.55)',
    borderRadius: 999,
    padding: '0.08rem 0.38rem',
    pointerEvents: 'none',
  },
};
