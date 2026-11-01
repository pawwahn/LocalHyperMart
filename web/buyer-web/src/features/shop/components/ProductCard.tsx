import type { CSSProperties } from 'react';
import { productInitial, productVisual } from '../lib/productVisual';
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
  /** rail = compact scroller card. store = home merchandising card. */
  layout?: 'grid' | 'rail' | 'store';
  /** Denser rail tile (e.g. best-deals sheet grid). */
  compactRail?: boolean;
  /** Short delivery line on store cards, such as "In 2-4 hrs". */
  etaLabel?: string | null;
  onOpen: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

/** Presentational product tile — 2-up phone grid or horizontal rail. */
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
  layout = 'grid',
  compactRail = false,
  etaLabel,
  onOpen,
  onIncrease,
  onDecrease,
}: Props) {
  const visual = productVisual(name);
  const badge = specialOfferActive ? 'SALE' : discountPercent && discountPercent > 0 ? `${discountPercent}% OFF` : null;
  const showRating = ratingCount > 0 && avgRating > 0;
  const rail = layout === 'rail';
  const store = layout === 'store';
  const dense = rail && compactRail;
  const offerLine = discountPercent && discountPercent > 0 ? `${discountPercent}% OFF` : specialOfferActive ? 'OFFER' : null;

  if (store) {
    return (
      <article className="hlm-product-card" style={styles.cardStore}>
        <div style={{ ...styles.mediaStore, background: imageUrl ? '#fff' : visual.tint }}>
          <button type="button" style={styles.mediaHit} onClick={onOpen} aria-label={`View ${name}`} />
          {imageUrl ? (
            <img src={imageUrl} alt="" style={styles.photoStore} />
          ) : (
            <span style={styles.initial} aria-hidden>
              {productInitial(name)}
            </span>
          )}
          <div style={styles.stepperWrapStore}>
            <QuantityStepper
              quantity={quantity}
              disabled={busy}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
              size="xs"
            />
          </div>
        </div>
        <button type="button" style={styles.bodyHit} onClick={onOpen} aria-label={`View ${name} details`}>
          <div style={styles.bodyStore}>
            <p style={{ ...styles.eta, visibility: etaLabel ? 'visible' : 'hidden' }}>{etaLabel || 'In 2-4 hrs'}</p>
            <h3 style={styles.nameStore}>{name}</h3>
            <p style={styles.unitStore}>{unit}</p>
            <p style={{ ...styles.shopStore, visibility: shopName ? 'visible' : 'hidden' }}>{shopName || 'Shop'}</p>
            <p style={{ ...styles.offerLine, visibility: offerLine ? 'visible' : 'hidden' }} aria-hidden={!offerLine}>
              {offerLine || '0% OFF'}
            </p>
            <div style={styles.priceRowStore}>
              <span style={styles.priceStore}>{priceLabel}</span>
              <span style={{ ...styles.mrpStore, visibility: mrpLabel ? 'visible' : 'hidden' }} aria-hidden={!mrpLabel}>
                {mrpLabel || '₹0'}
              </span>
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <article
      className="hlm-product-card"
      style={dense ? styles.cardRailDense : rail ? styles.cardRail : styles.card}
    >
      <div
        style={{
          ...(dense ? styles.mediaRailDense : rail ? styles.mediaRail : styles.media),
          background: visual.tint,
        }}
      >
        <button type="button" style={styles.mediaHit} onClick={onOpen} aria-label={`View ${name}`} />
        {badge ? (
          <span
            style={
              dense
                ? specialOfferActive
                  ? styles.saleDense
                  : styles.offerDense
                : specialOfferActive
                  ? styles.sale
                  : styles.offer
            }
          >
            {badge}
          </span>
        ) : null}
        {imageUrl ? (
          <img src={imageUrl} alt="" style={dense ? styles.photoDense : styles.photoContain} />
        ) : (
          <span style={dense ? styles.initialDense : rail ? styles.initialRail : styles.initial} aria-hidden>
            {productInitial(name)}
          </span>
        )}
        {imageCount > 1 ? (
          <span style={dense ? styles.multiDense : rail ? styles.multiRail : styles.multi}>{imageCount}</span>
        ) : null}
        <div style={dense ? styles.stepperWrapDense : rail ? styles.stepperWrapRail : styles.stepperWrap}>
          <QuantityStepper
            quantity={quantity}
            disabled={busy}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            size={rail ? 'xs' : 'sm'}
            addMode={dense ? 'icon' : 'label'}
          />
        </div>
      </div>
      <button type="button" style={styles.bodyHit} onClick={onOpen} aria-label={`View ${name} details`}>
        <div style={dense ? styles.bodyRailDense : rail ? styles.bodyRail : styles.body}>
          <p
            style={{
              ...(dense ? styles.shopDense : styles.shop),
              visibility: shopName ? 'visible' : 'hidden',
            }}
          >
            {shopName || 'Shop'}
          </p>
          <h3 style={dense ? styles.nameRailDense : rail ? styles.nameRail : styles.name}>{name}</h3>
          <p style={dense ? styles.unitRailDense : rail ? styles.unitRail : styles.unit}>{unit}</p>
          {showRating && !rail ? (
            <div style={styles.ratingRow}>
              <span style={styles.ratingChip}>★ {avgRating.toFixed(1)}</span>
            </div>
          ) : null}
          {vendorNote && !rail ? <p style={styles.note}>{vendorNote}</p> : null}
          <div style={dense ? styles.priceRowRailDense : rail ? styles.priceRowRail : styles.priceRow}>
            <span style={dense ? styles.priceRailDense : rail ? styles.priceRail : styles.price}>{priceLabel}</span>
            <span
              style={{
                ...styles.mrp,
                ...(dense ? styles.mrpDense : {}),
                visibility: mrpLabel ? 'visible' : 'hidden',
              }}
              aria-hidden={!mrpLabel}
            >
              {mrpLabel || '₹0'}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
    boxShadow: 'var(--shadow-card)',
  },
  cardRail: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    width: 132,
    flex: '0 0 132px',
    minWidth: 132,
    boxShadow: 'var(--shadow-card)',
  },
  cardRailDense: {
    background: '#fff',
    border: '1px solid color-mix(in srgb, var(--border) 90%, #fff)',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    width: '100%',
    minWidth: 0,
    boxShadow: '0 2px 10px rgba(16, 24, 40, 0.07)',
  },
  mediaRailDense: {
    position: 'relative',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    overflow: 'hidden',
    padding: '0.28rem 0.22rem 1.85rem',
    boxSizing: 'border-box',
  },
  initialDense: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 700,
    lineHeight: 1,
    color: 'color-mix(in srgb, var(--text) 55%, var(--text-muted))',
  },
  multiDense: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 999,
    background: 'rgba(2, 6, 12, 0.72)',
    color: '#fff',
    fontSize: '0.5rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    padding: '0 0.18rem',
    pointerEvents: 'none',
  },
  offerDense: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 2,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.48rem',
    fontWeight: 800,
    padding: '0.12rem 0.28rem',
    borderRadius: 5,
    letterSpacing: '0.02em',
    maxWidth: '78%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  },
  saleDense: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 2,
    background: '#111',
    color: 'var(--highlight)',
    fontSize: '0.48rem',
    fontWeight: 800,
    padding: '0.12rem 0.28rem',
    borderRadius: 5,
    letterSpacing: '0.03em',
    maxWidth: '78%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
  },
  stepperWrapDense: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    zIndex: 3,
  },
  bodyRailDense: {
    padding: '0.26rem 0.28rem 0.32rem',
    display: 'grid',
    gap: '0.03rem',
    alignContent: 'start',
    minWidth: 0,
    minHeight: '4.65rem',
  },
  shopDense: {
    margin: 0,
    fontSize: '0.48rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minHeight: '0.85em',
  },
  nameRailDense: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.62rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
    minHeight: '2.35em',
  },
  unitRailDense: {
    margin: 0,
    fontSize: '0.52rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  priceRowRailDense: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.12rem',
    marginTop: '0.06rem',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  priceRailDense: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.68rem',
    letterSpacing: '-0.03em',
    color: 'var(--accent)',
  },
  mrpDense: {
    fontSize: '0.52rem',
  },
  media: {
    position: 'relative',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  mediaRail: {
    position: 'relative',
    aspectRatio: '1 / 0.96',
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
  photoContain: {
    width: '86%',
    height: '86%',
    objectFit: 'contain',
    display: 'block',
  },
  photoDense: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    objectPosition: 'center center',
    display: 'block',
    pointerEvents: 'none',
  },
  initial: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 700,
    lineHeight: 1,
    color: 'color-mix(in srgb, var(--text) 50%, var(--text-muted))',
  },
  initialRail: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.1rem',
    fontWeight: 700,
    lineHeight: 1,
    color: 'color-mix(in srgb, var(--text) 50%, var(--text-muted))',
  },
  multi: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    background: 'rgba(2, 6, 12, 0.72)',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    padding: '0 0.3rem',
    pointerEvents: 'none',
  },
  multiRail: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: 'rgba(2, 6, 12, 0.72)',
    color: '#fff',
    fontSize: '0.55rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    padding: '0 0.22rem',
    pointerEvents: 'none',
  },
  offer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.2rem 0.4rem',
    borderRadius: 7,
    letterSpacing: '0.02em',
    maxWidth: '72%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  },
  sale: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    background: '#111',
    color: 'var(--highlight)',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.2rem 0.4rem',
    borderRadius: 7,
    letterSpacing: '0.04em',
    maxWidth: '72%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  },
  stepperWrap: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 3,
  },
  stepperWrapRail: {
    position: 'absolute',
    right: 5,
    bottom: 5,
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
    padding: '0.55rem 0.6rem 0.7rem',
    display: 'grid',
    gap: '0.1rem',
    alignContent: 'start',
    minWidth: 0,
  },
  bodyRail: {
    padding: '0.38rem 0.45rem 0.48rem',
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    minWidth: 0,
    minHeight: '5.35rem',
  },
  shop: {
    margin: 0,
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minHeight: '0.95em',
  },
  name: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.9rem',
    fontWeight: 700,
    lineHeight: 1.22,
    letterSpacing: '-0.025em',
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  },
  nameRail: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.8rem',
    fontWeight: 700,
    lineHeight: 1.22,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
    minHeight: '2.45em',
  },
  unit: {
    margin: 0,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  unitRail: {
    margin: 0,
    fontSize: '0.66rem',
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
    marginTop: '0.1rem',
  },
  ratingChip: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(180deg, #1BA672 0%, #128540 100%)',
    borderRadius: 6,
    padding: '0.12rem 0.35rem',
    whiteSpace: 'nowrap',
  },
  note: {
    margin: 0,
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    marginTop: '0.28rem',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  priceRowRail: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.22rem',
    marginTop: '0.12rem',
    minWidth: 0,
  },
  price: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
    letterSpacing: '-0.03em',
    color: 'var(--accent)',
  },
  priceRail: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.92rem',
    letterSpacing: '-0.03em',
    color: 'var(--accent)',
  },
  mrp: {
    fontSize: '0.72rem',
    color: 'var(--danger)',
    textDecoration: 'line-through',
  },
  cardStore: {
    background: '#fff',
    border: 'none',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    width: '100%',
    minWidth: 0,
    height: '100%',
    alignSelf: 'stretch',
  },
  mediaStore: {
    position: 'relative',
    aspectRatio: '1 / 0.92',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
  },
  photoStore: {
    width: '88%',
    height: '88%',
    objectFit: 'contain',
    display: 'block',
  },
  stepperWrapStore: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    zIndex: 3,
  },
  bodyStore: {
    padding: '0.38rem 0.1rem 0.15rem',
    display: 'grid',
    gap: '0.08rem',
    alignContent: 'start',
    minWidth: 0,
    minHeight: '6.85rem',
  },
  eta: {
    margin: 0,
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.01em',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nameStore: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    minHeight: '1.9em',
  },
  unitStore: {
    margin: 0,
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shopStore: {
    margin: 0,
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minHeight: '0.95em',
  },
  offerLine: {
    margin: '0.12rem 0 0',
    paddingTop: '0.18rem',
    minHeight: '1.32rem',
    borderTop: '1px dashed color-mix(in srgb, var(--border) 85%, transparent)',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.01em',
    color: 'var(--accent)',
    lineHeight: 1.2,
  },
  priceRowStore: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.28rem',
    minWidth: 0,
  },
  priceStore: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.92rem',
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  mrpStore: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
};
