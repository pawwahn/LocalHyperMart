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
import { groupCategoriesIntoAisles } from '../lib/aisles';
import { useBrowserVoiceSearch } from '../hooks/useBrowserVoiceSearch';
import { useShop } from '../hooks/useShop';

const SEARCH_HINTS = ['Egg', 'Bread', 'Milk', 'Rice', 'Maggi', 'Tomato'];
const PAGE_SIZE = 24;
const CATEGORY_COLS = 4;
/** Insert sponsored mid-grid ad after this many full category rows on home. */
const MID_AD_AFTER_ROW = 4;

type HomeBlock =
  | { type: 'aisle-start'; title: string }
  | { type: 'category'; cat: CategoryView }
  | { type: 'mid-ad' };

function buildCategoryHomeBlocks(aisles: ReturnType<typeof groupCategoriesIntoAisles>): HomeBlock[] {
  const blocks: HomeBlock[] = [];
  let tileIndex = 0;
  let midAdInserted = false;

  for (const aisle of aisles) {
    if (aisle.categories.length === 0) continue;
    blocks.push({ type: 'aisle-start', title: aisle.title });
    for (const cat of aisle.categories) {
      tileIndex += 1;
      blocks.push({ type: 'category', cat });
      if (
        !midAdInserted &&
        tileIndex % CATEGORY_COLS === 0 &&
        tileIndex / CATEGORY_COLS === MID_AD_AFTER_ROW
      ) {
        blocks.push({ type: 'mid-ad' });
        midAdInserted = true;
      }
    }
  }
  return blocks;
}

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
  const [categoryName, setCategoryName] = useState<string>('');
  const [categories, setCategories] = useState<CategoryView[]>([]);
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
  const fetchGenRef = useRef(0);
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
    if (!townId) {
      setCategories([]);
      setCategoryId(null);
      setCategoryName('');
      return () => {
        cancelled = true;
      };
    }
    void fetchCategories(townId)
      .then((next) => {
        if (cancelled) return;
        setCategories(next);
        setCategoryId((prev) => {
          if (prev && !next.some((c) => c.id === prev)) {
            setCategoryName('');
            return null;
          }
          return prev;
        });
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [townId]);

  const searching = debouncedQuery.length > 0;
  const selected = categories.find((c) => c.id === categoryId) ?? null;
  const inCategory = Boolean(categoryId);
  const showFeed = inCategory || searching;
  const categoryTitle = selected?.name || categoryName || 'Category';

  const aisles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? categories.filter((c) => c.name.toLowerCase().includes(needle))
      : categories;
    return groupCategoriesIntoAisles(list);
  }, [categories, query]);

  const categoryHomeBlocks = useMemo(
    () => (searching ? [] : buildCategoryHomeBlocks(aisles)),
    [aisles, searching],
  );

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!townId || (!inCategory && !searching)) {
        fetchGenRef.current += 1;
        setProducts([]);
        setPage(0);
        setTotal(0);
        setHasMore(false);
        setCatalogError(null);
        setCatalogLoading(false);
        return;
      }
      const gen = append ? fetchGenRef.current : ++fetchGenRef.current;
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setCatalogLoading(true);
        setProducts([]);
      }
      setCatalogError(null);
      try {
        const data = await fetchCatalogPage({
          townId,
          categoryId: categoryId ?? undefined,
          q: searching ? debouncedQuery : undefined,
          page: nextPage,
          size: PAGE_SIZE,
          ...sortParams(itemSort),
        });
        if (gen !== fetchGenRef.current) return;
        setProducts((prev) => (append ? [...prev, ...data.items] : data.items));
        rememberItems(data.items, append ? 'append' : 'replace');
        setPage(data.page);
        setTotal(data.totalElements);
        setHasMore(data.page + 1 < data.totalPages);
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        if (!append) setProducts([]);
        setCatalogError(err instanceof Error ? err.message : 'Failed to load items');
      } finally {
        if (gen === fetchGenRef.current) {
          setCatalogLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [townId, inCategory, searching, categoryId, debouncedQuery, itemSort, rememberItems],
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
    fetchGenRef.current += 1;
    setCategoryId(null);
    setCategoryName('');
    setQuery('');
    setDebouncedQuery('');
    setCatalogLoading(false);
    setProducts([]);
  }

  function openCategory(cat: CategoryView) {
    fetchGenRef.current += 1;
    setCategoryId(cat.id);
    setCategoryName(cat.name);
    setQuery('');
    setDebouncedQuery('');
    setProducts([]);
    setCatalogLoading(true);
    setCatalogError(null);
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
        if (townId) {
          void fetchCategories(townId)
            .then((next) => {
              setCategories(next);
              setCategoryId((prev) => {
                if (prev && !next.some((c) => c.id === prev)) {
                  setCategoryName('');
                  return null;
                }
                return prev;
              });
            })
            .catch(() => setCategories([]));
        }
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
          {!searching || aisles.length > 0 ? (
            aisles.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="No categories yet"
                description="Catalog categories will show up here."
              />
            ) : (
              <div style={styles.homeDirectory}>
                {categoryHomeBlocks.map((block, index) => {
                  if (block.type === 'aisle-start') {
                    return (
                      <h2 key={`aisle-${block.title}-${index}`} style={styles.aisleHeading}>
                        {block.title}
                      </h2>
                    );
                  }
                  if (block.type === 'mid-ad') {
                    return browseOnly ? null : (
                      <div key="home-mid-grid-ad" style={styles.midAdWrap}>
                        <AdSlot slot="home_mid_grid" variant="strip" />
                      </div>
                    );
                  }
                  return (
                    <CategoryTile
                      key={block.cat.id}
                      label={block.cat.name}
                      onClick={() => openCategory(block.cat)}
                    />
                  );
                })}
              </div>
            )
          ) : null}
        </>
      ) : null}

      {showFeed ? (
        <>
          <div style={styles.sectionHead}>
            {inCategory ? (
              <button type="button" style={styles.back} onClick={goHome}>
                ← {categoryTitle}
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

          {inCategory ? <AdSlot slot="home_hero" variant="strip" /> : null}

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
    fontSize: '1.02rem',
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
  aisles: { display: 'grid', gap: '1.05rem' },
  aisle: { display: 'grid', gap: '0.55rem' },
  homeDirectory: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.75rem 0.4rem',
    alignContent: 'start',
  },
  aisleHeading: {
    gridColumn: '1 / -1',
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  midAdWrap: {
    gridColumn: '1 / -1',
    margin: '0.1rem 0',
  },
  catGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.75rem 0.4rem',
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
