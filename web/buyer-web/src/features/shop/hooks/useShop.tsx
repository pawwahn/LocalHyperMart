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
  deleteAddress,
  fetchCart,
  fetchWalletBalance,
  friendlyCartError,
  isCartTownConflict,
  isListingUnavailableError,
  isPlaceholderListingId,
  listAddresses,
  listMyOrders,
  fetchPaymentCheckout,
  placeOrder,
  removeCartItem,
  removePromo,
  updateAddress,
  updateCartItem,
  type AddressDto,
  type CartLineView,
  type CartView,
  type CatalogItemView,
  type CreateOrderDto,
  type OrderSummaryDto,
} from '../api/shopApi';
import { pollUntilCheckoutReady } from '../lib/paymentCheckoutPoll';
import type { GatewayCheckout } from '../lib/razorpayCheckout';

export type CheckoutOutcome =
  | { ok: false }
  | { ok: true; kind: 'placed'; orderId: string; orderNumber: string; status: string }
  | { ok: true; kind: 'pay'; orderId: string; orderNumber: string; checkout: GatewayCheckout };

type ShopContextValue = ReturnType<typeof useShopState>;

const ShopContext = createContext<ShopContextValue | null>(null);

type CartDraftLine = {
  listingId: string;
  quantity: number;
  name: string;
  shopName: string;
  unitPrice: number;
};

function cartDraftKey(userId: string, townId: string): string {
  return `hlm.cart.draft.${userId}.${townId}`;
}

