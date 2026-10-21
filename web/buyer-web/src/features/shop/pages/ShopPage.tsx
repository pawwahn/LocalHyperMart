import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useTown } from '@/shared/town/TownContext';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import {
  fetchCartSuggestions,
  fetchCatalogHome,
  fetchCatalogPage,
  fetchCategories,
  fetchDiscountedItems,
  fetchTownBestsellers,
  mergeCatalogItems,
  type CatalogItemView,
  type CategoryView,
} from '../api/shopApi';
import { CategoryTile } from '../components/CategoryTile';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { DeliveryHero } from '../components/DeliveryHero';
import { ShopHomeFooter } from '../components/ShopHomeFooter';
import { MembershipPlansSheet } from '../components/MembershipPlansSheet';
import { ProductCard } from '../components/ProductCard';
import { ProductQuickView } from '../components/ProductQuickView';
import { ProductRail } from '../components/ProductRail';
import { StoreRail } from '../components/StoreRail';
import { ShopSpecialOffersBanner } from '../components/ShopSpecialOffersBanner';
import { ensureShopHomeAislesCss } from '../components/shopHomeAisles.css';
import { BestDealsSheet } from '../components/BestDealsSheet';
import { groupCategoriesIntoAisles } from '../lib/aisles';
import { useBrowserVoiceSearch } from '../hooks/useBrowserVoiceSearch';
import { useShop } from '../hooks/useShop';
import { BuyAgainBar } from '../components/BuyAgainBar';

const SEARCH_HINTS = ['Egg', 'Bread', 'Milk', 'Rice', 'Maggi', 'Tomato'];
const RECENT_SEARCHES_KEY = 'koyakart-recent-searches';

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((term): term is string => typeof term === 'string' && term.trim().length > 0).slice(0, 8);
  } catch {
    return [];
  }
}

function writeRecentSearches(terms: string[]) {
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(terms.slice(0, 8)));
}

type StoreRailSpec = { id: string; title: string; names: string[]; maxPrice?: number };

const STORE_RAIL_SPECS: StoreRailSpec[] = [
  { id: 'fresh', title: 'Fresh Store', names: ['dairy, bread and eggs', 'dairy'] },
  { id: 'farm', title: 'Farm to Door', names: ['fresh vegetables', 'vegetables', 'fresh fruits', 'fruits'] },
  {
    id: 'pantry',
    title: 'Regional pantry picks',
    names: ['atta, rice and dal', 'oils and ghee', 'masalas', 'cereals and breakfast'],
  },
  { id: 'skin', title: 'Best in skincare', names: ['skin care'] },
  { id: 'health', title: 'Health under ₹999', names: ['health and nutrition'], maxPrice: 999 },
];

