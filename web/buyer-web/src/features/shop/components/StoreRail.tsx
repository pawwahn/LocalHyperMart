import { useRef, type CSSProperties } from 'react';
import type { CatalogItemView } from '../api/shopApi';
import { ProductCard } from './ProductCard';

type Props = {
  title: string;
  items: CatalogItemView[];
  etaLabel?: string | null;
  quantityFor: (listingId: string) => number;
  busyKey: string | null;
  onOpen: (item: CatalogItemView) => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
  onSeeAll?: () => void;
};

const RAIL_CSS = `
  .store-rail-viewport {
    overflow-x: auto;
    overflow-y: hidden;
    margin: 0 -0.15rem;
    padding: 0.1rem 0.15rem 0.2rem;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
  }
  .store-rail-viewport::-webkit-scrollbar { display: none; }
  .store-rail-track {
    display: flex;
    gap: 0.55rem;
    width: max-content;
  }
  .store-rail-card {
    width: 132px;
    flex: 0 0 132px;
    scroll-snap-align: start;
  }
`;

/** Horizontal merchandising row: title, See all, photo cards. */
export function StoreRail({
  title,
  items,
  etaLabel,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
  onSeeAll,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  return (
    <section style={styles.section} aria-label={title}>
      <style>{RAIL_CSS}</style>
      <div style={styles.head}>
        <h2 style={styles.title}>{title}</h2>
        {onSeeAll ? (
          <button type="button" style={styles.seeAll} onClick={onSeeAll}>
            See All ›
          </button>
        ) : null}
      </div>
      <div ref={viewportRef} className="store-rail-viewport">
        <div className="store-rail-track">
          {items.map((item) => (
            <div key={item.listingId} className="store-rail-card">
              <ProductCard
                layout="store"
                name={item.name}
                shopName={item.shopName}
                unit={item.unit}
                priceLabel={item.priceLabel}
                mrpLabel={item.mrpLabel}
                discountPercent={item.discountPercent}
                specialOfferActive={item.specialOfferActive}
                imageUrl={item.imageUrl}
                etaLabel={etaLabel}
                quantity={quantityFor(item.listingId)}
                busy={busyKey === item.listingId}
                onOpen={() => onOpen(item)}
                onIncrease={() => onIncrease(item.listingId)}
                onDecrease={() => onDecrease(item.listingId)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: 'grid',
    gap: '0.4rem',
    minWidth: 0,
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
  seeAll: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.2rem 0',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
