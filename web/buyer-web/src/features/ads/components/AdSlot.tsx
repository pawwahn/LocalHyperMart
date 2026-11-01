import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTown } from '@/shared/town/TownContext';
import { resolveCreatives, fetchTownAds, type TownAdDto } from '../api/townAdsApi';
import { resolveAdCta } from '../lib/adCta';
import { ADS_ENABLED, type AdCreative, type AdSlotId } from '../adsInventory';

type Props = {
  slot: AdSlotId;
  /** Cat 1–4 and any future indexed room. */
  slotIndex?: number;
  /** home_mid_grid: span full product grid width */
  variant?: 'hero' | 'strip' | 'card';
  onCta?: () => void;
};

const liveCache = new Map<string, TownAdDto[]>();
/** Blinkit-style full-bleed photo banner */
const AD_BANNER_H = 168;

const AD_BANNER_CSS = `
  .hlm-ad-banner {
    position: relative;
    min-height: ${AD_BANNER_H}px;
    border-radius: 12px;
    overflow: hidden;
    background: #2a2a2a;
    box-shadow: 0 4px 16px rgba(16, 24, 40, 0.1);
  }
  .hlm-ad-banner-media {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .hlm-ad-banner-media > div {
    height: 100% !important;
    min-height: 100%;
    border-radius: 0 !important;
  }
  .hlm-ad-banner-scrim {
    pointer-events: none;
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.02) 35%,
      rgba(0, 0, 0, 0.55) 72%,
      rgba(0, 0, 0, 0.82) 100%
    );
  }
  .hlm-ad-banner-adtag {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 3;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 4px;
    padding: 0.15rem 0.38rem;
    line-height: 1.2;
  }
  .hlm-ad-banner-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #3d3d3d 0%, #525252 100%);
    font-family: var(--font-display);
    font-size: 2.25rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.35);
  }
  .hlm-ad-banner-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    gap: 0.55rem;
    padding: 0.55rem 0.65rem 0.62rem;
    pointer-events: none;
  }
  .hlm-ad-banner-overlay a,
  .hlm-ad-banner-overlay button {
    pointer-events: auto;
  }
  .hlm-ad-banner-copy {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    gap: 0.14rem;
  }
  .hlm-ad-banner-headline {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.9rem;
    line-height: 1.22;
    letter-spacing: -0.025em;
    color: #fff;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .hlm-ad-banner-shop {
    margin: 0;
    font-size: 0.74rem;
    font-weight: 600;
    line-height: 1.25;
    color: rgba(255, 255, 255, 0.92);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hlm-ad-banner-meta {
    margin: 0;
    font-size: 0.66rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.78);
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hlm-ad-banner-cta {
    flex-shrink: 0;
    align-self: flex-end;
    min-height: 38px;
    padding: 0 0.9rem;
    border: none;
    border-radius: 8px;
    background: #fff;
    color: var(--accent);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.74rem;
    letter-spacing: -0.01em;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }
  .hlm-ad-banner-cta:active {
    opacity: 0.94;
    transform: scale(0.98);
  }
  @media (min-width: 420px) {
    .hlm-ad-banner {
      min-height: 176px;
    }
    .hlm-ad-banner-headline {
      font-size: 0.95rem;
    }
  }
`;

/**
 * Monetization surface — clearly labelled Sponsored.
 * Town-scoped creatives for the buyer's selected town.
 * Config ownership: **super admin only** (no hub / vendor edit).
 * Live ads from town-service; pilot inventory is fallback.
 */
export function AdSlot({ slot, slotIndex, variant: _variant = 'strip', onCta }: Props) {
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

  const matches = resolveCreatives(slot, tid, live).filter((ad) =>
    slotIndex == null ? true : (ad.slotIndex ?? 0) === slotIndex,
  );
  const ad = matches[0];
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
  dotsBottom = 8,
}: {
  images: string[];
  height: number;
  rounded?: number;
  dark?: boolean;
  fill?: boolean;
  /** Strip ads: false — dots were painting over product rails below. */
  showDots?: boolean;
  dotsBottom?: number;
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
        <div style={{ ...(dark ? styles.dots : styles.dotsOverlay), bottom: dotsBottom }}>
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

function AdCtaControl({
  ctaRaw,
  href,
  onCta,
}: {
  ctaRaw: string;
  href?: string;
  onCta?: () => void;
}) {
  const resolved = resolveAdCta(ctaRaw);
  if (!resolved.label) return null;

  const isCall = Boolean(resolved.href);
  const label = isCall ? 'Call' : resolved.label;

  if (resolved.href) {
    return (
      <a
        href={resolved.href}
        className="hlm-ad-banner-cta"
        onClick={() => onCta?.()}
        aria-label={`Call ${resolved.phoneDisplay ?? 'shop'}`}
      >
        {label}
      </a>
    );
  }

  if (adHref(href)) {
    return (
      <a
        href={href}
        className="hlm-ad-banner-cta"
        onClick={() => onCta?.()}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
  }

  return (
    <button type="button" className="hlm-ad-banner-cta" onClick={onCta}>
      {label}
    </button>
  );
}

function adHref(href: string | undefined): href is string {
  return Boolean(href?.trim());
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
  const ctaRaw = ad.ctaLabel?.trim() ?? '';
  const ctaResolved = resolveAdCta(ctaRaw);
  const headline = ad.title?.trim() || ad.sponsor?.trim() || '';
  const shopLine = ad.title?.trim() && ad.sponsor?.trim() && ad.sponsor !== ad.title ? ad.sponsor : '';
  const locationLine = ad.subtitle?.trim() ?? '';

  const metaLine = [locationLine, ctaResolved.phoneDisplay].filter(Boolean).join(' · ');

  return (
    <aside key={`${ad.id}-${townId}`} className="hlm-ad-banner" aria-label={`Ad: ${headline}`}>
      <style>{AD_BANNER_CSS}</style>
      {images.length ? (
        <div className="hlm-ad-banner-media">
          <ImageCarousel
            images={images}
            height={AD_BANNER_H}
            rounded={0}
            fill
            dark
            showDots={images.length > 1}
            dotsBottom={62}
          />
        </div>
      ) : (
        <span className="hlm-ad-banner-fallback">{(headline || 'K').charAt(0).toUpperCase()}</span>
      )}
      <div className="hlm-ad-banner-scrim" aria-hidden />
      <span className="hlm-ad-banner-adtag">Ad</span>
      <div className="hlm-ad-banner-overlay">
        <div className="hlm-ad-banner-copy">
          <h3 className="hlm-ad-banner-headline">{headline || '\u00a0'}</h3>
          {shopLine ? <p className="hlm-ad-banner-shop">{shopLine}</p> : null}
          {metaLine ? <p className="hlm-ad-banner-meta">{metaLine}</p> : null}
        </div>
        {ctaRaw ? <AdCtaControl ctaRaw={ctaRaw} href={ad.href} onCta={onCta} /> : null}
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
  midCarousel: {
    minWidth: 0,
    maxWidth: '100%',
  },
  midCarouselViewport: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    minHeight: AD_BANNER_H,
    touchAction: 'pan-y',
    cursor: 'grab',
    userSelect: 'none',
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(16, 24, 40, 0.1)',
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
};
