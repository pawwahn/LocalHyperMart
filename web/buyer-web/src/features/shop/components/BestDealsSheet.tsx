import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fetchCatalogPage,
  filterDealsForLane,
  placeholderDealLanes,
  type CatalogItemView,
} from '../api/shopApi';
import { ProductCard } from './ProductCard';
import { useTown } from '@/shared/town/TownContext';

const DEALS_SHEET_CSS = `
  .hlm-deals-grid {
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(167, 201, 87, 0.14), transparent 55%),
      linear-gradient(180deg, #f6faf6 0%, #ffffff 28%);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem 0.4rem;
  }

  .hlm-deals-grid .hlm-product-card {
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .hlm-deals-grid .hlm-product-card:active {
    transform: scale(0.98);
  }

  @media (min-width: 400px) {
    .hlm-deals-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 560px) {
    .hlm-deals-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      padding-left: 0.65rem !important;
      padding-right: 0.65rem !important;
    }
  }

  @media (min-width: 720px) {
    .hlm-deals-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
`;

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

        <style>{DEALS_SHEET_CSS}</style>
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

          <div style={styles.grid} className="hlm-deals-grid hlm-hide-scrollbar">
            {loadError ? <p style={styles.banner}>{loadError}</p> : null}
            {loading && items.length === 0 ? (
              <p style={styles.empty}>Loading deals…</p>
            ) : items.length === 0 ? (
              <p style={styles.empty}>No deals in this lane yet. Try another price.</p>
            ) : (
              items.map((item) => (
                <div key={item.listingId} style={styles.cardSlot}>
                  <ProductCard
                    layout="rail"
                    compactRail
                    name={item.name}
                    shopName={item.shopName}
                    unit={item.unit}
                    priceLabel={item.priceLabel}
                    mrpLabel={item.mrpLabel}
                    discountPercent={item.discountPercent}
                    specialOfferActive={item.specialOfferActive}
                    avgRating={item.avgRating}
                    ratingCount={item.ratingCount}
                    imageUrl={item.imageUrl}
                    quantity={quantityFor(item.listingId)}
                    busy={busyKey === item.listingId}
                    outOfStock={item.outOfStock}
                    onOpen={() => {}}
                    onIncrease={() => onIncrease(item.listingId)}
                    onDecrease={() => onDecrease(item.listingId)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
    gridTemplateColumns: '72px 1fr',
    minHeight: 0,
    paddingTop: 46,
  },
  rail: {
    background: 'linear-gradient(180deg, #eef5ef 0%, #f8faf8 100%)',
    overflowY: 'auto',
    borderRight: '1px solid #e2ebe3',
    padding: '0.25rem 0 0.6rem',
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
    background: 'linear-gradient(165deg, #7a9f4a 0%, #A7C957 48%, #8fb648 100%)',
    padding: '0.7rem 0.35rem',
    display: 'grid',
    gap: '0.28rem',
    justifyItems: 'center',
    cursor: 'pointer',
    minHeight: 64,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
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
    color: '#1f3312',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  priceChip: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--town-theme, #009111)',
    background: '#fff',
    borderRadius: 5,
    padding: '0.08rem 0.28rem',
    lineHeight: 1.2,
  },
  priceChipActive: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--town-theme, #009111)',
    background: '#fff',
    borderRadius: 5,
    padding: '0.08rem 0.28rem',
    lineHeight: 1.2,
  },
  grid: {
    overflowY: 'auto',
    padding: '0.5rem 0.38rem 1rem',
    display: 'grid',
    alignContent: 'start',
    alignItems: 'start',
    WebkitOverflowScrolling: 'touch',
  },
  cardSlot: {
    minWidth: 0,
    width: '100%',
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
};
