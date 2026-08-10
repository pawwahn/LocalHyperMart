import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { resolveTownDisplayName } from '@/features/towns/api/townsApi';
import {
  fetchMyShop,
  setShopAcceptingOrders,
  updateShopProfile,
  type UpdateShopProfileInput,
  type VendorShopStatus,
} from '../api/shopApi';

let shopCache: { vendorId: string; shop: VendorShopStatus; townName: string | null } | null = null;

export function useVendorShop() {
  const { session, updateSession } = useAuth();
  const token = session?.accessToken;
  const vendorId = session?.vendorId;
  const cached =
    vendorId && shopCache?.vendorId === vendorId ? shopCache : null;

  const [shop, setShop] = useState<VendorShopStatus | null>(cached?.shop ?? null);
  const [townName, setTownName] = useState<string | null>(cached?.townName ?? null);
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyShop = useCallback(
    async (data: VendorShopStatus) => {
      setShop(data);
      let resolvedTown: string | null = null;
      try {
        resolvedTown = await resolveTownDisplayName(data.townId);
      } catch {
        resolvedTown = null;
      }
      setTownName(resolvedTown);
      if (vendorId) {
        shopCache = { vendorId, shop: data, townName: resolvedTown };
      }
      if (data.shopName) {
        updateSession({ shopName: data.shopName, townName: resolvedTown ?? undefined });
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
      await applyShop(data);
    } catch (err) {
      setShop(null);
      setTownName(null);
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
      await applyShop(data);
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
      await applyShop(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shop profile');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const hub = {
    hubName: shop?.hubName ?? '',
    hubPhone: shop?.hubPhone ?? '',
    hubHours: shop?.hubHours ?? '',
  };

  return {
    shop,
    townName: townName ?? session?.townName ?? null,
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
