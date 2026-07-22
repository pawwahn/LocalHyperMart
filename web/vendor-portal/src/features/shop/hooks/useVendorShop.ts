import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  fetchMyShop,
  setShopAcceptingOrders,
  updateShopProfile,
  type UpdateShopProfileInput,
  type VendorShopStatus,
} from '../api/shopApi';

/** Pilot fallback if shop API is unavailable. */
export const PILOT_HUB_HELP = {
  hubName: 'Narsaraopet Hub',
  hubPhone: '9876500100',
  hubHours: '10:00 AM – 5:00 PM',
};

let shopCache: { vendorId: string; shop: VendorShopStatus } | null = null;

export function useVendorShop() {
  const { session, updateSession } = useAuth();
  const token = session?.accessToken;
  const vendorId = session?.vendorId;
  const cached =
    vendorId && shopCache?.vendorId === vendorId ? shopCache.shop : null;

  const [shop, setShop] = useState<VendorShopStatus | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyShop = useCallback(
    (data: VendorShopStatus) => {
      setShop(data);
      if (vendorId) {
        shopCache = { vendorId, shop: data };
      }
      if (data.shopName) {
        updateSession({ shopName: data.shopName });
      }
    },
    [updateSession, vendorId],
  );

  const reload = useCallback(async () => {
    if (!token || !vendorId) return;
    const soft = shopCache?.vendorId === vendorId;
    if (!soft) setLoading(true);
    setError(null);
    try {
      const data = await fetchMyShop(token, vendorId);
      applyShop(data);
    } catch (err) {
      setShop(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load shop');
    } finally {
      setLoading(false);
    }
  }, [token, vendorId, applyShop]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function setAcceptingOrders(acceptingOrders: boolean): Promise<boolean> {
    if (!token || !vendorId) return false;
    setBusy(true);
    setError(null);
    try {
      const data = await setShopAcceptingOrders(token, vendorId, acceptingOrders);
      applyShop(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update shop');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(input: UpdateShopProfileInput): Promise<boolean> {
    if (!token || !vendorId) return false;
    setBusy(true);
    setError(null);
    try {
      const data = await updateShopProfile(token, vendorId, input);
      applyShop(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shop profile');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const hub = {
    hubName: shop?.hubName || PILOT_HUB_HELP.hubName,
    hubPhone: shop?.hubPhone || PILOT_HUB_HELP.hubPhone,
    hubHours: shop?.hubHours || PILOT_HUB_HELP.hubHours,
  };

  return {
    shop,
    loading,
    busy,
    error,
    acceptingOrders: shop?.acceptingOrders ?? true,
    hub,
    reload,
    setAcceptingOrders,
    saveProfile,
  };
}