function shortEta(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '';
  const tomorrow = /^tomorrow/i.test(trimmed);
  const time = trimmed.replace(/^(today|tomorrow),\s*/i, '');
  return tomorrow ? `Tmrw ${time}` : time;
}
const PAGE_SIZE = 24;
const CATEGORY_COLS = 4;
/** Insert sponsored mid-grid ad after this many full category rows on home. */
const MID_AD_AFTER_ROW = 4;
/** Cat 1–4 sit after these category rows on the Categories screen. */
const CATEGORY_AD_ROWS = [2, 4, 6, 8];

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
  const navigate = useNavigate();
  const { isAuthenticated, session } = useAuth();
  const { townId, townLabel, bestDealsEnabled, deliveryWindowLabel, laundryEnabled } = useTown();
  const {
    cart,
    busy,
    busyKey,
    error,
    notice,
    reload,
    rememberItems,
    quantityFor,
    doAdd,
    doIncrease,
    doDecrease,
    setError,
    setNotice,
  } = useShop();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [itemSort, setItemSort] = useState<ItemSort>('name-az');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(readRecentSearches);
  const [offersOnly, setOffersOnly] = useState(false);
  const [products, setProducts] = useState<CatalogItemView[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [quickView, setQuickView] = useState<CatalogItemView | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [dealsOpen, setDealsOpen] = useState(false);
  const [membershipOnSale, setMembershipOnSale] = useState(false);
  const [featured, setFeatured] = useState<CatalogItemView[]>([]);
  const [discountPool, setDiscountPool] = useState<CatalogItemView[]>([]);
  const [bestsellerPool, setBestsellerPool] = useState<CatalogItemView[]>([]);
  const [picks, setPicks] = useState<CatalogItemView[]>([]);
  const [railSource, setRailSource] = useState<'pending' | 'home' | 'fallback'>('pending');
  const [storeRails, setStoreRails] = useState<
    Array<{ id: string; title: string; items: CatalogItemView[]; categoryId: string | null }>
  >([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const fetchGenRef = useRef(0);
  const { listening, supported, error: voiceError, toggle: toggleVoice } = useBrowserVoiceSearch(
    (transcript) => setQuery(transcript),
  );

  useEffect(() => {
    ensureShopHomeAislesCss();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPublicPlatformSettings()
      .then((s) => {
        if (!cancelled) {
          setMembershipOnSale(s.membershipEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembershipOnSale(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (debouncedQuery.length < 2) return;
    setRecentSearches((prev) => {
      const next = [debouncedQuery, ...prev.filter((term) => term.toLowerCase() !== debouncedQuery.toLowerCase())].slice(0, 8);
      writeRecentSearches(next);
      return next;
    });
  }, [debouncedQuery]);

  useEffect(() => {
    setOffersOnly(false);
  }, [categoryId, debouncedQuery]);

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
  const visibleProducts = useMemo(
    () =>
      offersOnly
        ? products.filter((item) => (item.discountPercent ?? 0) > 0 || item.specialOfferActive)
        : products,
    [offersOnly, products],
  );
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

  useEffect(() => {
    if (!townId || browseOnly) {
      setFeatured([]);
      setDiscountPool([]);
      setBestsellerPool([]);
      setStoreRails([]);
      setRailSource('home');
      return;
    }
    let cancelled = false;
    setRailSource('pending');
    void fetchCatalogHome(townId)
      .then((home) => {
        if (cancelled) return;
        setFeatured(home.featured);
        setDiscountPool(home.discounted);
        setBestsellerPool(home.popular);
        setStoreRails(home.rails);
        rememberItems(
          [
            ...home.featured,
            ...home.discounted,
            ...home.popular,
            ...home.rails.flatMap((rail) => rail.items),
          ],
          'append',
        );
        setRailSource('home');
      })
      .catch(() => {
        if (cancelled) return;
        setRailSource('fallback');
        void fetchCatalogPage({ townId, page: 0, size: 48, sort: 'rating', dir: 'desc' })
          .then((data) => {
            if (cancelled) return;
            setFeatured(data.items);
            rememberItems(data.items, 'append');
          })
          .catch(() => {
            if (!cancelled) setFeatured([]);
          });
        void fetchDiscountedItems(townId, 28)
          .then((items) => {
            if (cancelled) return;
            setDiscountPool(items);
            rememberItems(items, 'append');
          })
          .catch(() => {
            if (!cancelled) setDiscountPool([]);
          });
        void fetchTownBestsellers(townId, 24)
          .then((items) => {
            if (cancelled) return;
            setBestsellerPool(items);
            rememberItems(items, 'append');
          })
          .catch(() => {
            if (!cancelled) setBestsellerPool([]);
          });
      });
    return () => {
      cancelled = true;
    };
  }, [townId, browseOnly, rememberItems]);

  useEffect(() => {
    if (!townId || browseOnly || !isAuthenticated || !session?.accessToken) {
      setPicks([]);
      return;
    }
    let cancelled = false;
    void fetchCartSuggestions(session.accessToken, townId, 20)
      .then((items) => {
        if (cancelled) return;
        setPicks(items);
        rememberItems(items, 'append');
      })
      .catch(() => {
        if (!cancelled) setPicks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [townId, browseOnly, isAuthenticated, session?.accessToken, rememberItems]);

  useEffect(() => {
    if (!townId || browseOnly) {
      setStoreRails([]);
      return;
    }
    if (railSource !== 'fallback' || categories.length === 0) {
      return;
    }
    let cancelled = false;
    const byName = new Map(categories.map((category) => [category.name.toLowerCase().trim(), category]));
    const jobs = STORE_RAIL_SPECS.map((spec) => ({
      spec,
      cats: spec.names
        .map((name) => byName.get(name))
        .filter((category): category is CategoryView => Boolean(category)),
    })).filter((job) => job.cats.length > 0);

    void Promise.all(
      jobs.map(async (job) => {
        const pages = await Promise.all(
          job.cats.map((category) =>
            fetchCatalogPage({
              townId,
              categoryId: category.id,
              page: 0,
              size: 12,
              sort: 'rating',
              dir: 'desc',
            })
              .then((data) => ({ category, items: data.items }))
              .catch(() => ({ category, items: [] as CatalogItemView[] })),
          ),
        );
        return { job, pages };
      }),
    ).then((results) => {
      if (cancelled) return;
      const used = new Set<string>();
      const rails: Array<{ id: string; title: string; items: CatalogItemView[]; categoryId: string | null }> = [];
      for (const { job, pages } of results) {
        const ranked = [...pages].sort((a, b) => b.items.length - a.items.length);
        const items: CatalogItemView[] = [];
        for (const page of ranked) {
          for (const item of page.items) {
            if (used.has(item.listingId)) continue;
            if (job.spec.maxPrice != null && item.price > job.spec.maxPrice) continue;
            items.push(item);
            if (items.length >= 12) break;
          }
          if (items.length >= 12) break;
        }
        if (items.length < 3) continue;
        for (const item of items) used.add(item.listingId);
        rails.push({
          id: job.spec.id,
          title: job.spec.title,
          items,
          categoryId: ranked.find((page) => page.items.some((item) => items.includes(item)))?.category.id ?? null,
        });
      }
      setStoreRails(rails);
      rememberItems(rails.flatMap((rail) => rail.items), 'append');
    });

    return () => {
      cancelled = true;
    };
  }, [townId, browseOnly, categories, rememberItems, railSource]);

  const buyAgainItems = useMemo(
    () => picks.filter((item) => item.fromPreviousOrder),
    [picks],
  );
  const buyAgainIds = useMemo(
    () => new Set(buyAgainItems.map((item) => item.listingId)),
    [buyAgainItems],
  );
  const featuredDiscounted = useMemo(
    () =>
      featured.filter((item) => (item.discountPercent ?? 0) > 0 || item.specialOfferActive),
    [featured],
  );
  const popularFallback = useMemo(
    () => [...featured].sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0)),
    [featured],
  );
  const forYouItems = useMemo(
    () =>
      mergeCatalogItems(
        picks.filter((item) => !item.fromPreviousOrder && !buyAgainIds.has(item.listingId)),
        discountPool,
        featuredDiscounted,
      )
        .filter((item) => !buyAgainIds.has(item.listingId))
        .slice(0, 28),
    [picks, buyAgainIds, discountPool, featuredDiscounted],
  );
  const offerItems = useMemo(
    () =>
      mergeCatalogItems(discountPool, bestsellerPool, featuredDiscounted, popularFallback)
        .filter((item) => !buyAgainIds.has(item.listingId))
        .slice(0, 28),
    [discountPool, bestsellerPool, featuredDiscounted, popularFallback, buyAgainIds],
  );
  const showOffers = offerItems.length >= 2;

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

  function clearSearch() {
    setQuery('');
    setDebouncedQuery('');
  }

  function forgetRecent(term: string) {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== term);
      writeRecentSearches(next);
      return next;
    });
  }

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
        {query ? (
          <button type="button" style={styles.clearSearch} onClick={clearSearch} aria-label="Clear search">
            ×
          </button>
        ) : null}
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
      {!inCategory && !searching && recentSearches.length > 0 ? (
        <div style={styles.recentBlock}>
          <span style={styles.recentLabel}>Recent</span>
          <div style={styles.hints} aria-label="Recent searches">
            {recentSearches.map((term) => (
              <span key={term} style={styles.recentChip}>
                <button type="button" style={styles.recentTerm} onClick={() => setQuery(term)}>
                  {term}
                </button>
                <button type="button" style={styles.recentForget} aria-label={`Remove ${term}`} onClick={() => forgetRecent(term)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {!inCategory && !searching ? (
        <div style={styles.hints} aria-label="Popular searches">
          {SEARCH_HINTS.map((hint) => (
            <button
              key={hint}
              type="button"
              style={styles.hint}
              onClick={() => setQuery(hint)}
            >
              {hint}
            </button>
          ))}
        </div>
      ) : null}
      {!inCategory && !searching && laundryEnabled ? (
        <Link to="/laundry" style={styles.laundry} aria-label="Laundry. Wash, iron, pickup and drop. Book">
          <span style={styles.laundryIcon} aria-hidden>
            👕
          </span>
          <span style={styles.laundryCopy}>
            <span style={styles.laundryTitleRow}>
              <strong style={styles.laundryTitle}>Laundry</strong>
              <span style={styles.laundryBadge}>Service</span>
            </span>
            <span style={styles.laundryHint}>Wash, iron, pickup and drop</span>
          </span>
          <span style={styles.laundryCta}>Book</span>
        </Link>
      ) : null}
      {!browseOnly && !inCategory && !searching && isAuthenticated && session?.accessToken && townId ? (
        <BuyAgainBar
          townId={townId}
          token={session.accessToken}
          busy={busy}
          onMessage={async (message) => {
            setNotice(message);
            await reload();
          }}
          onError={(message) => setError(message || null)}
        />
      ) : null}

      {voiceError ? <Banner tone="warning">{voiceError}</Banner> : null}
      {listening ? <Banner tone="info">Listening… say something like “milk” or “rice”</Banner> : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {catalogError ? <Banner tone="danger">{catalogError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {!inCategory ? (
        <>
          {browseOnly || searching ? null : (
            <DeliveryHero
              showPlans={membershipOnSale}
              onOpenPlans={() => {
                if (isAuthenticated) setPlansOpen(true);
                else navigate('/membership');
              }}
            />
          )}
          {browseOnly || searching ? null : (
            <ProductRail
              title="Buy again"
              items={buyAgainItems}
              quantityFor={quantityFor}
              busyKey={busyKey}
              onOpen={setQuickView}
              onIncrease={(id) => void doIncrease(id)}
              onDecrease={(id) => void doDecrease(id)}
            />
          )}
          {browseOnly || searching ? null : (
            <ProductRail
              title="Picked for you"
              items={forYouItems}
              autoMove
              quantityFor={quantityFor}
              busyKey={busyKey}
              onOpen={setQuickView}
              onIncrease={(id) => void doIncrease(id)}
              onDecrease={(id) => void doDecrease(id)}
            />
          )}
          {browseOnly || searching || !showOffers ? null : (
            <ProductRail
              title="Offers in your town"
              items={offerItems}
              autoMove
              quantityFor={quantityFor}
              busyKey={busyKey}
              onOpen={setQuickView}
              onIncrease={(id) => void doIncrease(id)}
              onDecrease={(id) => void doDecrease(id)}
            />
          )}
          {browseOnly || searching
            ? null
            : storeRails.map((rail) => (
                <StoreRail
                  key={rail.id}
                  title={rail.title}
                  items={rail.items}
                  etaLabel={shortEta(deliveryWindowLabel)}
                  quantityFor={quantityFor}
                  busyKey={busyKey}
                  onOpen={setQuickView}
                  onIncrease={(id) => void doIncrease(id)}
                  onDecrease={(id) => void doDecrease(id)}
                  onSeeAll={
                    rail.categoryId
                      ? () => {
                          const category = categories.find((item) => item.id === rail.categoryId);
                          if (category) openCategory(category);
                        }
                      : undefined
                  }
                />
              ))}
          {browseOnly || searching ? null : (
            <div style={styles.homeHeroAd}>
              <AdSlot slot="home_hero" variant="strip" />
            </div>
          )}
          {!searching || aisles.length > 0 ? (
            aisles.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="No categories yet"
                description="Catalog categories will show up here."
              />
            ) : (
              <div className="hlm-shop-home-sections">
                {browseOnly || searching ? null : (
                  <ShopSpecialOffersBanner
                    dealsEnabled={bestDealsEnabled}
                    showPlans={membershipOnSale}
                    onOpenDeals={() => setDealsOpen(true)}
                    onOpenPlans={() => {
                      if (isAuthenticated) setPlansOpen(true);
                      else navigate('/membership');
                    }}
                  />
                )}
                {(() => {
                  let tileIndex = 0;
                  let midAdInserted = false;
                  const categoryAdsInserted = new Set<number>();
                  return aisles.map((aisle) => {
                    if (aisle.categories.length === 0) return null;
                    const tiles: ReactNode[] = [];
                    for (const cat of aisle.categories) {
                      tileIndex += 1;
                      tiles.push(
                        <CategoryTile
                          key={cat.id}
                          label={cat.name}
                          imageUrl={cat.imageUrl}
                          onClick={() => openCategory(cat)}
                        />,
                      );
                      if (
                        !browseOnly &&
                        !midAdInserted &&
                        tileIndex % CATEGORY_COLS === 0 &&
                        tileIndex / CATEGORY_COLS === MID_AD_AFTER_ROW
                      ) {
                        midAdInserted = true;
                        tiles.push(
                          <div key="home-mid-grid-ad" className="hlm-mid-ad-full">
                            <AdSlot slot="home_mid_grid" variant="strip" />
                          </div>,
                        );
                      }
                      if (browseOnly && tileIndex % CATEGORY_COLS === 0) {
                        const row = tileIndex / CATEGORY_COLS;
                        const catRoom = CATEGORY_AD_ROWS.indexOf(row);
                        if (catRoom >= 0 && !categoryAdsInserted.has(row)) {
                          categoryAdsInserted.add(row);
                          tiles.push(
                            <div key={`category-upsell-${catRoom + 1}`} className="hlm-mid-ad-full">
                              <AdSlot slot="cart_upsell" slotIndex={catRoom + 1} variant="strip" />
                            </div>,
                          );
                        }
                      }
                    }
                    const heading = (
                      <h2
                        key={`${aisle.title}-heading`}
                        className="hlm-aisle-heading-full"
                        style={styles.aisleHeading}
                      >
                        {aisle.title}
                      </h2>
                    );
                    return (
                      <div key={aisle.title} className="hlm-shop-home-aisle-full">
                        <div className="hlm-shop-home-directory hlm-shop-home-directory--full">
                          {heading}
                          {tiles}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )
          ) : null}
          {!showFeed ? <ShopHomeFooter /> : null}
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
          <div style={styles.feedChips} role="group" aria-label="Filter items">
            <button type="button" style={offersOnly ? styles.feedChip : styles.feedChipOn} onClick={() => setOffersOnly(false)}>
              All
            </button>
            <button type="button" style={offersOnly ? styles.feedChipOn : styles.feedChip} onClick={() => setOffersOnly(true)}>
              Offers
            </button>
          </div>

          {inCategory ? <AdSlot slot="home_hero" variant="strip" /> : null}

          {catalogLoading && products.length === 0 ? (
            <LoadingBlock label="Loading items…" />
          ) : visibleProducts.length === 0 ? (
            <>
              <EmptyState
                icon="🥬"
                title={offersOnly ? 'No offers here' : 'No items here'}
                description={
                  offersOnly
                    ? hasMore
                      ? 'None of the items loaded so far are on offer.'
                      : 'Nothing in this list is on offer.'
                    : inCategory
                      ? 'Nothing listed in this category yet.'
                      : 'Try another search or pick a category.'
                }
                actionLabel={offersOnly ? 'Show all items' : 'Back to categories'}
                onAction={offersOnly ? () => setOffersOnly(false) : goHome}
              />
              {hasMore ? <div ref={sentinelRef} style={styles.sentinel} /> : null}
              {loadingMore ? <p style={styles.moreHint}>Loading more…</p> : null}
            </>
          ) : (
            <>
              <div className="hlm-shop-product-grid">
                {visibleProducts.map((item) => (
                  <ProductCard
                    key={item.listingId}
                    layout="store"
                    etaLabel={shortEta(deliveryWindowLabel)}
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
          townId={townId}
          quantity={quantityFor(quickViewLive.listingId)}
          busy={busyKey === quickViewLive.listingId}
          busyKey={busyKey}
          quantityFor={quantityFor}
          onClose={() => setQuickView(null)}
          onIncrease={() => void doIncrease(quickViewLive.listingId)}
          onDecrease={() => void doDecrease(quickViewLive.listingId)}
          onOpenRelated={(item) => {
            rememberItems([item], 'append');
            setQuickView(item);
          }}
          onIncreaseListing={(id) => void doIncrease(id)}
          onDecreaseListing={(id) => void doDecrease(id)}
        />
      ) : null}
      <MembershipPlansSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
      <BestDealsSheet
        open={dealsOpen && bestDealsEnabled}
        busyKey={busyKey}
        quantityFor={quantityFor}
        rememberItems={rememberItems}
        onIncrease={(id) => void doIncrease(id)}
        onDecrease={(id) => void doDecrease(id)}
        onClose={() => setDealsOpen(false)}
      />
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
    marginTop: '-0.2rem',
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0 0.85rem',
    minHeight: 46,
    boxShadow: '0 8px 22px rgba(16, 24, 40, 0.08)',
  },
  searchIcon: { color: 'var(--accent)', fontSize: '1.15rem', fontWeight: 700 },
  clearSearch: {
    border: 'none',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    width: 28,
    height: 28,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    fontWeight: 700,
    flexShrink: 0,
  },
  recentBlock: {
    display: 'grid',
    gap: '0.28rem',
  },
  recentLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  recentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    minHeight: 28,
    overflow: 'hidden',
  },
  recentTerm: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    padding: '0.15rem 0.15rem 0.15rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  recentForget: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    width: 26,
    height: 26,
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  feedChips: {
    display: 'flex',
    gap: '0.35rem',
  },
  feedChip: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 999,
    minHeight: 28,
    padding: '0.1rem 0.7rem',
    fontSize: '0.74rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  feedChipOn: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: 999,
    minHeight: 28,
    padding: '0.1rem 0.7rem',
    fontSize: '0.74rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
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
  hints: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
  },
  laundry: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.4rem 0 0.45rem',
    padding: '0.38rem 0.45rem 0.38rem 0.42rem',
    minHeight: 48,
    borderRadius: 12,
    background:
      'linear-gradient(105deg, var(--hero-deep) 0%, var(--accent) 52%, color-mix(in srgb, var(--accent) 62%, #fff) 100%)',
    color: '#fff',
    textDecoration: 'none',
    boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 32%, transparent)',
  },
  laundryIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: 'rgba(255, 255, 255, 0.18)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.05rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  laundryCopy: { flex: 1, minWidth: 0 },
  laundryTitleRow: { display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 },
  laundryTitle: { fontSize: '0.9rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' },
  laundryBadge: {
    padding: '0.05rem 0.38rem',
    borderRadius: 999,
    background: 'var(--highlight, #F7CE46)',
    color: '#0a3d12',
    fontSize: '0.56rem',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
    flexShrink: 0,
  },
  laundryHint: {
    display: 'block',
    marginTop: '0.05rem',
    fontSize: '0.68rem',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 600,
  },
  laundryCta: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    padding: '0 0.7rem',
    borderRadius: 999,
    background: '#fff',
    color: 'var(--accent)',
    fontSize: '0.75rem',
    fontWeight: 800,
  },
  hint: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 999,
    minHeight: 28,
    padding: '0.15rem 0.55rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
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
  aisleHeading: {
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.02rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  homeHeroAd: {
    position: 'relative',
    zIndex: 0,
    marginTop: '0.15rem',
  },
  catGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.75rem 0.4rem',
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
