import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { productVisual } from '../lib/productVisual';
import { QuantityStepper } from './QuantityStepper';

export type QuickViewProduct = {
  listingId: string;
  name: string;
  shopName: string;
  unit: string;
  priceLabel: string;
  mrpLabel?: string | null;
  discountPercent?: number | null;
  vendorNote?: string | null;
  specialOfferActive?: boolean;
  avgRating?: number;
  ratingCount?: number;
  imageUrl?: string | null;
  imageUrls?: string[];
};

type Props = {
  product: QuickViewProduct;
  quantity: number;
  busy?: boolean;
  onClose: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

/** Bottom-sheet product quick view with swipeable image gallery (no vertical scroll). */
export function ProductQuickView({
  product,
  quantity,
  busy,
  onClose,
  onIncrease,
  onDecrease,
}: Props) {
  const visual = productVisual(product.name);
  const images =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [product.listingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || images.length <= 1) return;
    const idx = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    setActive(Math.max(0, Math.min(images.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setActive(idx);
  };

  const badge = product.specialOfferActive
    ? 'SALE'
    : product.discountPercent && product.discountPercent > 0
      ? `${product.discountPercent}% OFF`
      : null;
  const showRating = (product.ratingCount ?? 0) > 0 && (product.avgRating ?? 0) > 0;

  return (
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-quick-view-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div style={{ ...styles.galleryShell, background: visual.tint }}>
          {badge ? (
            <span style={product.specialOfferActive ? styles.sale : styles.offer}>{badge}</span>
          ) : null}
          {images.length > 0 ? (
            <div
              ref={scrollerRef}
              className="hlm-hide-scrollbar"
              style={styles.scroller}
              onScroll={onScroll}
              aria-label="Product images"
            >
              {images.map((url, i) => (
                <div key={`${url}-${i}`} style={styles.slide}>
                  <img src={url} alt="" style={styles.photo} draggable={false} />
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emojiWrap}>
              <span style={styles.emoji} aria-hidden>
                {visual.emoji}
              </span>
            </div>
          )}
          {images.length > 1 ? (
            <div style={styles.dots} role="tablist" aria-label="Image slides">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Image ${i + 1}`}
                  style={i === active ? styles.dotActive : styles.dot}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div style={styles.body}>
          <p style={styles.shop}>{product.shopName}</p>
          <div style={styles.titleRow}>
            <h2 id="product-quick-view-title" style={styles.name}>
              {product.name}
            </h2>
            {showRating ? (
              <span style={styles.ratingChip}>★ {(product.avgRating ?? 0).toFixed(1)}</span>
            ) : null}
          </div>
          <p style={styles.unit}>
            {product.unit}
            {product.vendorNote ? ` · ${product.vendorNote}` : ''}
          </p>
        </div>

        <div style={styles.footer}>
          <div style={styles.priceBlock}>
            <span style={styles.price}>{product.priceLabel}</span>
            {product.mrpLabel ? <span style={styles.mrp}>{product.mrpLabel}</span> : null}
          </div>
          <QuantityStepper
            quantity={quantity}
            disabled={busy}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 90,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  sheet: {
    position: 'relative',
    width: 'min(360px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    padding: '0.55rem 0.7rem 0.7rem',
    display: 'grid',
    gridTemplateRows: 'auto auto auto',
    gap: '0.4rem',
    boxShadow: 'var(--shadow-elevated)',
    maxHeight: 'min(72vh, 480px)',
    overflow: 'hidden',
  },
  handle: {
    display: 'none',
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: 1,
    color: 'var(--text-muted)',
  },
  galleryShell: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    height: 'min(28vh, 180px)',
  },
  scroller: {
    display: 'flex',
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  },
  slide: {
    flex: '0 0 100%',
    height: '100%',
    scrollSnapAlign: 'start',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    userSelect: 'none',
  },
  emojiWrap: {
    height: '100%',
    display: 'grid',
    placeItems: 'center',
  },
  emoji: { fontSize: '2.2rem', lineHeight: 1 },
  offer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
    background: '#2563EB',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.12rem 0.35rem',
    borderRadius: 6,
  },
  sale: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
    background: '#DC2626',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.12rem 0.35rem',
    borderRadius: 6,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
  },
  dotActive: {
    width: 6,
    height: 6,
    borderRadius: 999,
    border: 'none',
    padding: 0,
    background: 'var(--accent)',
    cursor: 'pointer',
  },
  body: {
    display: 'grid',
    gap: '0.08rem',
    padding: '0 0.1rem',
    minWidth: 0,
  },
  shop: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    minWidth: 0,
  },
  name: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    lineHeight: 1.2,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
    paddingRight: '1.4rem',
  },
  unit: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ratingChip: {
    flex: '0 0 auto',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#92400E',
    background: '#FEF3C7',
    borderRadius: 6,
    padding: '0.1rem 0.3rem',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    paddingTop: '0.05rem',
  },
  priceBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
    minWidth: 0,
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.1rem',
  },
  mrp: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
};
