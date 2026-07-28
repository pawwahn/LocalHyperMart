import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  bulkPublishListings,
  emptyDraft,
  fetchCategories,
  fetchMasterItems,
  fetchMyListings,
  parseDraftPricing,
  setListingImages,
  updateListingActive,
  updateListingPricing,
  uploadListingImage,
  type CategoryView,
  type DraftPricing,
  type ListingView,
  type MasterItemView,
  type UploadedMedia,
} from '../api/listingsApi';

type ListingsCache = {
  vendorId: string;
  listings: ListingView[];
  categories: CategoryView[];
  masterItems: MasterItemView[];
  drafts: Record<string, DraftPricing>;
  selected: Record<string, boolean>;
};

let listingsCache: ListingsCache | null = null;

function cacheFor(vendorId: string): ListingsCache | null {
  if (!listingsCache || listingsCache.vendorId !== vendorId) return null;
  // Drop stale cache shapes after listing-image fields were added.
  const sample = listingsCache.listings[0] as ListingView | undefined;
  if (sample && !Array.isArray(sample.imageUrls)) {
    listingsCache = null;
    return null;
  }
  return listingsCache;
}

export function useVendorListings() {
  const { session } = useAuth();
  const cached = session ? cacheFor(session.vendorId) : null;
  const [listings, setListings] = useState<ListingView[]>(cached?.listings ?? []);
  const [categories, setCategories] = useState<CategoryView[]>(cached?.categories ?? []);
  const [masterItems, setMasterItems] = useState<MasterItemView[]>(cached?.masterItems ?? []);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogStatus, setCatalogStatus] = useState<'all' | 'not_listed' | 'live' | 'hidden'>('all');
  const [listingQuery, setListingQuery] = useState('');
  const [listingStatus, setListingStatus] = useState<'all' | 'live' | 'hidden'>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>(cached?.selected ?? {});
  const [drafts, setDrafts] = useState<Record<string, DraftPricing>>(cached?.drafts ?? {});
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!session) return;
    const soft = Boolean(cacheFor(session.vendorId));
    if (!soft) setLoading(true);
    setError(null);
    try {
      // Master items + my listings are required. Categories are optional (derive from items if API fails).
      const [listResult, mastersResult, catsResult] = await Promise.allSettled([
        fetchMyListings(session.accessToken, session.vendorId),
        fetchMasterItems(session.accessToken),
        fetchCategories(session.accessToken),
      ]);

      if (listResult.status === 'rejected') {
        throw listResult.reason;
      }
      if (mastersResult.status === 'rejected') {
        throw mastersResult.reason;
      }

      const list = listResult.value;
      const masters = mastersResult.value;
      setListings(list);
      setMasterItems(masters);

      let nextCategories: CategoryView[];
      if (catsResult.status === 'fulfilled' && catsResult.value.length > 0) {
        nextCategories = catsResult.value;
        setCategories(nextCategories);
      } else {
        const derived = new Map<string, CategoryView>();
        for (const item of masters) {
          const key = item.categoryId || item.category || 'other';
          if (!derived.has(key)) {
            derived.set(key, { id: key, name: item.category || 'Other' });
          }
        }
        nextCategories = [...derived.values()].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(nextCategories);
      }

      const nextDrafts: Record<string, DraftPricing> = {};
      const nextSelected: Record<string, boolean> = {};
      for (const master of masters) {
        const existing = list.find((l) => l.masterItemId === master.id);
        if (existing) {
          nextSelected[master.id] = existing.active;
          nextDrafts[master.id] = {
            vendorMrp: existing.vendorMrp,
            price: existing.price,
            discountPrice: existing.discountPrice,
            vendorNote: existing.note,
          };
        } else {
          nextDrafts[master.id] = emptyDraft(master.mrp);
        }
      }
      setDrafts(nextDrafts);
      setSelected(nextSelected);
      listingsCache = {
        vendorId: session.vendorId,
        listings: list,
        categories: nextCategories,
        masterItems: masters,
        drafts: nextDrafts,
        selected: nextSelected,
      };
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // HMR can keep React state with old listing rows that lack image fields.
  useEffect(() => {
    if (listings.some((row) => !Array.isArray(row.imageUrls))) {
      listingsCache = null;
      void reload();
    }
  }, [listings, reload]);

  const listedByMaster = useMemo(() => {
    const map = new Map<string, ListingView>();
    for (const listing of listings) map.set(listing.masterItemId, listing);
    return map;
  }, [listings]);

  const visibleItems = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return masterItems.filter((item) => {
      if (categoryId !== 'all' && item.categoryId !== categoryId && item.category !== categoryId) {
        return false;
      }
      const existing = listedByMaster.get(item.id);
      if (catalogStatus === 'not_listed' && existing) return false;
      if (catalogStatus === 'live' && !existing?.active) return false;
      if (catalogStatus === 'hidden' && !(existing && !existing.active)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
      );
    });
  }, [masterItems, categoryId, catalogQuery, catalogStatus, listedByMaster]);

  const visibleListings = useMemo(() => {
    const q = listingQuery.trim().toLowerCase();
    return listings.filter((listing) => {
      if (listingStatus === 'live' && !listing.active) return false;
      if (listingStatus === 'hidden' && listing.active) return false;
      if (!q) return true;
      return (
        listing.name.toLowerCase().includes(q) ||
        listing.unit.toLowerCase().includes(q) ||
        listing.note.toLowerCase().includes(q)
      );
    });
  }, [listings, listingQuery, listingStatus]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const catalogStats = useMemo(() => {
    const adminTotal = masterItems.length;
    const inMyListing = listings.length;
    const live = listings.filter((l) => l.active).length;
    const hidden = inMyListing - live;
    const notListed = Math.max(0, adminTotal - inMyListing);
    return { adminTotal, inMyListing, live, hidden, notListed };
  }, [masterItems, listings]);

  function toggleItem(masterItemId: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [masterItemId]: checked }));
    setRowErrors((prev) => {
      if (!prev[masterItemId]) return prev;
      const next = { ...prev };
      delete next[masterItemId];
      return next;
    });
    setDrafts((prev) => {
      if (prev[masterItemId]) return prev;
      const master = masterItems.find((m) => m.id === masterItemId);
      return { ...prev, [masterItemId]: emptyDraft(master?.mrp) };
    });
  }

  function updateDraft(masterItemId: string, patch: Partial<DraftPricing>) {
    setDrafts((prev) => ({
      ...prev,
      [masterItemId]: { ...(prev[masterItemId] ?? emptyDraft()), ...patch },
    }));
    setRowErrors((prev) => {
      if (!prev[masterItemId]) return prev;
      const next = { ...prev };
      delete next[masterItemId];
      return next;
    });
  }

  async function publishSelected() {
    if (!session) return;
    const ids = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (ids.length === 0) {
      setError('Check at least one product as available');
      setRowErrors({});
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    setRowErrors({});

    const nextRowErrors: Record<string, string> = {};
    const payload: Array<{
      masterItemId: string;
      vendorMrp: number | null;
      price: number;
      discountPrice: number | null;
      vendorNote: string | null;
    }> = [];

    for (const masterItemId of ids) {
      const master = masterItems.find((m) => m.id === masterItemId);
      const productName = master?.name ?? 'Product';
      try {
        const draft = drafts[masterItemId] ?? emptyDraft(master?.mrp);
        const pricing = parseDraftPricing(draft, productName);
        payload.push({
          masterItemId,
          vendorMrp: pricing.vendorMrp,
          price: pricing.price,
          discountPrice: pricing.discountPrice,
          vendorNote: pricing.vendorNote,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : `${productName}: invalid pricing`;
        nextRowErrors[masterItemId] = message;
      }
    }

    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      const first = Object.values(nextRowErrors)[0];
      const count = Object.keys(nextRowErrors).length;
      setError(
        count === 1
          ? first
          : `${count} products need fixing. First: ${first}`,
      );
      setSaving(false);
      return;
    }

    try {
      await bulkPublishListings(session.accessToken, session.vendorId, payload);
      setNotice(`${payload.length} item(s) published to your town listing.`);
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not publish listings';
      setError(message);
      // Backend may return "Rice: …" — attach to matching product row when possible.
      const matched = masterItems.find((m) => message.startsWith(`${m.name}:`));
      if (matched) {
        setRowErrors({ [matched.id]: message });
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(listing: ListingView) {
    if (!session) return;
    setActionId(listing.id);
    setError(null);
    setNotice(null);
    try {
      await updateListingActive(session.accessToken, session.vendorId, listing.id, !listing.active);
      setNotice(listing.active ? 'Removed from town listing.' : 'Shown again in town listing.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update listing');
    } finally {
      setActionId(null);
    }
  }

  async function saveListingPricing(listing: ListingView, draft: DraftPricing): Promise<boolean> {
    if (!session) return false;
    setActionId(listing.id);
    setError(null);
    setNotice(null);
    try {
      const pricing = parseDraftPricing(draft, listing.name);
      // Clear discount on this simple edit so Sell column matches saved price.
      const updated = await updateListingPricing(session.accessToken, session.vendorId, listing.id, {
        ...pricing,
        discountPrice: null,
      });
      setListings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setNotice(`Updated prices for ${listing.name}.`);
      try {
        await reload();
      } catch {
        /* list already updated from PATCH response */
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update prices');
      return false;
    } finally {
      setActionId(null);
    }
  }

  async function saveListingPhotos(
    listing: ListingView,
    images: UploadedMedia[],
  ): Promise<boolean> {
    if (!session) return false;
    setActionId(listing.id);
    setError(null);
    setNotice(null);
    try {
      const urls = await setListingImages(
        session.accessToken,
        session.vendorId,
        listing.id,
        images.map((m) => ({ mediaId: m.mediaId, url: m.url })),
      );
      setListings((prev) => {
        const next = prev.map((row) =>
          row.id === listing.id
            ? {
                ...row,
                listingImageUrls: urls,
                customImages: urls.length > 0,
                imageUrls: urls.length > 0 ? urls : (row.masterImageUrls ?? []),
                masterImageUrls: row.masterImageUrls ?? [],
              }
            : row,
        );
        if (listingsCache?.vendorId === session.vendorId) {
          listingsCache = { ...listingsCache, listings: next };
        }
        return next;
      });
      setNotice(
        urls.length > 0
          ? `Updated photos for ${listing.name} (only your listing).`
          : `Cleared custom photos for ${listing.name}. Buyers will see catalog photos.`,
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photos');
      return false;
    } finally {
      setActionId(null);
    }
  }

  async function uploadPhoto(file: File): Promise<UploadedMedia> {
    if (!session) throw new Error('Sign in required');
    return uploadListingImage(session.accessToken, file);
  }

  return {
    listings,
    categories,
    visibleItems,
    visibleListings,
    listedByMaster,
    categoryId,
    setCategoryId,
    catalogQuery,
    setCatalogQuery,
    catalogStatus,
    setCatalogStatus,
    listingQuery,
    setListingQuery,
    listingStatus,
    setListingStatus,
    selected,
    drafts,
    rowErrors,
    loading,
    saving,
    actionId,
    error,
    notice,
    selectedCount,
    catalogStats,
    reload,
    toggleItem,
    updateDraft,
    publishSelected,
    toggleActive,
    saveListingPricing,
    saveListingPhotos,
    uploadPhoto,
  };
}
