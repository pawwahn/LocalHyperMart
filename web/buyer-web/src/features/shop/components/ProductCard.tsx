import type { CSSProperties } from 'react';
import { productVisual } from '../lib/productVisual';
import { QuantityStepper } from './QuantityStepper';

type Props = {
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
  imageCount?: number;
  quantity: number;
  busy?: boolean;
  onOpen: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

/** Presentational product tile — 2-up phone grid. */
export function ProductCard({
  name,
  shopName,
  unit,
  priceLabel,
  mrpLabel,
  discountPercent,
  vendorNote,
  specialOfferActive,
  avgRating = 0,
  ratingCount = 0,
  imageUrl,
  imageCount = 0,
  quantity,
  busy,
  onOpen,
  onIncrease,
  onDecrease,
}: Props) {
  const visual = productVisual(name);
  const badge = specialOfferActive ? 'SALE' : discountPercent && discountPercent > 0 ? `${discountPercent}% OFF` : null;
  const showRating = ratingCount > 0 && avgRating > 0;

  return (
    <article style={styles.card}>
      <div style={{ ...styles.media, background: visual.tint }}>
        <button type="button" style={styles.mediaHit} onClick={onOpen} aria-label={`View ${name}`} />
        {badge ? (
          <span style={specialOfferActive ? styles.sale : styles.offer}>{badge}</span>
        ) : null}
        {imageUrl ? (
          <img src={imageUrl} alt="" style={styles.photo} />
        ) : (
          <span style={styles.emoji} aria-hidden>
            {visual.emoji}
          </span>
        )}
        {imageCount > 1 ? <span style={styles.multi}>{imageCount}</span> : null}
        <div style={styles.stepperWrap}>
          <QuantityStepper
            quantity={quantity}
            disabled={busy}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            size="sm"
          />
        </div>
      </div>
      <button type="button" style={styles.bodyHit} onClick={onOpen} aria-label={`View ${name} details`}>
        <div style={styles.body}>
          <p style={styles.shop}>{shopName}</p>
          <h3 style={styles.name}>{name}</h3>
          <p style={styles.unit}>{unit}</p>
          {showRating ? (
            <div style={styles.ratingRow}>
              <span style={styles.ratingChip}>★ {avgRating.toFixed(1)}</span>
            </div>
          ) : null}
          {vendorNote ? <p style={styles.note}>{vendorNote}</p> : null}
          <div style={styles.priceRow}>
            <span style={styles.price}>{priceLabel}</span>
            {mrpLabel ? <span style={styles.mrp}>{mrpLabel}</span> : null}
          </div>
        </div>
      </button>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
    animation: 'hlm-fade-up 240ms ease both',
  },
  media: {
    position: 'relative',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  mediaHit: {
    position: 'absolute',
    inset: 0,
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    zIndex: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  emoji: { fontSize: '1.35rem', lineHeight: 1 },
  multi: {
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#fff',
    fontSize: '0.52rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    padding: '0 0.2rem',
    pointerEvents: 'none',
  },
  offer: {
    position: 'absolute',
    top: 3,
    left: 3,
    zIndex: 2,
    background: '#2563EB',
    color: '#fff',
    fontSize: '0.48rem',
    fontWeight: 800,
    padding: '0.1rem 0.22rem',
    borderRadius: 3,
    letterSpacing: '0.01em',
    maxWidth: '70%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
  },
  sale: {
    position: 'absolute',
    top: 3,
    left: 3,
    zIndex: 2,
    background: '#DC2626',
    color: '#fff',
    fontSize: '0.48rem',
    fontWeight: 800,
    padding: '0.1rem 0.22rem',
    borderRadius: 3,
    letterSpacing: '0.01em',
    maxWidth: '70%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  stepperWrap: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    zIndex: 3,
  },
  bodyHit: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    font: 'inherit',
    width: '100%',
  },
  body: {
    padding: '0.3rem 0.28rem 0.4rem',
    display: 'grid',
    gap: '0.05rem',
    alignContent: 'start',
    minWidth: 0,
  },
  shop: {
    margin: 0,
    fontSize: '0.5rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 700,
    lineHeight: 1.2,
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  unit: {
    margin: 0,
    fontSize: '0.55rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
    minWidth: 0,
    marginTop: '0.05rem',
  },
  ratingChip: {
    fontSize: '0.55rem',
    fontWeight: 800,
    color: '#92400E',
    background: '#FEF3C7',
    borderRadius: 3,
    padding: '0.05rem 0.2rem',
    whiteSpace: 'nowrap',
  },
  note: {
    margin: 0,
    fontSize: '0.5rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.18rem',
    marginTop: '0.12rem',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.72rem',
  },
  mrp: {
    fontSize: '0.52rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
};
