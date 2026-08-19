import { useMemo, type CSSProperties } from 'react';
import type { CatalogItemView } from '../api/shopApi';
import { productVisual } from '../lib/productVisual';
import { QuantityStepper } from './QuantityStepper';

const TILE_W = 108;
const TILE_GAP = 9;
const TILE_STEP = TILE_W + TILE_GAP;
const SHELF_H = 88;
/** Pixels moved per second — lower = slower marquee. */
const MARQUEE_SPEED = 28;

const STRIP_CSS = `
  @keyframes cart-suggest-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes cart-suggest-marquee {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }
  .cart-suggest-skeleton {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--border) 55%, transparent) 25%,
      color-mix(in srgb, var(--border) 25%, transparent) 50%,
      color-mix(in srgb, var(--border) 55%, transparent) 75%
    );
    background-size: 200% 100%;
    animation: cart-suggest-shimmer 1.2s ease-in-out infinite;
  }
  .cart-suggest-viewport {
    overflow: hidden;
    margin-inline: -0.85rem;
    padding-inline: 0.85rem;
    padding-bottom: 0.75rem;
  }
  .cart-suggest-track {
    display: flex;
    gap: 0.55rem;
    width: max-content;
    will-change: transform;
    animation: cart-suggest-marquee var(--cart-suggest-marquee-duration, 24s) linear infinite;
  }
  .cart-suggest-viewport:hover .cart-suggest-track,
  .cart-suggest-viewport:focus-within .cart-suggest-track {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .cart-suggest-track { animation: none; }
  }
`;

type Props = {
  items: CatalogItemView[];
  loading: boolean;
  busyKey: string | null;
  quantityFor: (listingId: string) => number;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
  onBrowseMore: () => void;
};

function SkeletonTiles() {
  return (
    <div style={styles.staticRow}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={styles.tile} aria-hidden>
          <div className="cart-suggest-skeleton" style={styles.skeletonShelf} />
          <div className="cart-suggest-skeleton" style={styles.skeletonLine} />
          <div className="cart-suggest-skeleton" style={styles.skeletonLineShort} />
        </div>
      ))}
    </div>
  );
}

type TileProps = {
  item: CatalogItemView;
  busyKey: string | null;
  quantityFor: (listingId: string) => number;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
};

function SuggestionTile({ item, busyKey, quantityFor, onIncrease, onDecrease }: TileProps) {
  const visual = productVisual(item.name);
  const qty = quantityFor(item.listingId);
  const discount = item.discountPercent && item.discountPercent > 0 ? item.discountPercent : null;
  const busy = busyKey === item.listingId;

  return (
    <article style={styles.tile}>
      <div style={styles.shelf}>
        {discount ? <span style={styles.discountPill}>{discount}% off</span> : null}
        <div style={styles.shelfInner}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" style={styles.photo} />
          ) : (
            <span style={styles.emoji} aria-hidden>
              {visual.emoji}
            </span>
          )}
        </div>
        <div style={qty > 0 ? styles.stepperActive : styles.stepperAdd}>
          <QuantityStepper
            size="xs"
            addMode="icon"
            quantity={qty}
            disabled={busy}
            onIncrease={() => onIncrease(item.listingId)}
            onDecrease={() => onDecrease(item.listingId)}
          />
        </div>
      </div>

      <div style={styles.meta}>
        <p style={styles.name}>{item.name}</p>
        <p style={styles.unit}>{formatUnit(item.unit)}</p>
        <div style={styles.priceRow}>
          <span style={styles.price}>{item.priceLabel}</span>
          {item.mrpLabel ? <span style={styles.mrp}>{item.mrpLabel}</span> : null}
        </div>
      </div>
    </article>
  );
}

