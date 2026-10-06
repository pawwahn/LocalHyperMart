import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
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
};

const RAIL_TILE_W = 118;
const RAIL_GAP = 8;
const RAIL_STEP = RAIL_TILE_W + RAIL_GAP;
/** Pixels per second — lower = slower scroll. */
const MARQUEE_SPEED = 27;
/** How long auto-scroll stays still after an arrow press. */
const MANUAL_HOLD_MS = 6000;

const RAIL_CSS = `
  .product-rail-viewport {
    overflow-x: auto;
    overflow-y: hidden;
    margin: 0 -0.15rem;
    padding: 0 0.15rem 0.15rem;
    scrollbar-width: none;
    scroll-behavior: auto;
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

/** Horizontal bestsellers strip. Auto-scrolls, with arrows to jump either way. */
export function ProductRail({
  title,
  items,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const holdUntilRef = useRef(0);

  const marqueeItems = useMemo(
    () => (items.length > 1 ? [...items, ...items] : items),
    [items],
  );

  useEffect(() => {
    if (items.length <= 1) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const el = viewportRef.current;
      const dt = Math.min(now - last, 48);
      last = now;
      if (el && !pausedRef.current && now >= holdUntilRef.current) {
        el.scrollLeft += (MARQUEE_SPEED * dt) / 1000;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [items.length]);

  function nudge(dir: -1 | 1) {
    const el = viewportRef.current;
    if (!el || items.length <= 1) return;
    holdUntilRef.current = performance.now() + MANUAL_HOLD_MS;
    const half = el.scrollWidth / 2;
    const distance = Math.max(Math.round(el.clientWidth * 0.82), RAIL_STEP);
    if (dir < 0 && el.scrollLeft < distance) {
      el.scrollLeft += half;
    } else if (dir > 0 && half > 0 && el.scrollLeft + distance > half) {
      el.scrollLeft -= half;
    }
    el.scrollBy({ left: dir * distance, behavior: 'smooth' });
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
        className="product-rail-viewport"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onTouchStart={() => {
          holdUntilRef.current = performance.now() + MANUAL_HOLD_MS;
        }}
      >
        <div className="product-rail-track">
          {(canMove ? marqueeItems : items).map((item, i) => (
            <RailCard key={`${item.listingId}-${i}`} item={item} {...cardProps} />
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
