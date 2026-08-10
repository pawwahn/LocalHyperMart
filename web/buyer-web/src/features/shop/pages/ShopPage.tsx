import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import type { CatalogItemView } from '../api/shopApi';
import { ProductCard } from '../components/ProductCard';
import { ProductQuickView } from '../components/ProductQuickView';
import { AISLES, matchesAisle } from '../lib/aisles';
import { useBrowserVoiceSearch } from '../hooks/useBrowserVoiceSearch';
import { useShop } from '../hooks/useShop';

/** Insert a sponsored mid-grid ad after this many product cards (1 full row at 4-up). */
const MID_GRID_AFTER = 4;

const AISLE_TINTS: Record<string, string> = {
  all: '#E7F6EC',
  veg: '#E4F8E6',
  dairy: '#E6F3FF',
  staples: '#FFF4D9',
  snacks: '#FFE9DE',
  drinks: '#DFF8F5',
  home: '#E8F0F4',
};

export function ShopPage() {
  const {
    items,
    cart,
    query,
    setQuery,
    loading,
    busyKey,
    error,
    notice,
    reload,
    quantityFor,
    doIncrease,
    doDecrease,
  } = useShop();
  const [aisleId, setAisleId] = useState('all');
  const [quickView, setQuickView] = useState<CatalogItemView | null>(null);
  const { listening, supported, error: voiceError, toggle: toggleVoice } = useBrowserVoiceSearch(
    (transcript) => setQuery(transcript),
  );

  const visible = useMemo(
    () => items.filter((item) => matchesAisle(item.name, aisleId)),
    [items, aisleId],
  );

  const quickViewLive = useMemo(() => {
    if (!quickView) return null;
    return items.find((i) => i.listingId === quickView.listingId) ?? quickView;
  }, [items, quickView]);

  return (
    <PortalShell
      hideTitle
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
      onRefresh={() => reload()}
    >
      <p style={styles.promise} aria-label="Delivery promise">
        <span style={styles.promiseBadge}>Same-day</span>
        <span style={styles.promiseText}>Groceries from your town · usually 30–45 min</span>
      </p>

      <div style={styles.searchShell}>
        <span style={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          aria-label="Search products"
          placeholder={listening ? 'Listening… say a product' : 'Search milk, maggi, mango…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.search}
        />
        {supported ? (
          <button
            type="button"
            style={listening ? styles.micActive : styles.mic}
            onClick={toggleVoice}
            aria-label={listening ? 'Stop voice search' : 'Voice search'}
            title="Voice search"
          >
            {listening ? '●' : '🎤'}
          </button>
        ) : null}
      </div>
      {voiceError ? <Banner tone="warning">{voiceError}</Banner> : null}
      {listening ? <Banner tone="info">Listening… say something like “milk” or “rice”</Banner> : null}

      <div className="hlm-hide-scrollbar" style={styles.aisles} role="tablist" aria-label="Categories">
        {AISLES.map((aisle) => {
          const active = aisle.id === aisleId;
          const tint = AISLE_TINTS[aisle.id] ?? '#F4F6F8';
          return (
            <button
              key={aisle.id}
              type="button"
              role="tab"
              aria-selected={active}
              style={active ? styles.aisleActive : styles.aisle}
              onClick={() => setAisleId(aisle.id)}
            >
              <span
                className="hlm-aisle-tile"
                style={{
                  ...styles.aisleEmoji,
                  background: tint,
                  ...(active ? styles.aisleEmojiActive : null),
                }}
                aria-hidden
              >
                {aisle.emoji}
              </span>
              <span style={styles.aisleLabel}>{aisle.label}</span>
            </button>
          );
        })}
      </div>

      <AdSlot slot="home_hero" variant="strip" />

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>
          {aisleId === 'all' ? 'For you rn' : AISLES.find((a) => a.id === aisleId)?.label}
        </h2>
        <p style={styles.count}>{visible.length} items</p>
      </div>

      {loading && items.length === 0 ? (
        <LoadingBlock label="Loading fresh catalog…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🥬"
          title="No items in this aisle"
          description={
            aisleId === 'all'
              ? 'Confirm catalog-service is up, then refresh. Vendors can publish listings from the vendor portal.'
              : 'Try another category or clear search.'
          }
          actionLabel={aisleId === 'all' ? 'Refresh' : 'Show all'}
          onAction={() => (aisleId === 'all' ? void reload() : setAisleId('all'))}
        />
      ) : (
        <div style={styles.grid}>
          {visible.flatMap((item, index) => {
            const card = (
              <ProductCard
                key={item.listingId}
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
                onOpen={() => setQuickView(item)}
                onIncrease={() => void doIncrease(item.listingId)}
                onDecrease={() => void doDecrease(item.listingId)}
              />
            );
            if (index !== MID_GRID_AFTER - 1) return [card];
            return [card, <AdSlot key="ad-home-mid-grid" slot="home_mid_grid" variant="card" />];
          })}
        </div>
      )}

      {quickViewLive ? (
        <ProductQuickView
          product={quickViewLive}
          quantity={quantityFor(quickViewLive.listingId)}
          busy={busyKey === quickViewLive.listingId}
          onClose={() => setQuickView(null)}
          onIncrease={() => void doIncrease(quickViewLive.listingId)}
          onDecrease={() => void doDecrease(quickViewLive.listingId)}
        />
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  promise: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.4rem 0.55rem',
  },
  promiseBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.5rem',
    borderRadius: 8,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
  },
  promiseText: {
    fontSize: '0.8rem',
    fontWeight: 650,
    color: 'var(--text)',
    lineHeight: 1.3,
  },
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'var(--bg-elevated)',
    border: '1.5px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    borderRadius: 14,
    padding: '0 0.7rem',
    boxShadow: '0 3px 12px rgba(12, 131, 31, 0.08)',
    minHeight: 44,
  },
  searchIcon: { color: 'var(--accent)', fontSize: '1.05rem', fontWeight: 700 },
  search: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0.55rem 0',
    fontSize: '0.92rem',
    color: 'var(--text)',
    letterSpacing: '-0.015em',
  },
  mic: {
    border: 'none',
    background: 'var(--highlight-soft)',
    width: 30,
    height: 30,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1,
  },
  micActive: {
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    width: 30,
    height: 30,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: 1,
    fontWeight: 800,
  },
  aisles: {
    display: 'flex',
    gap: '0.45rem',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '0.1rem 0.05rem 0.15rem',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    WebkitOverflowScrolling: 'touch',
  },
  aisle: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.22rem',
    minWidth: 56,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.1rem',
  },
  aisleActive: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.22rem',
    minWidth: 56,
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '0.1rem',
  },
  aisleEmoji: {
    width: 50,
    height: 50,
    borderRadius: 16,
    border: '1.5px solid transparent',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.3rem',
    boxShadow: '0 2px 8px rgba(27, 30, 36, 0.06)',
  },
  aisleEmojiActive: {
    borderColor: 'var(--accent)',
    boxShadow: '0 4px 14px rgba(12, 131, 31, 0.2)',
    transform: 'translateY(-2px)',
  },
  aisleLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    textAlign: 'center',
    maxWidth: 64,
    lineHeight: 1.15,
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginTop: 0,
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.12rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  count: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.55rem',
    width: '100%',
    minWidth: 0,
  },
};
