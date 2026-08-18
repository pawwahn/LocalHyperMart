import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useTown } from '@/shared/town/TownContext';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import {
  fetchCatalogPage,
  fetchCategories,
  type CatalogItemView,
  type CategoryView,
} from '../api/shopApi';
import { CategoryTile } from '../components/CategoryTile';
import { ProductCard } from '../components/ProductCard';
import { ProductQuickView } from '../components/ProductQuickView';
import { emojiForCategory } from '../lib/aisles';
import { useBrowserVoiceSearch } from '../hooks/useBrowserVoiceSearch';
import { useShop } from '../hooks/useShop';

const SEARCH_HINTS = ['Egg', 'Bread', 'Milk', 'Rice', 'Maggi', 'Tomato'];
const PAGE_SIZE = 24;

type CatSort = 'az' | 'za';
type ItemSort = 'name-az' | 'name-za' | 'price-asc' | 'price-desc' | 'rating';

type Props = {
  /** Categories tab: skip promo banners, keep the directory. */
  browseOnly?: boolean;
};

function sortParams(sort: ItemSort): { sort: string; dir: string } {
  if (sort === 'name-za') return { sort: 'name', dir: 'desc' };
  if (sort === 'price-asc') return { sort: 'price', dir: 'asc' };
  if (sort === 'price-desc') return { sort: 'price', dir: 'desc' };
  if (sort === 'rating') return { sort: 'rating', dir: 'desc' };
  return { sort: 'name', dir: 'asc' };
}

