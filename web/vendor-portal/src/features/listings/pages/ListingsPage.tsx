import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner } from '@/shared/ui';
import { useVendorListings } from '../hooks/useVendorListings';
import { ListingTable } from '../components/ListingTable';
import { CreateListingForm } from '../components/CreateListingForm';

export function ListingsPage() {
  const {
    listings,
    masterItems,
    form,
    setForm,
    loading,
    saving,
    actionId,
    error,
    notice,
    reload,
    submitCreate,
    toggleActive,
    updatePrice,
  } = useVendorListings();

  return (
    <PortalShell title="My listings" onRefresh={() => void reload()}>
      <section style={styles.section}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}

        {loading && listings.length === 0 ? (
          <p style={styles.muted}>Loading listings…</p>
        ) : (
          <ListingTable
            listings={listings}
            actionId={actionId}
            onToggle={(listing) => void toggleActive(listing)}
            onEditPrice={(listing) => void updatePrice(listing)}
          />
        )}
      </section>

      <CreateListingForm
        form={form}
        masterItems={masterItems}
        saving={saving}
        onChange={setForm}
        onSubmit={() => void submitCreate()}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'grid', gap: '0.75rem' },
  muted: { color: 'var(--text-muted)' },
};
