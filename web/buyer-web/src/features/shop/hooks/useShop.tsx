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
  changeCartTown,
  createAddress,
  fetchCart,
  fetchCatalog,
  fetchWalletBalance,
  friendlyCartError,
  isCartTownConflict,
  listAddresses,
  listMyOrders,
  placeCodOrder,
  removeCartItem,
  removePromo,
  updateAddress,
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
  const { townId, townLabel, hasTown, openPicker, switchNotice, clearSwitchNotice } = useTown();
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
  const cartRef = useRef<CartView | null>(null);
  const itemsRef = useRef<CatalogItemView[]>([]);
  const desiredQtyRef = useRef<Map<string, number>>(new Map());
  const syncChainRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!switchNotice) return;
    setNotice(switchNotice);
    setError(null);
    clearSwitchNotice();
  }, [switchNotice, clearSwitchNotice]);

  const qtyByListingId = useMemo(() => {
    const map = new Map<string, CartLineView>();
    for (const line of cart?.items ?? []) {
      map.set(line.listingId, line);
    }
    return map;
  }, [cart]);

  function quantityFor(listingId: string): number {
    if (desiredQtyRef.current.has(listingId)) {
      return desiredQtyRef.current.get(listingId) ?? 0;
    }
    return qtyByListingId.get(listingId)?.quantity ?? 0;
  }

  function moneyLabel(v: number): string {
    return `₹${Number(v).toFixed(2)}`;
  }

  function emptyCartView(): CartView {
    return {
      cartId: null,
      itemCount: 0,
      subtotalLabel: moneyLabel(0),
      promoCode: null,
      promoDescription: null,
      promoDiscount: 0,
      promoDiscountLabel: moneyLabel(0),
      payableSubtotal: 0,
      payableLabel: moneyLabel(0),
      minOrderValue: cartRef.current?.minOrderValue ?? 0,
      minOrderLabel: cartRef.current?.minOrderLabel ?? moneyLabel(0),
      minOrderMet: false,
      items: [],
    };
  }

  function patchLocalQuantity(listingId: string, nextQty: number) {
    desiredQtyRef.current.set(listingId, nextQty);
    setCart((prev) => {
      const base = prev ?? emptyCartView();
      const catalog = itemsRef.current.find((i) => i.listingId === listingId);
      const existing = base.items.find((i) => i.listingId === listingId);
      let items: CartLineView[];

      if (nextQty <= 0) {
        items = base.items.filter((i) => i.listingId !== listingId);
      } else if (existing) {
        const unitFromLine =
          existing.quantity > 0
            ? Number(existing.lineLabel.replace(/[^\d.]/g, '') || 0) / existing.quantity
            : 0;
        const unitPrice =
          catalog?.price && catalog.price > 0
            ? catalog.price
            : Number.isFinite(unitFromLine) && unitFromLine > 0
              ? unitFromLine
              : 0;
        items = base.items.map((i) =>
          i.listingId === listingId
            ? {
                ...i,
                quantity: nextQty,
                lineLabel: moneyLabel(unitPrice * nextQty),
              }
            : i,
        );
      } else {
        items = [
          ...base.items,
          {
            itemId: `optimistic-${listingId}`,
            listingId,
            name: catalog?.name ?? 'Item',
            shopName: catalog?.shopName ?? '',
            quantity: nextQty,
            lineLabel: moneyLabel((catalog?.price ?? 0) * nextQty),
          },
        ];
      }

      const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
      const approxSubtotal = items.reduce((sum, i) => {
        const n = Number(i.lineLabel.replace(/[^\d.]/g, '') || 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      const payableSubtotal = Math.max(0, approxSubtotal - (base.promoDiscount ?? 0));
      const next: CartView = {
        ...base,
        items,
        itemCount,
        subtotalLabel: moneyLabel(approxSubtotal),
        payableSubtotal,
        payableLabel: moneyLabel(payableSubtotal),
        minOrderMet: approxSubtotal >= (base.minOrderValue ?? 0),
      };
      cartRef.current = next;
      return next;
    });
  }

  async function flushListingToServer(listingId: string) {
    if (!session || !townId) return;

    const pushUntilSynced = async () => {
      for (;;) {
        if (!desiredQtyRef.current.has(listingId)) break;
        const target = desiredQtyRef.current.get(listingId) ?? 0;

        const realLine = cartRef.current?.items.find(
          (i) => i.listingId === listingId && !i.itemId.startsWith('optimistic-'),
        );

        let next: CartView;
        if (target <= 0) {
          if (realLine) {
            next = await removeCartItem(session.accessToken, realLine.itemId);
          } else {
            desiredQtyRef.current.delete(listingId);
            break;
          }
        } else if (!realLine) {
          next = await addToCart(session.accessToken, townId, listingId, target);
        } else if (realLine.quantity === target) {
          desiredQtyRef.current.delete(listingId);
          break;
        } else {
          next = await updateCartItem(session.accessToken, realLine.itemId, target);
        }

        cartRef.current = next;
        setCart(next);

        const serverQty = next.items.find((i) => i.listingId === listingId)?.quantity ?? 0;
        const pending = desiredQtyRef.current.get(listingId);
        if (pending === undefined || pending === serverQty) {
          desiredQtyRef.current.delete(listingId);
          break;
        }
      }
    };

    try {
      await pushUntilSynced();
    } catch (err) {
      if (isCartTownConflict(err)) {
        try {
          const cleared = await changeCartTown(session.accessToken, townId, true);
          cartRef.current = cleared;
          setCart(cleared);
          setError(null);
          setNotice(
            `Now shopping in ${townLabel}. Items from your previous town cart were cleared.`,
          );
          await pushUntilSynced();
          return;
        } catch (recoverErr) {
          desiredQtyRef.current.delete(listingId);
          setError(friendlyCartError(recoverErr, 'Could not update cart'));
          return;
        }
      }

      desiredQtyRef.current.delete(listingId);
      setError(friendlyCartError(err, 'Could not update cart'));
      try {
        const fresh = await fetchCart(session.accessToken, townId);
        cartRef.current = fresh;
        setCart(fresh);
      } catch {
        /* keep local until next reload */
      }
    }
  }

  function enqueueListingSync(listingId: string) {
    const prev = syncChainRef.current.get(listingId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => flushListingToServer(listingId));
    syncChainRef.current.set(listingId, next);
    void next.finally(() => {
      if (syncChainRef.current.get(listingId) === next) {
        syncChainRef.current.delete(listingId);
      }
    });
  }

  function requireCartSession(): boolean {
    if (!session) {
      setError('Sign in to update your cart.');
      return false;
    }
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
      return false;
    }
    return true;
  }

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
      if (isCartTownConflict(err)) {
        errors.push(friendlyCartError(err, fallback));
        return;
      }
      const raw = err instanceof Error ? err.message : fallback;
      if (/internal server error/i.test(raw)) {
        errors.push(
          fallback.includes('Cart')
            ? 'Cart service is unavailable. Start cart-service on :8085, then refresh.'
            : `${fallback} (server error). Check that related services are running.`,
        );
        return;
      }
      errors.push(raw || fallback);
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

      // Heal town mismatch before cart reads/writes (clears other-town carts).
      try {
        await changeCartTown(session.accessToken, townId, true);
      } catch {
        /* non-fatal — cart fetch / add will surface errors */
      }

      const cartTask = fetchCart(session.accessToken, townId)
        .then((next) => {
          setCart(next);
        })
        .catch((err) => noteFailure(err, 'Cart failed'));

      const addressTask = listAddresses(session.accessToken)
        .then((addrs) => {
          setAddresses(addrs);
          const forTown = addrs.filter((a) => a.townId === townId);
          setSelectedAddressId((prev) => {
            if (prev && forTown.some((a) => a.id === prev)) return prev;
            const preferred = forTown.find((a) => a.isDefault || a.default) ?? forTown[0];
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

  useEffect(() => {
    if (!session?.accessToken) return;
    function onWalletInvalidate() {
      void fetchWalletBalance(session!.accessToken)
        .then((wallet) => setStoreCreditBalance(Number(wallet.balance ?? 0)))
        .catch(() => {
          /* keep last known balance */
        });
    }
    window.addEventListener('hlm:wallet-invalidate', onWalletInvalidate);
    return () => window.removeEventListener('hlm:wallet-invalidate', onWalletInvalidate);
  }, [session?.accessToken]);

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
    if (!requireCartSession()) return;
    setError(null);
    patchLocalQuantity(listingId, quantityFor(listingId) + 1);
    enqueueListingSync(listingId);
  }

  async function doIncrease(listingId: string) {
    if (!requireCartSession()) return;
    setError(null);
    patchLocalQuantity(listingId, quantityFor(listingId) + 1);
    enqueueListingSync(listingId);
  }

  async function doDecrease(listingId: string) {
    if (!requireCartSession()) return;
    const current = quantityFor(listingId);
    if (current <= 0) return;
    setError(null);
    patchLocalQuantity(listingId, current - 1);
    enqueueListingSync(listingId);
  }

  async function doSetLineQuantity(itemId: string, quantity: number) {
    const line = cartRef.current?.items.find((i) => i.itemId === itemId);
    if (!line) {
      await withCartBusy(itemId, async () => {
        const next =
          quantity <= 0
            ? await removeCartItem(session!.accessToken, itemId)
            : await updateCartItem(session!.accessToken, itemId, quantity);
        setCart(next);
      });
      return;
    }
    if (!requireCartSession()) return;
    setError(null);
    patchLocalQuantity(line.listingId, quantity);
    enqueueListingSync(line.listingId);
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
        landmark: values.landmark.trim(),
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

  async function doUpdateAddress(
    addressId: string,
    values: {
      label: string;
      recipientName: string;
      recipientPhone: string;
      line1: string;
      line2: string;
      landmark: string;
      pincode: string;
    },
  ) {
    if (!session) return false;
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
      return false;
    }
    const existing = addresses.find((a) => a.id === addressId);
    if (!existing) {
      setError('Address not found');
      return false;
    }
    if (existing.townId !== townId) {
      setError('This address belongs to another town. Switch town or add a new address for the selected town.');
      return false;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAddress(session.accessToken, addressId, {
        townId,
        label: values.label,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        line1: values.line1,
        line2: values.line2 || undefined,
        landmark: values.landmark.trim(),
        pincode: values.pincode || undefined,
        isDefault: true,
      });
      if (!updated?.id) {
        throw new Error('Address update did not return saved data. Restart user-service and try again.');
      }
      setAddresses((prev) => {
        const rest = prev.filter((a) => a.id !== updated.id);
        return [updated, ...rest];
      });
      setSelectedAddressId(updated.id);
      setNotice('Address updated.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update address');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doCheckout(opts?: { useStoreCredit?: boolean }) {
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
    const selected = addresses.find((a) => a.id === selectedAddressId);
    if (!selected || selected.townId !== townId) {
      setError('Delivery address must be in the selected town. Add or select an address for this town.');
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
        useStoreCredit: Boolean(opts?.useStoreCredit),
      });
      setNotice(`Order placed: ${order.orderNumber} (${order.status})`);
      await reload();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Checkout failed';
      if (/internal server error/i.test(raw) && cart && !cart.minOrderMet) {
        setError(`Minimum order is ${cart.minOrderLabel}. Add more items, then try again.`);
      } else if (/address must belong/i.test(raw)) {
        setError('Delivery address is for another town. Add or select an address in your current town, then retry.');
      } else if (/internal server error/i.test(raw)) {
        setError('Checkout failed. Check address and town match, then retry. If it keeps failing, refresh and try again.');
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  const townAddresses = useMemo(
    () => (townId ? addresses.filter((a) => a.townId === townId) : []),
    [addresses, townId],
  );

  return {
    items,
    cart,
    addresses: townAddresses,
    allAddresses: addresses,
    townLabel,
    hasTown,
    openTownPicker: openPicker,
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
    doUpdateAddress,
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
