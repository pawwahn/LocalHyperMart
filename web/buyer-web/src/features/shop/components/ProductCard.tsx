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
  quantity: number;
  busy?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
};

/** Presentational product tile — compact 3-up mobile grid. */
export function ProductCard({
  name,
  shopName,
  unit,
  priceLabel,
  mrpLabel,
  discountPercent,
  vendorNote,
  specialOfferActive,
  quantity,
  busy,
  onIncrease,
  onDecrease,
}: Props) {
  const visual = productVisual(name);
  const badge = specialOfferActive ? 'SALE' : discountPercent && discountPercent > 0 ? `${discountPercent}% OFF` : null;

  return (
    <article style={styles.card}>
      <div style={{ ...styles.media, background: visual.tint }}>
        {badge ? (
          <span style={specialOfferActive ? styles.sale : styles.offer}>{badge}</span>
        ) : null}
        <span style={styles.emoji} aria-hidden>
          {visual.emoji}
        </span>
        <div style={styles.stepperWrap}>
          <QuantityStepper
            quantity={quantity}
            disabled={busy}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            size="xs"
          />
        </div>
      </div>
      <div style={styles.body}>
        <p style={styles.shop}>{shopName}</p>
        <h3 style={styles.name}>{name}</h3>
        <p style={styles.unit}>{unit}</p>
        {vendorNote ? <p style={styles.note}>{vendorNote}</p> : null}
        <div style={styles.priceRow}>
          <span style={styles.price}>{priceLabel}</span>
          {mrpLabel ? <span style={styles.mrp}>{mrpLabel}</span> : null}
        </div>
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
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
  },
  offer: {
    position: 'absolute',
    top: 4,
    left: 4,
    background: '#2563EB',
    color: '#fff',
    fontSize: '0.55rem',
    fontWeight: 800,
    padding: '0.12rem 0.28rem',
    borderRadius: 3,
    letterSpacing: '0.02em',
    maxWidth: '70%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  sale: {
    position: 'absolute',
    top: 4,
    left: 4,
    background: '#DC2626',
    color: '#fff',
    fontSize: '0.55rem',
    fontWeight: 800,
    padding: '0.12rem 0.28rem',
    borderRadius: 3,
    letterSpacing: '0.02em',
    maxWidth: '70%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  emoji: { fontSize: '1.85rem', lineHeight: 1 },
  stepperWrap: {
    position: 'absolute',
    right: 4,
    bottom: 4,
  },
  body: {
    padding: '0.4rem 0.4rem 0.55rem',
    display: 'grid',
    gap: '0.08rem',
    alignContent: 'start',
    minWidth: 0,
  },
  shop: {
    margin: 0,
    fontSize: '0.55rem',
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
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  unit: {
    margin: 0,
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  note: {
    margin: 0,
    fontSize: '0.58rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.25rem',
    marginTop: '0.2rem',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.82rem',
  },
  mrp: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
};
