import { useMemo, type CSSProperties } from 'react';
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

const RAIL_TILE_W = 148;
const RAIL_GAP = 8;
const RAIL_STEP = RAIL_TILE_W + RAIL_GAP;
/** Pixels per second — lower = slower scroll. */
const MARQUEE_SPEED = 32;

const RAIL_CSS = `
  @keyframes product-rail-marquee {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }
  .product-rail-viewport {
    overflow: hidden;
    margin: 0 -0.15rem;
    padding: 0 0.15rem 0.15rem;
  }
  .product-rail-track {
    display: flex;
    gap: 0.5rem;
    width: max-content;
    will-change: transform;
    animation: product-rail-marquee var(--product-rail-marquee-duration, 28s) linear infinite;
  }
  .product-rail-viewport:hover .product-rail-track,
  .product-rail-viewport:focus-within .product-rail-track {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .product-rail-track { animation: none; }
    .product-rail-viewport { overflow-x: auto; }
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

/** Horizontal “bestsellers” strip — continuous right-to-left marquee. */
export function ProductRail({
  title,
  items,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
}: Props) {
  const marqueeItems = useMemo(
    () => (items.length > 1 ? [...items, ...items] : items),
    [items],
  );

  const marqueeDurationSec = useMemo(() => {
    if (items.length <= 1) return 0;
    const loopWidth = items.length * RAIL_STEP;
    return Math.max(loopWidth / MARQUEE_SPEED, 14);
  }, [items.length]);

  const marqueeStyle = useMemo(
    () =>
      ({
        '--product-rail-marquee-duration': `${marqueeDurationSec}s`,
      }) as CSSProperties,
    [marqueeDurationSec],
  );

  if (items.length === 0) return null;

  const cardProps = {
    quantityFor,
    busyKey,
    onOpen,
    onIncrease,
    onDecrease,
  };

  return (
    <section style={styles.section} aria-label={title}>
      <style>{RAIL_CSS}</style>
      <h2 style={styles.title}>{title}</h2>
      {items.length === 1 ? (
        <div className="product-rail-viewport">
          <div style={styles.staticRow}>
            <RailCard item={items[0]} {...cardProps} />
          </div>
        </div>
      ) : (
        <div className="product-rail-viewport">
          <div className="product-rail-track" style={marqueeStyle}>
            {marqueeItems.map((item, i) => (
              <RailCard key={`${item.listingId}-${i}`} item={item} {...cardProps} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'grid', gap: '0.45rem', minWidth: 0 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  staticRow: {
    display: 'flex',
    gap: '0.5rem',
  },
};
