import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  createListing,
  fetchMasterItems,
  fetchMyListings,
  updateListing,
  type ListingView,
  type MasterItemView,
} from '../api/listingsApi';

export type ListingFormState = {
  masterItemId: string;
  price: string;
  discountPrice: string;
  vendorNote: string;
};

const emptyForm: ListingFormState = {
  masterItemId: '',
  price: '',
  discountPrice: '',
  vendorNote: '',
};

export function useVendorListings() {
  const { session } = useAuth();
  const [listings, setListings] = useState<ListingView[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItemView[]>([]);
  const [form, setForm] = useState<ListingFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [list, masters] = await Promise.all([
        fetchMyListings(session.accessToken, session.vendorId),
        fetchMasterItems(session.accessToken),
      ]);
      setListings(list);
      setMasterItems(masters);
      setForm((prev) => ({
        ...prev,
        masterItemId: prev.masterItemId || masters[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitCreate() {
    if (!session) return;
    const price = Number(form.price);
    const discount = form.discountPrice.trim() ? Number(form.discountPrice) : null;
    if (!form.masterItemId) {
      setError('Choose a master item');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid price');
      return;
    }
    if (discount != null && (!Number.isFinite(discount) || discount <= 0)) {
      setError('Enter a valid discount price or leave blank');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createListing(session.accessToken, session.vendorId, {
        masterItemId: form.masterItemId,
        price,
        discountPrice: discount,
        vendorNote: form.vendorNote.trim() || undefined,
        active: true,
      });
      setNotice('Listing created.');
      setForm((prev) => ({ ...emptyForm, masterItemId: prev.masterItemId }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create listing');
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
      await updateListing(session.accessToken, session.vendorId, listing.id, {
        active: !listing.active,
      });
      setNotice(listing.active ? 'Listing deactivated.' : 'Listing activated.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update listing');
    } finally {
      setActionId(null);
    }
  }

  async function updatePrice(listing: ListingView) {
    if (!session) return;
    const raw = window.prompt(`New price for ${listing.name}`, listing.priceLabel.replace('₹', ''));
    if (raw == null) return;
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Invalid price');
      return;
    }
    setActionId(listing.id);
    setError(null);
    setNotice(null);
    try {
      await updateListing(session.accessToken, session.vendorId, listing.id, { price });
      setNotice('Price updated.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update price');
    } finally {
      setActionId(null);
    }
  }

  return {
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
  };
}
