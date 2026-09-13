import type { CSSProperties } from 'react';
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

/** Horizontal “bestsellers” strip — Zepto / Instamart home rail. */
export function ProductRail({
  title,
  items,
  quantityFor,
  busyKey,
  onOpen,
  onIncrease,
  onDecrease,
}: Props) {
  if (items.length === 0) return null;

  return (
    <section style={styles.section} aria-label={title}>
      <h2 style={styles.title}>{title}</h2>
      <div className="hlm-hide-scrollbar" style={styles.row}>
        {items.map((item) => (
          <ProductCard
            key={item.listingId}
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
        ))}
      </div>
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
  row: {
    display: 'flex',
    gap: '0.5rem',
    overflowX: 'auto',
    paddingBottom: '0.15rem',
    margin: '0 -0.15rem',
    paddingLeft: '0.15rem',
    paddingRight: '0.15rem',
  },
};
