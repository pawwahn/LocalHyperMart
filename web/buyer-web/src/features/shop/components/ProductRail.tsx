import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { CatalogItemView } from '../api/shopApi';
import { ProductCard } from './ProductCard';

type Props = {
  title: string;
  items: CatalogItemView[];
  quantityFor: (listingId: string) => number;
  busyKey: string | null;
  onOpen: (item: CatalogItemView) => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
  /** Keep the row creeping so more products come into view. */
  autoMove?: boolean;
};

const RAIL_CSS = `
  .product-rail-viewport {
    overflow-x: auto;
    overflow-y: hidden;
    margin: 0 -0.15rem;
    padding: 0 0.15rem 0.15rem;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
  }
  .product-rail-viewport.product-rail-viewport--auto {
    scroll-snap-type: none;
    scroll-behavior: auto;
  }
  .product-rail-track > * {
    scroll-snap-align: start;
  }
  .product-rail-viewport::-webkit-scrollbar { display: none; }
  .product-rail-track {
    display: flex;
    gap: 0.5rem;
    width: max-content;
  }
  @media (min-width: 1024px) {
    .product-rail-viewport {
      margin: 0;
      padding: 0 0 0.2rem;
    }
    .product-rail-track {
      gap: 0.65rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .product-rail-viewport.product-rail-viewport--auto {
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
    }
  }
`;

function RailCard({
  item,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
}: {
  item: CatalogItemView;
  quantityFor: (listingId: string) => number;
  busyKey: string | null;
  onOpen: (item: CatalogItemView) => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
}) {
  return (
    <ProductCard
      layout="rail"
      name={item.name}
      shopName={item.shopName}
      unit={item.unit}
      priceLabel={item.priceLabel}
      mrpLabel={item.mrpLabel}
      discountPercent={item.discountPercent}
      vendorNote={item.vendorNote}
      specialOfferActive={item.specialOfferActive}
      avgRating={item.avgRating}
      ratingCount={item.ratingCount}
      imageUrl={item.imageUrl}
      imageCount={item.imageUrls.length}
      quantity={quantityFor(item.listingId)}
      busy={busyKey === item.listingId}
      onOpen={() => onOpen(item)}
      onIncrease={() => onIncrease(item.listingId)}
      onDecrease={() => onDecrease(item.listingId)}
    />
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Horizontal product strip. Swipe or use the arrows. Auto rails keep creeping. */
export function ProductRail({
  title,
  items,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
  autoMove = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);
  const [hold, setHold] = useState(false);

  function pauseAuto(ms?: number) {
    pausedRef.current = true;
    setHold(true);
    if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
    if (ms != null) {
      resumeTimer.current = window.setTimeout(() => {
        pausedRef.current = false;
        setHold(false);
      }, ms);
    }
  }

  function resumeAuto() {
    if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
    pausedRef.current = false;
    setHold(false);
  }

  useEffect(() => {
    if (!autoMove || items.length < 3 || prefersReducedMotion()) return;
    const el = viewportRef.current;
    if (!el) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 48);
      last = now;
      if (!pausedRef.current && el.scrollWidth > el.clientWidth + 8) {
        el.scrollLeft += dt * 0.038;
        const loopAt = el.scrollWidth / 2;
        if (loopAt > 0 && el.scrollLeft >= loopAt) {
          el.scrollLeft -= loopAt;
        }
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [autoMove, items]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  function nudge(dir: -1 | 1) {
    const el = viewportRef.current;
    if (!el || items.length <= 1) return;
    pauseAuto(4000);
    const distance = Math.max(Math.round(el.clientWidth * 0.82), 126);
    el.scrollBy({ left: dir * distance, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function onPointerEnter() {
    if (autoMove) pauseAuto();
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (!autoMove) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    resumeAuto();
  }

  if (items.length === 0) return null;

  const cardProps = {
    quantityFor,
    busyKey,
    onOpen,
    onIncrease,
    onDecrease,
  };
  const canMove = items.length > 1;
  const loop = autoMove && items.length >= 3 && !prefersReducedMotion();
  const shown = loop ? [...items, ...items] : items;

  return (
    <section style={styles.section} aria-label={title}>
      <style>{RAIL_CSS}</style>
      <div style={styles.head}>
        <h2 style={styles.title}>{title}</h2>
        {canMove ? (
          <div style={styles.arrows}>
            <button
              type="button"
              style={styles.arrow}
              aria-label="Show previous products"
              onClick={() => nudge(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              style={styles.arrow}
              aria-label="Show next products"
              onClick={() => nudge(1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={viewportRef}
        className={`product-rail-viewport${loop ? ' product-rail-viewport--auto' : ''}`}
        data-paused={hold ? 'true' : 'false'}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={() => {
          if (autoMove) pauseAuto();
        }}
        onPointerUp={() => {
          if (autoMove) pauseAuto(2400);
        }}
      >
        <div className="product-rail-track">
          {shown.map((item, index) => (
            <RailCard
              key={`${item.listingId}:${index < items.length ? 'a' : 'b'}`}
              item={item}
              {...cardProps}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: 'grid',
    gap: '0.35rem',
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
    isolation: 'isolate',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
    minWidth: 0,
  },
  arrows: {
    display: 'flex',
    gap: '0.3rem',
    flexShrink: 0,
  },
  arrow: {
    width: 40,
    height: 40,
    padding: 0,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '1.35rem',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
};