export function ShopPage({ browseOnly = false }: Props) {
  const { townId } = useTown();
  const {
    cart,
    busyKey,
    error,
    notice,
    reload,
    rememberItems,
    quantityFor,
    doIncrease,
    doDecrease,
  } = useShop();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [catSort, setCatSort] = useState<CatSort>('az');
  const [itemSort, setItemSort] = useState<ItemSort>('name-az');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [products, setProducts] = useState<CatalogItemView[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [quickView, setQuickView] = useState<CatalogItemView | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const { listening, supported, error: voiceError, toggle: toggleVoice } = useBrowserVoiceSearch(
    (transcript) => setQuery(transcript),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void fetchCategories()
      .then((next) => {
        if (!cancelled) setCategories(next);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searching = debouncedQuery.length > 0;
  const selected = categories.find((c) => c.id === categoryId) ?? null;
  const inCategory = Boolean(selected);
  const showFeed = inCategory || searching;

  const visibleCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? categories.filter((c) => c.name.toLowerCase().includes(needle))
      : categories;
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return catSort === 'za' ? -cmp : cmp;
    });
  }, [categories, query, catSort]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!townId || (!inCategory && !searching)) {
        setProducts([]);
        setPage(0);
        setTotal(0);
        setHasMore(false);
        setCatalogError(null);
        return;
      }
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setCatalogLoading(true);
      }
      setCatalogError(null);
      try {
        const data = await fetchCatalogPage({
          townId,
          categoryId: selected?.id,
          q: searching ? debouncedQuery : undefined,
          page: nextPage,
          size: PAGE_SIZE,
          ...sortParams(itemSort),
        });
        setProducts((prev) => (append ? [...prev, ...data.items] : data.items));
        rememberItems(data.items, append ? 'append' : 'replace');
        setPage(data.page);
        setTotal(data.totalElements);
        setHasMore(data.page + 1 < data.totalPages);
      } catch (err) {
        if (!append) setProducts([]);
        setCatalogError(err instanceof Error ? err.message : 'Failed to load items');
      } finally {
        setCatalogLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [townId, inCategory, searching, selected?.id, debouncedQuery, itemSort, rememberItems],
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || catalogLoading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadPage(page + 1, true);
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, catalogLoading, page, loadPage]);

  const quickViewLive = useMemo(() => {
    if (!quickView) return null;
    return products.find((i) => i.listingId === quickView.listingId) ?? quickView;
  }, [products, quickView]);

  function goHome() {
    setCategoryId(null);
    setQuery('');
    setDebouncedQuery('');
  }

  return (
    <PortalShell
      hideTitle
      shopChrome
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
      onRefresh={() => {
        void reload();
        void fetchCategories().then(setCategories).catch(() => setCategories([]));
        if (showFeed) void loadPage(0, false);
      }}
    >
      <div style={styles.searchShell}>
        <span style={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className="hlm-search-input"
          aria-label={inCategory ? `Search in ${selected?.name}` : 'Search products'}
          placeholder={
            listening
              ? 'Listening… say a product'
              : inCategory
                ? `Search in ${selected?.name}`
                : `Search for "${SEARCH_HINTS[hintIndex]}"`
          }
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

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {catalogError ? <Banner tone="danger">{catalogError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {!inCategory ? (
        <>
          {browseOnly || searching ? null : <AdSlot slot="home_hero" variant="strip" />}
          {!searching || visibleCategories.length > 0 ? (
            <>
              <div style={styles.sectionHead}>
                <h2 style={styles.h2}>{searching ? 'Categories' : 'Shop by category'}</h2>
                {searching ? null : (
                  <SortSelect
                    ariaLabel="Sort categories"
                    value={catSort}
                    onChange={(v) => setCatSort(v as CatSort)}
                    options={[
                      { value: 'az', label: 'A–Z' },
                      { value: 'za', label: 'Z–A' },
                    ]}
                  />
                )}
              </div>
              {visibleCategories.length === 0 ? (
                <EmptyState
                  icon="🛒"
                  title="No categories yet"
                  description="Catalog categories will show up here."
                />
              ) : (
                <div style={searching ? styles.catRow : styles.catGrid}>
                  {visibleCategories.map((cat) => (
                    <CategoryTile
                      key={cat.id}
                      label={cat.name}
                      emoji={emojiForCategory(cat.name)}
                      onClick={() => {
                        setCategoryId(cat.id);
                        setQuery('');
                        setDebouncedQuery('');
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {showFeed ? (
        <>
          <div style={styles.sectionHead}>
            {inCategory ? (
              <button type="button" style={styles.back} onClick={goHome}>
                ← {selected?.name}
              </button>
            ) : (
              <h2 style={styles.h2}>Results</h2>
            )}
            <div style={styles.headMeta}>
              <p style={styles.count}>{total}</p>
              <SortSelect
                ariaLabel="Sort items"
                value={itemSort}
                onChange={(v) => setItemSort(v as ItemSort)}
                options={[
                  { value: 'name-az', label: 'Name A–Z' },
                  { value: 'name-za', label: 'Name Z–A' },
                  { value: 'price-asc', label: 'Price ↑' },
                  { value: 'price-desc', label: 'Price ↓' },
                  { value: 'rating', label: 'Rating' },
                ]}
              />
            </div>
          </div>

          {catalogLoading && products.length === 0 ? (
            <LoadingBlock label="Loading items…" />
          ) : products.length === 0 ? (
            <EmptyState
              icon="🥬"
              title="No items here"
              description={
                inCategory
                  ? 'Nothing listed in this category yet.'
                  : 'Try another search or pick a category.'
              }
              actionLabel="Back to categories"
              onAction={goHome}
            />
          ) : (
            <>
              <div style={styles.grid}>
                {products.map((item) => (
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
                ))}
              </div>
              <div ref={sentinelRef} style={styles.sentinel} />
              {loadingMore ? <p style={styles.moreHint}>Loading more…</p> : null}
              {!hasMore && products.length > 0 ? (
                <p style={styles.moreHint}>That’s all in this list</p>
              ) : null}
            </>
          )}
        </>
      ) : null}

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

function SortSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <label style={styles.sortWrap}>
      <span style={styles.sortLabel}>Sort</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.sortSelect}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    background: 'var(--bg-muted)',
    border: 'none',
    borderRadius: 14,
    padding: '0 0.85rem',
    minHeight: 44,
  },
  searchIcon: { color: '#9a9a9a', fontSize: '1.15rem', fontWeight: 700 },
  search: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0.7rem 0',
    fontSize: '0.95rem',
    color: 'var(--text)',
    letterSpacing: '-0.015em',
  },
  mic: {
    border: 'none',
    background: 'transparent',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: 1,
    color: 'var(--text)',
  },
  micActive: {
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: 1,
    fontWeight: 800,
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.45rem',
  },
  headMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexShrink: 0,
  },
  back: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  count: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  sortWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    minHeight: 44,
  },
  sortLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  sortSelect: {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '0.25rem 0.4rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    minHeight: 32,
  },
  catGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.7rem 0.45rem',
  },
  catRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.45rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.55rem',
    width: '100%',
    minWidth: 0,
  },
  sentinel: { height: 1 },
  moreHint: {
    margin: 0,
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
};