export function CartSuggestionStrip({
  items,
  loading,
  busyKey,
  quantityFor,
  onIncrease,
  onDecrease,
  onBrowseMore,
}: Props) {
  const marqueeItems = useMemo(
    () => (items.length > 1 ? [...items, ...items] : items),
    [items],
  );

  const marqueeDurationSec = useMemo(() => {
    if (items.length <= 1) return 0;
    const loopWidth = items.length * TILE_STEP;
    return Math.max(loopWidth / MARQUEE_SPEED, 12);
  }, [items.length]);

  const marqueeStyle = useMemo(
    () =>
      ({
        '--cart-suggest-marquee-duration': `${marqueeDurationSec}s`,
      }) as CSSProperties,
    [marqueeDurationSec],
  );

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section style={styles.section} aria-label="Suggested for your basket">
      <style>{STRIP_CSS}</style>

      <div style={styles.head}>
        <h3 style={styles.title}>You may also need</h3>
        <button type="button" style={styles.seeAllBtn} onClick={onBrowseMore}>
          See all
          <span aria-hidden style={styles.chevron}>
            ›
          </span>
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="cart-suggest-viewport">
          <SkeletonTiles />
        </div>
      ) : items.length === 1 ? (
        <div className="cart-suggest-viewport">
          <div style={styles.staticRow}>
            <SuggestionTile
              item={items[0]}
              busyKey={busyKey}
              quantityFor={quantityFor}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
            />
          </div>
        </div>
      ) : (
        <div className="cart-suggest-viewport">
          <div className="cart-suggest-track" style={marqueeStyle}>
            {marqueeItems.map((item, i) => (
              <SuggestionTile
                key={`${item.listingId}-${i}`}
                item={item}
                busyKey={busyKey}
                quantityFor={quantityFor}
                onIncrease={onIncrease}
                onDecrease={onDecrease}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function formatUnit(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return '';
  if (/^piece$/i.test(trimmed)) return '1 pc';
  if (/^pack$/i.test(trimmed)) return '1 pack';
  return trimmed.toLowerCase();
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: 'grid',
    gap: '0.55rem',
    minWidth: 0,
    paddingTop: '0.15rem',
    borderTop: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
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
    fontWeight: 800,
    fontSize: '0.92rem',
    lineHeight: 1.2,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  seeAllBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.1rem',
    flexShrink: 0,
  },
  chevron: {
    fontSize: '1rem',
    lineHeight: 1,
    marginTop: '-0.05rem',
  },
  staticRow: {
    display: 'flex',
    gap: '0.55rem',
  },
  tile: {
    flex: `0 0 ${TILE_W}px`,
    width: TILE_W,
    display: 'grid',
    gap: '0.35rem',
    alignContent: 'start',
  },
  shelf: {
    position: 'relative',
    width: '100%',
    height: SHELF_H,
    borderRadius: 12,
    overflow: 'visible',
    background: 'color-mix(in srgb, #ffffff 90%, var(--bg-muted))',
    border: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
    boxShadow: '0 1px 0 color-mix(in srgb, #fff 40%, transparent) inset',
  },
  shelfInner: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    padding: '0.35rem',
    boxSizing: 'border-box',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  emoji: {
    fontSize: '2rem',
    lineHeight: 1,
    opacity: 0.72,
  },
  discountPill: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    padding: '0.12rem 0.32rem',
    borderRadius: 6,
    background: 'color-mix(in srgb, #047857 88%, #000)',
    color: '#ecfdf5',
    fontSize: '0.56rem',
    fontWeight: 800,
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    textTransform: 'lowercase',
  },
  stepperAdd: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  stepperActive: {
    position: 'absolute',
    left: '50%',
    bottom: -12,
    transform: 'translateX(-50%)',
    zIndex: 3,
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))',
  },
  meta: {
    display: 'grid',
    gap: '0.14rem',
    minHeight: 58,
    alignContent: 'start',
  },
  name: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    minHeight: '2.5em',
  },
  unit: {
    margin: 0,
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minHeight: '0.95em',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.22rem',
    flexWrap: 'nowrap',
    minHeight: '1.05em',
    marginTop: '0.02rem',
  },
  price: {
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--text)',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  mrp: {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  skeletonShelf: {
    width: '100%',
    height: SHELF_H,
    borderRadius: 12,
  },
  skeletonLine: {
    width: '88%',
    height: 10,
    borderRadius: 6,
  },
  skeletonLineShort: {
    width: '55%',
    height: 10,
    borderRadius: 6,
  },
};
