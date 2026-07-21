import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { ProductCard } from '../components/ProductCard';
import { AISLES, matchesAisle } from '../lib/aisles';
import { useBrowserVoiceSearch } from '../hooks/useBrowserVoiceSearch';
import { useShop } from '../hooks/useShop';

/** Insert a sponsored mid-grid ad after this many product cards (1 full row at 3-up). */
const MID_GRID_AFTER = 3;

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
  const { listening, supported, error: voiceError, toggle: toggleVoice } = useBrowserVoiceSearch(
    (transcript) => setQuery(transcript),
  );

  const visible = useMemo(
    () => items.filter((item) => matchesAisle(item.name, aisleId)),
    [items, aisleId],
  );

  return (
    <PortalShell
      hideTitle
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
      onRefresh={() => void reload()}
    >
      <div style={styles.searchShell}>
        <span style={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          aria-label="Search products"
          placeholder={listening ? 'Listening… say a product' : 'Search for atta, dal, milk and more'}
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
                style={{
                  ...styles.aisleEmoji,
                  ...(active
                    ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                    : null),
                }}
                aria-hidden
              >
                {aisle.emoji}
              </span>
              <span>{aisle.label}</span>
            </button>
          );
        })}
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>
          {aisleId === 'all' ? 'Best deals for you' : AISLES.find((a) => a.id === aisleId)?.label}
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
                quantity={quantityFor(item.listingId)}
                busy={busyKey === item.listingId}
                onIncrease={() => void doIncrease(item.listingId)}
                onDecrease={() => void doDecrease(item.listingId)}
              />
            );
            if (index !== MID_GRID_AFTER - 1) return [card];
            return [card, <AdSlot key="ad-home-mid-grid" slot="home_mid_grid" variant="card" />];
          })}
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.15rem 0.85rem',
    boxShadow: 'var(--shadow-card)',
  },
  searchIcon: { color: 'var(--text-muted)', fontSize: '1.15rem', fontWeight: 700 },
  search: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0.85rem 0',
    fontSize: '0.95rem',
    color: 'var(--text)',
  },
  mic: {
    border: '1px solid var(--border)',
    background: 'var(--accent-soft)',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  },
  micActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: 'var(--text-inverse)',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1,
    fontWeight: 800,
  },
  aisles: {
    display: 'flex',
    gap: '0.55rem',
    overflowX: 'auto',
    paddingBottom: '0.15rem',
    margin: '0 -0.15rem',
  },
  aisle: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.3rem',
    minWidth: 72,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0.15rem',
  },
  aisleActive: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.3rem',
    minWidth: 72,
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '0.7rem',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '0.15rem',
    boxShadow: 'inset 0 -2px 0 var(--accent)',
  },
  aisleEmoji: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.45rem',
    boxShadow: 'var(--shadow-card)',
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.5rem',
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  count: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.55rem',
  },
};