function readCartDraft(userId: string, townId: string): CartDraftLine[] {
  try {
    const raw = sessionStorage.getItem(cartDraftKey(userId, townId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartDraftLine[];
    return Array.isArray(parsed) ? parsed.filter((l) => l.listingId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeCartDraft(userId: string, townId: string, lines: CartDraftLine[]): void {
  try {
    const key = cartDraftKey(userId, townId);
    if (lines.length === 0) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(lines));
  } catch {
    /* ignore quota */
  }
}

function sameListingId(a: string, b: string): boolean {
  return a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();
}

type AddressSelectionSnapshot = {
  id: string;
  label?: string;
  line1: string;
  recipientName?: string;
  recipientPhone?: string;
  line2?: string;
  landmark?: string;
  pincode?: string;
};

function addressSelectionKey(userId: string, townId: string): string {
  return `hlm.address.selected.${userId}.${townId}`;
}

function readAddressSelection(userId: string, townId: string): AddressSelectionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(addressSelectionKey(userId, townId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AddressSelectionSnapshot;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeAddressSelection(userId: string, townId: string, snap: AddressSelectionSnapshot | null): void {
  try {
    const key = addressSelectionKey(userId, townId);
    if (!snap?.id) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

function snapshotFromAddress(a: AddressDto): AddressSelectionSnapshot {
  return {
    id: a.id,
    label: a.label,
    line1: a.line1,
    recipientName: a.recipientName,
    recipientPhone: a.recipientPhone,
    line2: a.line2,
    landmark: a.landmark,
    pincode: a.pincode,
  };
}

function useShopState() {
  const { session } = useAuth();
  const { townId, townLabel, hasTown, openPicker, switchNotice, clearSwitchNotice } = useTown();
  const [items, setItems] = useState<CatalogItemView[]>([]);
  const [cart, setCart] = useState<CartView | null>(null);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [orders, setOrders] = useState<OrderSummaryDto[]>([]);
  const [selectedAddressId, setSelectedAddressIdState] = useState<string>('');
  const [addressSelectionSnap, setAddressSelectionSnap] = useState<AddressSelectionSnapshot | null>(
    null,
  );

  const setSelectedAddressId = useCallback(
    (idOrFn: string | ((prev: string) => string)) => {
      setSelectedAddressIdState((prev) =>
        typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn,
      );
    },
    [],
  );

  useEffect(() => {
    if (!session?.userId || !townId) {
      setAddressSelectionSnap(null);
      return;
    }
    if (!selectedAddressId) {
      setAddressSelectionSnap(null);
      writeAddressSelection(session.userId, townId, null);
      return;
    }
    const match = addresses.find((a) => a.id === selectedAddressId);
    if (match) {
      const snap = snapshotFromAddress(match);
      setAddressSelectionSnap(snap);
      writeAddressSelection(session.userId, townId, snap);
      return;
    }
    const saved = readAddressSelection(session.userId, townId);
    if (saved?.id === selectedAddressId) {
      setAddressSelectionSnap(saved);
    }
  }, [selectedAddressId, addresses, session?.userId, townId]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const hasLoadedOnce = useRef(false);
  const cartRef = useRef<CartView | null>(null);
  // Last cart confirmed by the server. cartRef also holds optimistic edits, so it
  // cannot be used to decide what still needs to be pushed.
  const serverCartRef = useRef<CartView | null>(null);
  const itemsRef = useRef<CatalogItemView[]>([]);
  const desiredQtyRef = useRef<Map<string, number>>(new Map());
  const syncChainRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (cart && cart.items.length > 0 && error === 'Cart is empty') {
      setError(null);
    }
  }, [cart, error]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!switchNotice) return;
    setNotice(switchNotice);
    setError(null);
    clearSwitchNotice();
  }, [switchNotice, clearSwitchNotice]);

  function quantityFor(listingId: string): number {
    for (const [id, qty] of desiredQtyRef.current.entries()) {
      if (sameListingId(id, listingId)) return qty;
    }
    for (const line of cart?.items ?? []) {
      if (sameListingId(line.listingId, listingId)) return line.quantity;
    }
    return 0;
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

  function draftFromCart(view: CartView | null): CartDraftLine[] {
    return (view?.items ?? []).map((i) => {
      const unit =
        i.quantity > 0 ? Number(i.lineLabel.replace(/[^\d.]/g, '') || 0) / i.quantity : 0;
      return {
        listingId: i.listingId,
        quantity: i.quantity,
        name: i.name,
        shopName: i.shopName,
        unitPrice: Number.isFinite(unit) ? unit : 0,
      };
    });
  }

  function persistCartDraft(view: CartView | null) {
    if (!session?.userId || !townId) return;
    writeCartDraft(session.userId, townId, draftFromCart(view));
  }

  function applyServerCart(next: CartView) {
    const local = cartRef.current;
    const pending = [...desiredQtyRef.current.entries()].filter(([, qty]) => qty > 0);
    const keepLocal =
      next.items.length === 0 &&
      Boolean(local?.items.length) &&
      (pending.length > 0 || local!.items.some((i) => i.itemId.startsWith('optimistic-')));
    if (keepLocal) {
      persistCartDraft(local);
      return;
    }
    serverCartRef.current = next;
    const previousItems = local?.items ?? cartRef.current?.items ?? [];
    let merged = mergePendingDesiredQuantities(next);
    merged = {
      ...merged,
      items: orderCartItems(previousItems, merged.items),
    };
    cartRef.current = merged;
    setCart(merged);
    persistCartDraft(merged);
  }

  function orderCartItems(previous: CartLineView[], next: CartLineView[]): CartLineView[] {
    if (previous.length === 0) return next;
    const used = new Set<string>();
    const ordered: CartLineView[] = [];
    for (const prev of previous) {
      const match = next.find(
        (line) => !used.has(line.itemId) && sameListingId(line.listingId, prev.listingId),
      );
      if (match) {
        ordered.push(match);
        used.add(match.itemId);
      }
    }
    for (const line of next) {
      if (!used.has(line.itemId)) {
        ordered.push(line);
        used.add(line.itemId);
      }
    }
    return ordered;
  }

  function findRealCartLine(listingId: string): CartLineView | undefined {
    return (
      serverCartRef.current?.items.find(
        (i) => sameListingId(i.listingId, listingId) && !i.itemId.startsWith('optimistic-'),
      ) ??
      cartRef.current?.items.find(
        (i) => sameListingId(i.listingId, listingId) && !i.itemId.startsWith('optimistic-'),
      )
    );
  }

  function desiredQtyEntry(listingId: string): [string, number] | undefined {
    for (const [id, qty] of desiredQtyRef.current.entries()) {
      if (sameListingId(id, listingId)) return [id, qty];
    }
    return undefined;
  }

  function setDesiredQty(listingId: string, qty: number) {
    for (const id of [...desiredQtyRef.current.keys()]) {
      if (sameListingId(id, listingId)) desiredQtyRef.current.delete(id);
    }
    desiredQtyRef.current.set(listingId, qty);
  }

  function clearDesiredQty(listingId: string) {
    for (const id of [...desiredQtyRef.current.keys()]) {
      if (sameListingId(id, listingId)) desiredQtyRef.current.delete(id);
    }
  }

  function resetCartState() {
    serverCartRef.current = null;
    cartRef.current = null;
    desiredQtyRef.current.clear();
    setCart(null);
  }

  function cartViewWithLineQuantity(base: CartView, listingId: string, nextQty: number): CartView {
    const catalog = itemsRef.current.find((i) => sameListingId(i.listingId, listingId));
    const existing = base.items.find((i) => sameListingId(i.listingId, listingId));
    let items: CartLineView[];

    if (nextQty <= 0) {
      items = base.items.filter((i) => !sameListingId(i.listingId, listingId));
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
        sameListingId(i.listingId, listingId)
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
    return {
      ...base,
      items,
      itemCount,
      subtotalLabel: moneyLabel(approxSubtotal),
      payableSubtotal,
      payableLabel: moneyLabel(payableSubtotal),
      minOrderMet: true,
    };
  }

  function mergePendingDesiredQuantities(serverCart: CartView): CartView {
    let view = serverCart;
    for (const [listingId, desired] of desiredQtyRef.current.entries()) {
      const line = view.items.find((i) => sameListingId(i.listingId, listingId));
      const serverQty = line?.quantity ?? 0;
      if (desired !== serverQty) {
        view = cartViewWithLineQuantity(view, listingId, desired);
      }
    }
    return view;
  }

  function patchLocalQuantity(listingId: string, nextQty: number) {
    setDesiredQty(listingId, nextQty);
    setCart((prev) => {
      const next = cartViewWithLineQuantity(prev ?? emptyCartView(), listingId, nextQty);
      cartRef.current = next;
      persistCartDraft(next);
      return next;
    });
  }

  async function flushListingToServer(listingId: string) {
    if (!session || !townId) return;

    const pushUntilSynced = async () => {
      for (let step = 0; step < 8; step += 1) {
        const pendingEntry = desiredQtyEntry(listingId);
        if (!pendingEntry) break;
        const target = pendingEntry[1];

        let realLine = findRealCartLine(listingId);
        if (!realLine && target > 0) {
          const fresh = await fetchCart(session.accessToken, townId);
          serverCartRef.current = fresh;
          realLine = findRealCartLine(listingId);
        }

        let next: CartView;
        if (target <= 0) {
          if (realLine) {
            next = await removeCartItem(session.accessToken, realLine.itemId);
          } else {
            clearDesiredQty(listingId);
            break;
          }
        } else if (!realLine) {
          // POST /cart/items adds quantity; only use when the listing is not on the server yet.
          next = await addToCart(session.accessToken, townId, listingId, target);
        } else if (realLine.quantity === target) {
          clearDesiredQty(listingId);
          break;
        } else {
          next = await updateCartItem(session.accessToken, realLine.itemId, target);
        }

        applyServerCart(next);

        const serverQty =
          next.items.find((i) => sameListingId(i.listingId, listingId))?.quantity ?? 0;
        const pending = desiredQtyEntry(listingId)?.[1];
        if (pending === undefined || pending === serverQty) {
          clearDesiredQty(listingId);
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
          applyServerCart(cleared);
          setError(null);
          await pushUntilSynced();
          return;
        } catch (recoverErr) {
          clearDesiredQty(listingId);
          setError(friendlyCartError(recoverErr, 'Could not update cart'));
          return;
        }
      }

      clearDesiredQty(listingId);
      if (isListingUnavailableError(err)) {
        const serverQty =
          serverCartRef.current?.items.find((i) => sameListingId(i.listingId, listingId))
            ?.quantity ?? 0;
        patchLocalQuantity(listingId, serverQty);
        setError('This item is no longer available. Choose another deal or refresh the page.');
      } else {
        setError(friendlyCartError(err, 'Could not update cart'));
      }
      try {
        applyServerCart(await fetchCart(session.accessToken, townId));
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
      resetCartState();
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
      if (/request timed out/i.test(raw)) {
        // Order history must never paint Basket red — checkout does not need it.
        if (/orders/i.test(fallback)) return;
        errors.push(
          fallback.includes('Cart')
            ? 'Cart service is slow. Your items are still here — tap Place order again.'
            : fallback.includes('Addresses')
              ? 'Could not refresh addresses. Use the one already selected, or open Addresses.'
              : fallback,
        );
        return;
      }
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
      if (!session) {
        resetCartState();
        setAddresses([]);
        setOrders([]);
        setStoreCreditBalance(0);
        return;
      }

      // Wait briefly for in-flight qty syncs — never block Basket on a hung add/update.
      const pendingSyncs = [...syncChainRef.current.values()];
      if (pendingSyncs.length > 0) {
        await Promise.race([
          Promise.all(pendingSyncs.map((p) => p.catch(() => undefined))),
          new Promise((resolve) => window.setTimeout(resolve, 1_500)),
        ]);
      }

      const cartTask = fetchCart(session.accessToken, townId)
        .then((next) => {
          applyServerCart(next);
          // Keep any still-pending optimistic qty visible and push it again.
          for (const [listingId, qty] of [...desiredQtyRef.current.entries()]) {
            patchLocalQuantity(listingId, qty);
            enqueueListingSync(listingId);
          }
          const after = cartRef.current;
          if ((!after || after.items.length === 0) && session.userId && townId) {
            const draft = readCartDraft(session.userId, townId);
            if (draft.length > 0) {
              const extra: CatalogItemView[] = draft.map((line) => ({
                listingId: line.listingId,
                name: line.name,
                shopName: line.shopName,
                unit: '',
                price: line.unitPrice,
                priceLabel: moneyLabel(line.unitPrice),
                avgRating: 0,
                ratingCount: 0,
                imageUrls: [],
              }));
              const seen = new Set(itemsRef.current.map((i) => i.listingId));
              const merged = [...itemsRef.current, ...extra.filter((i) => !seen.has(i.listingId))];
              itemsRef.current = merged;
              setItems(merged);
              for (const line of draft) {
                patchLocalQuantity(line.listingId, line.quantity);
                enqueueListingSync(line.listingId);
              }
            }
          }
        })
        .catch((err) => noteFailure(err, 'Cart failed'));

      const addressTask = listAddresses(session.accessToken)
        .then((addrs) => {
          setAddresses(addrs);
          const forTown = addrs.filter((a) => a.townId === townId);
          setSelectedAddressIdState((prev) => {
            if (prev && forTown.some((a) => a.id === prev)) return prev;
            const saved =
              session.userId && townId
                ? readAddressSelection(session.userId, townId)
                : null;
            if (saved?.id && forTown.some((a) => a.id === saved.id)) return saved.id;
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
          if (err instanceof ApiError && err.isUnauthorized) throw err;
        });

      const walletTask = fetchWalletBalance(session.accessToken)
        .then((wallet) => {
          setStoreCreditBalance(Number(wallet.balance ?? 0));
        })
        .catch(() => {
          setStoreCreditBalance(0);
        });

      await Promise.all([cartTask, addressTask, ordersTask, walletTask]);
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Your sign-in expired. Please sign in again.');
        resetCartState();
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
  }, [session, townId, hasTown]);

  useEffect(() => {
    desiredQtyRef.current.clear();
    syncChainRef.current.clear();
    setItems([]);
    setError(null);
  }, [townId]);

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
    if (isPlaceholderListingId(listingId)) {
      setError('This preview item cannot be added yet. Pick a live product from the shop.');
      return;
    }
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
        applyServerCart(next);
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
      applyServerCart(await removeCartItem(session!.accessToken, itemId));
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
      applyServerCart(next);
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
      applyServerCart(await removePromo(session!.accessToken, townId));
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

  async function doDeleteAddress(addressId: string): Promise<boolean> {
    if (!session) return false;
    const existing = addresses.find((a) => a.id === addressId);
    if (!existing) {
      setError('Address not found');
      return false;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAddress(session.accessToken, addressId);
      const remaining = addresses.filter((a) => a.id !== addressId);
      setAddresses(remaining);
      setSelectedAddressId((prev) => {
        if (prev !== addressId) return prev;
        return remaining[0]?.id ?? '';
      });
      setNotice('Address deleted.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete address');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function waitForCartSync(timeoutMs = 8_000) {
    const pending = [...syncChainRef.current.values()];
    if (pending.length === 0) return;
    await Promise.race([
      Promise.all(pending.map((p) => p.catch(() => undefined))),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  }

  function basketAlreadyOnServer(local: CartView): boolean {
    if (!local.cartId) return false;
    return local.items.every((line) => {
      if (isPlaceholderListingId(line.listingId) || line.itemId.startsWith('optimistic-')) return false;
      const onServer = serverCartRef.current?.items.find(
        (i) => sameListingId(i.listingId, line.listingId) && !i.itemId.startsWith('optimistic-'),
      );
      return Boolean(onServer && onServer.quantity === line.quantity);
    });
  }

  async function persistBasketToServer(): Promise<{ cart: CartView | null; error: string | null }> {
    if (!session || !townId) {
      return { cart: cartRef.current, error: !session ? 'Sign in to place an order' : 'Choose your town first' };
    }
    const local = cartRef.current;
    if (!local?.items.length) {
      return { cart: local, error: null };
    }
    if (basketAlreadyOnServer(local)) {
      return { cart: local, error: null };
    }

    let latest: CartView;
    try {
      latest = await fetchCart(session.accessToken, townId);
    } catch (err) {
      if (local.cartId && local.items.every((line) => !line.itemId.startsWith('optimistic-'))) {
        return { cart: local, error: null };
      }
      return { cart: local, error: friendlyCartError(err, 'Could not reach the cart service') };
    }

    for (const line of local.items) {
      if (isPlaceholderListingId(line.listingId)) {
        return { cart: local, error: `${line.name} is a preview item and cannot be ordered.` };
      }
      const onServer = latest.items.find(
        (i) => sameListingId(i.listingId, line.listingId) && !i.itemId.startsWith('optimistic-'),
      );
      try {
        latest = !onServer
          ? await addToCart(session.accessToken, townId, line.listingId, line.quantity)
          : onServer.quantity === line.quantity
            ? latest
            : await updateCartItem(session.accessToken, onServer.itemId, line.quantity);
        applyServerCart(latest);
      } catch (err) {
        return {
          cart: cartRef.current,
          error: friendlyCartError(err, `Could not save ${line.name} to your basket`),
        };
      }
    }
    return { cart: cartRef.current, error: null };
  }

  async function doCheckout(opts?: { useStoreCredit?: boolean; paymentMethod?: 'COD' | 'ONLINE' }): Promise<CheckoutOutcome> {
    if (!session) {
      setError('Sign in to place an order');
      return { ok: false };
    }
    const persisted = await persistBasketToServer();
    const current = persisted.cart;
    if (persisted.error) {
      setError(persisted.error);
      return { ok: false };
    }
    if (!current?.items.length) {
      setError(null);
      return { ok: false };
    }
    if (!current.cartId) {
      setError('Could not save your basket. Check that cart-service is running, then tap Place order again.');
      return { ok: false };
    }
    if (!hasTown || !townId) {
      setError('Choose your town first');
      openPicker();
      return { ok: false };
    }
    if (!selectedAddressId) {
      setError('Add / select a delivery address first');
      return { ok: false };
    }
    const selected = addresses.find((a) => a.id === selectedAddressId);
    if (!selected || selected.townId !== townId) {
      setError('Delivery address must be in the selected town. Add or select an address for this town.');
      return { ok: false };
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const order: CreateOrderDto = await placeOrder(session.accessToken, {
        townId,
        cartId: current.cartId,
        addressId: selectedAddressId,
        useStoreCredit: Boolean(opts?.useStoreCredit),
        paymentMethod: opts?.paymentMethod ?? 'COD',
      });
      if (order.status === 'PAYMENT_PENDING') {
        let checkout = order.payment?.checkout;
        const paymentId = order.payment?.paymentId;
        if (!checkout?.gatewayOrderId && paymentId) {
          checkout = await pollUntilCheckoutReady(
            () => fetchPaymentCheckout(session.accessToken, paymentId),
            { timeoutMs: 28_000, intervalMs: 350 },
          );
        }
        if (checkout?.gatewayOrderId) {
          void reload();
          return {
            ok: true,
            kind: 'pay',
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            checkout,
          };
        }
      }
      void reload();
      return { ok: true, kind: 'placed', orderId: order.orderId, orderNumber: order.orderNumber, status: order.status };
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Checkout failed';
      if (/address must belong/i.test(raw)) {
        setError('Delivery address is for another town. Add or select an address in your current town, then retry.');
      } else if (/cart is not active/i.test(raw)) {
        try {
          await reload();
        } catch {
          /* show the message even if reload fails */
        }
        setError('This basket was already used on a failed checkout. Refresh the page, add the items again, then place the order.');
      } else if (/could not start online payment|payment service is busy/i.test(raw)) {
        setError(raw);
      } else if (/cart service is busy|could not load your basket/i.test(raw)) {
        setError(raw);
      } else if (err instanceof ApiError && err.status >= 500) {
        const rebuildHint =
          /internal server error/i.test(raw)
            ? ' Order-service may be on an old build — run .\\scripts\\stop-dev.ps1 then .\\scripts\\start-dev.ps1 -Rebuild.'
            : ' If this keeps happening, run stop-dev then start-dev -Rebuild.';
        setError(`${raw}.${rebuildHint}`);
      } else if (/internal server error|request timed out|failed to fetch|networkerror/i.test(raw)) {
        setError(
          'Checkout could not reach the server. Refresh the page. If it keeps failing, run stop-dev then start-dev with -Rebuild after backend changes.',
        );
      } else {
        setError(raw);
      }
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  const rememberItems = useCallback((next: CatalogItemView[], mode: 'replace' | 'append') => {
    setItems((prev) => {
      const merged =
        mode === 'replace'
          ? next
          : (() => {
              const seen = new Set(prev.map((i) => i.listingId));
              return [...prev, ...next.filter((i) => !seen.has(i.listingId))];
            })();
      itemsRef.current = merged;
      return merged;
    });
  }, []);

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
    selectedAddressId,
    selectedAddressSnapshot: addressSelectionSnap,
    setSelectedAddressId,
    loading,
    busy,
    busyKey,
    error,
    notice,
    setError,
    setNotice,
    reload,
    rememberItems,
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
    doDeleteAddress,
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
