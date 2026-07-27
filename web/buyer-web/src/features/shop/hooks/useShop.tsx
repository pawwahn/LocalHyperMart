import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { ApiError } from '@/shared/api/http';
import {
  addToCart,
  applyPromo,
  createAddress,
  fetchCart,
  fetchCatalog,
  fetchWalletBalance,
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

type ShopContextValue = ReturnType<typeof useShopState>;

const ShopContext = createContext<ShopContextValue | null>(null);

function useShopState() {
  const { session } = useAuth();
  const { townId, hasTown, openPicker } = useTown();
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
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const hasLoadedOnce = useRef(false);

  const qtyByListingId = useMemo(() => {
    const map = new Map<string, CartLineView>();
    for (const line of cart?.items ?? []) {
      map.set(line.listingId, line);
    }
    return map;
  }, [cart]);

  const reload = useCallback(async () => {
    // Keep existing UI visible while refreshing — only flash loading on first load.
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);

    if (!hasTown || !townId) {
      setItems([]);
      setCart(null);
      setAddresses([]);
      setOrders([]);
      setStoreCreditBalance(0);
      hasLoadedOnce.current = true;
      setLoading(false);
      return;
    }

    const errors: string[] = [];

    const noteFailure = (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.isUnauthorized) {
        throw err;
      }
      errors.push(err instanceof Error ? err.message : fallback);
    };

    try {
      // Catalog must not block cart/orders (Orders page was stuck when catalog hung).
      const catalogTask = fetchCatalog(townId, query || undefined)
        .then((catalog) => {
          setItems(catalog);
        })
        .catch((err) => {
          setItems([]);
          noteFailure(err, 'Failed to load catalog');
        });

      if (!session) {
        await catalogTask;
        setCart(null);
        setAddresses([]);
        setOrders([]);
        setStoreCreditBalance(0);
        return;
      }

      const cartTask = fetchCart(session.accessToken, townId)
        .then((next) => {
          setCart(next);
        })
        .catch((err) => noteFailure(err, 'Cart failed'));

      const addressTask = listAddresses(session.accessToken)
        .then((addrs) => {
          setAddresses(addrs);
          setSelectedAddressId((prev) => {
            if (prev && addrs.some((a) => a.id === prev)) return prev;
            const preferred = addrs.find((a) => a.isDefault || a.default) ?? addrs[0];
            return preferred?.id ?? '';
          });
        })
        .catch((err) => noteFailure(err, 'Addresses failed'));

      const ordersTask = listMyOrders(session.accessToken, townId)
        .then((next) => {
          setOrders(next);
        })
        .catch((err) => {
          setOrders([]);
          noteFailure(err, 'Orders failed');
        });

      const walletTask = fetchWalletBalance(session.accessToken)
        .then((wallet) => {
          setStoreCreditBalance(Number(wallet.balance ?? 0));
        })
        .catch(() => {
          setStoreCreditBalance(0);
        });

      await Promise.all([catalogTask, cartTask, addressTask, ordersTask, walletTask]);
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Your sign-in expired. Please sign in again.');
        setCart(null);
        setAddresses([]);
        setOrders([]);
        setStoreCreditBalance(0);
        errors.length = 0;
        return;
      }
      errors.push(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (errors.length > 0) {
        setError([...new Set(errors)].join(' · '));
      }
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [session, townId, hasTown, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    function onInvalidate() {
      void reload();
    }
    window.addEventListener('hlm:catalog-invalidate', onInvalidate);
    return () => window.removeEventListener('hlm:catalog-invalidate', onInvalidate);
  }, [reload]);

  async function withCartBusy<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (!session) {
      setError('Sign in to update your cart.');
      return undefined;
    }
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
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
    if (!hasTown || !townId) {
      openPicker();
      return { ok: false, message: 'Choose your town first' };
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
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
      return false;
    }
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
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
      return;
    }
    if (!selectedAddressId) {
      setError('Add / select a delivery address first');
      return;
    }
    if (!cart.minOrderMet) {
      setError(`Add more items — minimum order is ${cart.minOrderLabel}.`);
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
    storeCreditBalance,
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

/** Shared shop/cart/orders state so tab switches stay instant (no remount refetch flash). */
export function ShopProvider({ children }: { children: ReactNode }) {
  const value = useShopState();
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
