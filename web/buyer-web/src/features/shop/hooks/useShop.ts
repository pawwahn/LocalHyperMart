import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { PILOT_TOWN_ID } from '@/shared/auth/session';
import { ApiError } from '@/shared/api/http';
import {
  addToCart,
  applyPromo,
  createAddress,
  fetchCart,
  fetchCatalog,
  listAddresses,
  listMyOrders,
  placeCodOrder,
  removeCartItem,
  removePromo,
  updateCartItem,
  type AddressDto,
  type CartLineView,
  type CartView,
  type CatalogItemView,
  type OrderSummaryDto,
} from '../api/shopApi';

export function useShop() {
  const { session } = useAuth();
  const townId = session?.townId || PILOT_TOWN_ID;
  const [items, setItems] = useState<CatalogItemView[]>([]);
  const [cart, setCart] = useState<CartView | null>(null);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [orders, setOrders] = useState<OrderSummaryDto[]>([]);
  const [query, setQuery] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const qtyByListingId = useMemo(() => {
    const map = new Map<string, CartLineView>();
    for (const line of cart?.items ?? []) {
      map.set(line.listingId, line);
    }
    return map;
  }, [cart]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const activeTownId = townId || PILOT_TOWN_ID;

    try {
      const catalog = await fetchCatalog(activeTownId, query || undefined);
      setItems(catalog);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load catalog');
      setLoading(false);
      return;
    }

    if (!session) {
      setCart(null);
      setAddresses([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    const secondaryErrors: string[] = [];
    try {
      setCart(await fetchCart(session.accessToken, activeTownId));
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Your sign-in expired. Please sign in again.');
        setLoading(false);
        return;
      }
      secondaryErrors.push(err instanceof Error ? err.message : 'Cart failed');
    }
    try {
      const addrs = await listAddresses(session.accessToken);
      setAddresses(addrs);
      setSelectedAddressId((prev) => {
        if (prev && addrs.some((a) => a.id === prev)) return prev;
        const preferred = addrs.find((a) => a.isDefault || a.default) ?? addrs[0];
        return preferred?.id ?? '';
      });
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Your sign-in expired. Please sign in again.');
        setLoading(false);
        return;
      }
      secondaryErrors.push(err instanceof Error ? err.message : 'Addresses failed');
    }
    try {
      setOrders(await listMyOrders(session.accessToken, activeTownId));
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Your sign-in expired. Please sign in again.');
        setLoading(false);
        return;
      }
      secondaryErrors.push(err instanceof Error ? err.message : 'Orders failed');
    }

    if (secondaryErrors.length > 0) {
      // Deduplicate identical messages (e.g. same JWT failure text).
      setError([...new Set(secondaryErrors)].join(' · '));
    }
    setLoading(false);
  }, [session, townId, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function withCartBusy<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (!session) {
      setError('Sign in to update your cart.');
      return undefined;
    }
    setBusy(true);
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update cart');
      return undefined;
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  }

  async function doAdd(listingId: string) {
    await withCartBusy(listingId, async () => {
      const next = await addToCart(session!.accessToken, townId, listingId, 1);
      setCart(next);
    });
  }

  async function doIncrease(listingId: string) {
    await withCartBusy(listingId, async () => {
      const line = qtyByListingId.get(listingId);
      const next = line
        ? await updateCartItem(session!.accessToken, line.itemId, line.quantity + 1)
        : await addToCart(session!.accessToken, townId, listingId, 1);
      setCart(next);
    });
  }

  async function doDecrease(listingId: string) {
    const line = qtyByListingId.get(listingId);
    if (!line) return;
    await withCartBusy(listingId, async () => {
      const next =
        line.quantity <= 1
          ? await removeCartItem(session!.accessToken, line.itemId)
          : await updateCartItem(session!.accessToken, line.itemId, line.quantity - 1);
      setCart(next);
    });
  }

  async function doSetLineQuantity(itemId: string, quantity: number) {
    await withCartBusy(itemId, async () => {
      const next =
        quantity <= 0
          ? await removeCartItem(session!.accessToken, itemId)
          : await updateCartItem(session!.accessToken, itemId, quantity);
      setCart(next);
    });
  }

  async function doRemove(itemId: string) {
    await withCartBusy(itemId, async () => {
      setCart(await removeCartItem(session!.accessToken, itemId));
    });
  }

  async function doApplyPromo(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const trimmed = code.trim();
    if (!session) {
      return { ok: false, message: 'Sign in to apply a coupon.' };
    }
    if (!trimmed) {
      return { ok: false, message: 'Enter a coupon code' };
    }

    setBusy(true);
    setBusyKey('promo');
    setNotice(null);
    try {
      const next = await applyPromo(session.accessToken, townId, trimmed);
      setCart(next);
      setError(null);
      setNotice(next.promoCode ? `Coupon ${next.promoCode} applied` : 'Coupon applied');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'This coupon is not valid';
      return { ok: false, message };
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  }

  async function doRemovePromo() {
    await withCartBusy('promo', async () => {
      setCart(await removePromo(session!.accessToken, townId));
      setNotice('Coupon removed');
    });
  }

  async function doCreateAddress(values: {
    label: string;
    recipientName: string;
    recipientPhone: string;
    line1: string;
    line2: string;
    landmark: string;
    pincode: string;
  }) {
    if (!session) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createAddress(session.accessToken, {
        townId,
        label: values.label,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        line1: values.line1,
        line2: values.line2 || undefined,
        landmark: values.landmark || undefined,
        pincode: values.pincode || undefined,
        isDefault: true,
      });
      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.id);
      setNotice('Address saved.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create address');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doCheckout() {
    if (!session || !cart?.cartId) {
      setError('Cart is empty');
      return;
    }
    if (!selectedAddressId) {
      setError('Add / select a delivery address first');
      return;
    }
    if (!cart.minOrderMet) {
      setError(`Add more items — minimum order is ${cart.minOrderLabel} (pilot town rule).`);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const order = await placeCodOrder(session.accessToken, {
        townId,
        cartId: cart.cartId,
        addressId: selectedAddressId,
      });
      setNotice(`Order placed: ${order.orderNumber} (${order.status})`);
      await reload();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Checkout failed';
      if (/internal server error/i.test(raw) && cart && !cart.minOrderMet) {
        setError(`Minimum order is ${cart.minOrderLabel}. Add more items, then try again.`);
      } else if (/internal server error/i.test(raw)) {
        setError(
          'Checkout failed (server). Usually the cart is below the town minimum order (₹199). Add more items and retry.',
        );
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  function quantityFor(listingId: string): number {
    return qtyByListingId.get(listingId)?.quantity ?? 0;
  }

  return {
    items,
    cart,
    addresses,
    orders,
    query,
    setQuery,
    selectedAddressId,
    setSelectedAddressId,
    loading,
    busy,
    busyKey,
    error,
    notice,
    reload,
    quantityFor,
    doAdd,
    doIncrease,
    doDecrease,
    doSetLineQuantity,
    doRemove,
    doApplyPromo,
    doRemovePromo,
    doCreateAddress,
    doCheckout,
  };
}
