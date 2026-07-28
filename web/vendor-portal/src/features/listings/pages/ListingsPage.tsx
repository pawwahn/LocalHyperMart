import { useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner } from '@/shared/ui';
import { useVendorListings } from '../hooks/useVendorListings';
import { CatalogPicker } from '../components/CatalogPicker';
import { PublishedListings } from '../components/PublishedListings';

type ListingsTab = 'catalog' | 'mine';

export function ListingsPage({ active = true }: { active?: boolean }) {
  const {
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
  } = useVendorListings();
  const [tab, setTab] = useState<ListingsTab>('catalog');

  usePortalChrome(
    {
      title: 'Listings',
      onRefresh: () => void reload(),
    },
    active,
  );

  return (
    <>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {loading && listings.length === 0 && visibleItems.length === 0 ? (
        <p style={styles.muted}>Loading catalog…</p>
      ) : (
        <>
          <div style={styles.tabs} role="tablist" aria-label="Listings views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'catalog'}
              style={tab === 'catalog' ? styles.tabActive : styles.tab}
              onClick={() => setTab('catalog')}
            >
              Add products
              <span style={styles.tabMeta}>{catalogStats.notListed} left</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mine'}
              style={tab === 'mine' ? styles.tabActive : styles.tab}
              onClick={() => setTab('mine')}
            >
              My listings
              <span style={styles.tabMeta}>
                {catalogStats.inMyListing}
                {catalogStats.inMyListing > 0
                  ? ` · ${catalogStats.live} live`
                  : ''}
              </span>
            </button>
          </div>

          {tab === 'catalog' ? (
            <CatalogPicker
              categories={categories}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              query={catalogQuery}
              onQueryChange={setCatalogQuery}
              statusFilter={catalogStatus}
              onStatusFilterChange={setCatalogStatus}
              items={visibleItems}
              listedByMaster={listedByMaster}
              selected={selected}
              drafts={drafts}
              rowErrors={rowErrors}
              saving={saving}
              selectedCount={selectedCount}
              adminTotal={catalogStats.adminTotal}
              inMyListing={catalogStats.inMyListing}
              onToggle={toggleItem}
              onDraftChange={updateDraft}
              onPublish={() => void publishSelected()}
            />
          ) : (
            <PublishedListings
              listings={listings}
              filteredListings={visibleListings}
              query={listingQuery}
              onQueryChange={setListingQuery}
              statusFilter={listingStatus}
              onStatusFilterChange={setListingStatus}
              actionId={actionId}
              onToggle={(listing) => void toggleActive(listing)}
              onSavePricing={saveListingPricing}
              onUploadPhoto={uploadPhoto}
              onSavePhotos={saveListingPhotos}
            />
          )}
        </>
      )}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { color: 'var(--text-muted)' },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.4rem',
    padding: '0.3rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '0.55rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  tabActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.55rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-card)',
  },
  tabMeta: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
};
