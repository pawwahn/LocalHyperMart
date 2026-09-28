import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fetchCatalogPage,
  filterDealsForLane,
  placeholderDealLanes,
  type CatalogItemView,
} from '../api/shopApi';
import { productVisual } from '../lib/productVisual';
import { QuantityStepper } from './QuantityStepper';
import { useTown } from '@/shared/town/TownContext';

type Props = {
  open: boolean;
  busyKey: string | null;
  quantityFor: (listingId: string) => number;
  rememberItems: (items: CatalogItemView[], mode: 'replace' | 'append') => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
  onClose: () => void;
};

export function BestDealsSheet({
  open,
  busyKey,
  quantityFor,
  rememberItems,
  onIncrease,
  onDecrease,
  onClose,
}: Props) {
  const { townId, dealPrices } = useTown();
  const lanes = useMemo(() => placeholderDealLanes(dealPrices), [dealPrices]);
  const [laneId, setLaneId] = useState('all');
  const [catalog, setCatalog] = useState<CatalogItemView[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const items = useMemo(() => filterDealsForLane(catalog, laneId), [catalog, laneId]);

  useEffect(() => {
    if (!lanes.some((lane) => lane.id === laneId)) {
      setLaneId('all');
    }
  }, [lanes, laneId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !townId) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetchCatalogPage({ townId, page: 0, size: 48, sort: 'price', dir: 'asc' })
      .then((data) => {
        if (cancelled) return;
        setCatalog(data.items);
        rememberItems(data.items, 'append');
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalog([]);
        setLoadError(err instanceof Error ? err.message : 'Could not load deals');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, townId, rememberItems]);

  if (!open) return null;

  return (
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="best-deals-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close deals">
          ×
        </button>
        <h2 id="best-deals-title" style={styles.srOnly}>
          Best deals in your town
        </h2>

        <div style={styles.body}>
          <nav style={styles.rail} className="hlm-hide-scrollbar" aria-label="Deal lanes">
            {lanes.map((lane) => {
              const active = lane.id === laneId;
              return (
                <button
                  key={lane.id}
                  type="button"
                  style={active ? styles.railBtnActive : styles.railBtn}
                  onClick={() => setLaneId(lane.id)}
                >
                  <span style={active ? styles.railLabelActive : styles.railLabel}>{lane.label}</span>
                  {lane.atPrice != null ? (
                    <span style={active ? styles.priceChipActive : styles.priceChip}>₹{lane.atPrice}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div style={styles.grid} className="hlm-hide-scrollbar">
            {loadError ? <p style={styles.banner}>{loadError}</p> : null}
            {loading && items.length === 0 ? (
              <p style={styles.empty}>Loading deals…</p>
            ) : items.length === 0 ? (
              <p style={styles.empty}>No deals in this lane yet. Try another price.</p>
            ) : (
              items.map((item) => (
                <DealCard
                  key={item.listingId}
                  item={item}
                  quantity={quantityFor(item.listingId)}
                  busy={busyKey === item.listingId}
                  onIncrease={() => onIncrease(item.listingId)}
                  onDecrease={() => onDecrease(item.listingId)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DealCard({
  item,
  quantity,
  busy,
  onIncrease,
  onDecrease,
}: {
  item: CatalogItemView;
  quantity: number;
  busy: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const visual = productVisual(item.name);
  const off = savingsAmount(item);
  const showRating = item.ratingCount > 0 && item.avgRating > 0;

  return (
    <article style={styles.card}>
      <div style={{ ...styles.media, background: visual.tint }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" style={styles.photo} />
        ) : (
          <span style={styles.emoji} aria-hidden>
            {visual.emoji}
          </span>
        )}
        <div style={styles.addWrap}>
          <QuantityStepper
            size="xs"
            quantity={quantity}
            disabled={busy}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
          />
        </div>
      </div>
      <div style={styles.cardBody}>
        <div style={styles.priceRow}>
          <span style={styles.priceBadge}>{item.priceLabel.replace('.00', '')}</span>
          {item.mrpLabel ? <span style={styles.mrp}>{item.mrpLabel.replace('.00', '')}</span> : null}
        </div>
        {off != null ? <p style={styles.off}>₹{off} OFF</p> : null}
        <p style={styles.name}>{item.name}</p>
        <p style={styles.unit}>{item.unit}</p>
        {showRating ? (
          <p style={styles.rating}>
            ★ {item.avgRating.toFixed(1)}
            <span style={styles.reviews}>({formatReviews(item.ratingCount)})</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function savingsAmount(item: CatalogItemView): number | null {
  if (!item.mrpLabel) return null;
  const mrp = Number(item.mrpLabel.replace(/[₹,]/g, ''));
  if (!Number.isFinite(mrp) || mrp <= item.price) return null;
  return Math.round(mrp - item.price);
}

function formatReviews(count: number): string {
  if (count >= 1000) return `${Math.round(count / 100) / 10}k`;
  return String(count);
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  sheet: {
    position: 'relative',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    height: 'min(94dvh, 100%)',
    background: '#fff',
    color: '#111',
    borderRadius: '22px 22px 0 0',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    overflow: 'hidden',
    animation: 'hlm-slide-up 220ms ease both',
    boxShadow: '0 -8px 28px rgba(0,0,0,0.28)',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 3,
    width: 34,
    height: 34,
    border: 'none',
    borderRadius: 999,
    background: '#fff',
    color: '#111',
    fontSize: '1.35rem',
    lineHeight: 1,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '76px 1fr',
    minHeight: 0,
    paddingTop: 46,
  },
  rail: {
    background: '#f3f4f6',
    overflowY: 'auto',
    borderRight: '1px solid #ececec',
    padding: '0.2rem 0 0.6rem',
  },
  railBtn: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '0.7rem 0.4rem',
    display: 'grid',
    gap: '0.28rem',
    justifyItems: 'center',
    cursor: 'pointer',
    minHeight: 64,
  },
  railBtnActive: {
    width: '100%',
    border: 'none',
    background: 'var(--town-theme, #0C831F)',
    padding: '0.7rem 0.4rem',
    display: 'grid',
    gap: '0.28rem',
    justifyItems: 'center',
    cursor: 'pointer',
    minHeight: 64,
  },
  railLabel: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  railLabelActive: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: 'var(--town-theme-ink, #fff)',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  priceChip: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--town-theme, #0C831F)',
    background: '#fff',
    borderRadius: 5,
    padding: '0.08rem 0.28rem',
    lineHeight: 1.2,
  },
  priceChipActive: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--town-theme, #0C831F)',
    background: '#fff',
    borderRadius: 5,
    padding: '0.08rem 0.28rem',
    lineHeight: 1.2,
  },
  grid: {
    overflowY: 'auto',
    padding: '0.45rem 0.45rem 1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.7rem 0.5rem',
    alignContent: 'start',
    WebkitOverflowScrolling: 'touch',
  },
  banner: {
    gridColumn: '1 / -1',
    margin: 0,
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    background: '#FDE8EA',
    color: '#E03546',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  empty: {
    gridColumn: '1 / -1',
    margin: '1.4rem 0.4rem',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  card: {
    minWidth: 0,
    display: 'grid',
    gap: '0.28rem',
    alignContent: 'start',
  },
  media: {
    position: 'relative',
    aspectRatio: '1 / 1',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid #ececec',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  emoji: { fontSize: '2.1rem', lineHeight: 1 },
  addWrap: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    zIndex: 2,
  },
  cardBody: { display: 'grid', gap: '0.08rem', minWidth: 0 },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.28rem',
    minWidth: 0,
  },
  priceBadge: {
    background: 'var(--town-theme, #0C831F)',
    color: 'var(--town-theme-ink, #fff)',
    fontWeight: 800,
    fontSize: '0.78rem',
    borderRadius: 6,
    padding: '0.12rem 0.32rem',
    lineHeight: 1.15,
  },
  mrp: {
    color: 'var(--danger)',
    fontSize: '0.72rem',
    fontWeight: 600,
    textDecoration: 'line-through',
  },
  off: {
    margin: 0,
    color: 'var(--town-theme, #0C831F)',
    fontSize: '0.68rem',
    fontWeight: 800,
  },
  name: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 800,
    lineHeight: 1.25,
    color: '#111',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  unit: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 600,
    color: '#6b7280',
  },
  rating: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#374151',
  },
  reviews: { fontWeight: 600, color: '#6b7280', marginLeft: 2 },
};
