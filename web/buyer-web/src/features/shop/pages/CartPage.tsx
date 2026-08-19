import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { apiRequest } from '@/shared/api/http';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { Banner, Button, Card, EmptyState, TextField } from '@/shared/ui';
import { AddressPickerSheet } from '../components/AddressPickerSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OrderCelebration } from '../components/OrderCelebration';
import { CartSuggestionStrip } from '../components/CartSuggestionStrip';
import { QuantityStepper } from '../components/QuantityStepper';
import { fetchCartSuggestions, type CatalogItemView } from '../api/shopApi';
import { productVisual } from '../lib/productVisual';
import { useShop } from '../hooks/useShop';

const DEFAULT_DELIVERY_FEE = 40;

export function CartPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { townId } = useTown();
  const {
    cart,
    addresses,
    townLabel,
    hasTown,
    openTownPicker,
    storeCreditBalance,
    selectedAddressId,
    setSelectedAddressId,
    busy,
    busyKey,
    error,
    notice,
    reload,
    rememberItems,
    quantityFor,
    doIncrease,
    doDecrease,
    doSetLineQuantity,
    doApplyPromo,
    doRemovePromo,
    doCreateAddress,
    doCheckout,
  } = useShop();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);
  const [deliveryNudge, setDeliveryNudge] = useState<{ addMore: number; nextFee: number } | null>(null);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [suggestions, setSuggestions] = useState<CatalogItemView[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const couponSectionRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRequestRef = useRef(0);
  const rememberItemsRef = useRef(rememberItems);
  rememberItemsRef.current = rememberItems;

  const hasCartItems = Boolean(cart?.cartId && cart.items.length > 0);
  const needsAddress = hasCartItems && !selectedAddressId;
  const itemsPayable = cart?.payableSubtotal ?? 0;
  const orderGross = itemsPayable + (hasCartItems ? deliveryFee : 0);
  const creditToApply =
    useStoreCredit && storeCreditBalance > 0
      ? Math.min(storeCreditBalance, orderGross)
      : 0;
  const payOnDelivery = Math.max(0, orderGross - creditToApply);
  const payLabel = `₹${payOnDelivery.toFixed(2)}`;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const cartFingerprint = useMemo(
    () => cart?.items.map((item) => `${item.listingId}:${item.quantity}`).join('|') ?? '',
    [cart?.items],
  );

  const loadSuggestions = useCallback(
    async (opts?: { keepPrevious?: boolean }) => {
      if (!session?.accessToken || !townId || !hasCartItems) {
        if (!opts?.keepPrevious) {
          setSuggestions([]);
        }
        setSuggestionsLoading(false);
        return;
      }
      const requestId = ++suggestionsRequestRef.current;
      setSuggestionsLoading(true);
      try {
        const items = await fetchCartSuggestions(session.accessToken, townId, 10);
        if (requestId !== suggestionsRequestRef.current) return;
        setSuggestions(items);
        if (items.length > 0) {
          rememberItemsRef.current(items, 'append');
        }
      } catch {
        if (requestId !== suggestionsRequestRef.current) return;
        if (!opts?.keepPrevious) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === suggestionsRequestRef.current) {
          setSuggestionsLoading(false);
        }
      }
    },
    [session?.accessToken, townId, hasCartItems],
  );

  async function handleRefresh() {
    await reload();
    await loadSuggestions({ keepPrevious: true });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadFee() {
      try {
        if (townId) {
          const params = new URLSearchParams();
          if (itemsPayable > 0) params.set('orderValue', String(itemsPayable));
          const q = params.toString();
          const data = await apiRequest<{
            deliveryFee?: number;
            addMoreForCheaperDelivery?: number;
            nextDeliveryFee?: number;
          }>(
            `/api/v1/towns/${townId}/delivery-fee${q ? `?${q}` : ''}`,
            { token: session?.accessToken },
          );
          if (!cancelled) {
            setDeliveryFee(Math.max(0, Number(data?.deliveryFee) || DEFAULT_DELIVERY_FEE));
            const addMore = Number(data?.addMoreForCheaperDelivery ?? 0);
            const nextFee = Number(data?.nextDeliveryFee);
            setDeliveryNudge(
              hasCartItems && addMore > 0 && Number.isFinite(nextFee)
                ? { addMore, nextFee }
                : null,
            );
          }
          return;
        }
        const s = await getPublicPlatformSettings();
        if (!cancelled) {
          setDeliveryFee(Math.max(0, Number(s.deliveryFee) || DEFAULT_DELIVERY_FEE));
          setDeliveryNudge(null);
        }
      } catch {
        if (!cancelled) {
          setDeliveryFee(DEFAULT_DELIVERY_FEE);
          setDeliveryNudge(null);
        }
      }
    }
    void loadFee();
    return () => {
      cancelled = true;
    };
  }, [townId, itemsPayable, session?.accessToken, hasCartItems]);

  useEffect(() => {
    void loadSuggestions();
    return () => {
      suggestionsRequestRef.current += 1;
    };
  }, [cartFingerprint, loadSuggestions]);

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Enter a coupon code to apply.');
      couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setCouponError(null);
    const result = await doApplyPromo(code);
    if (result.ok) {
      setCouponCode('');
      setCouponError(null);
      return;
    }
    setCouponError(result.message);
    couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleCheckout() {
    if (!hasCartItems) return;

    if (!hasTown) {
      openTownPicker();
      return;
    }

    if (needsAddress) {
      setPickerOpen(true);
      return;
    }

    setConfirmCheckout(true);
  }

  async function confirmAndPlaceOrder() {
    const placed = await doCheckout({ useStoreCredit });
    if (!placed) {
      setConfirmCheckout(false);
      return;
    }
    setConfirmCheckout(false);
    setShowCelebration(true);
  }

  return (
    <PortalShell
      title="Basket"
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void handleRefresh()}
      showDeliveryBanner={false}
      showStickyCart={false}
      footerSlot={
        hasCartItems ? (
          <div style={styles.stickyCheckout}>
            <div style={styles.stickyInner}>
              <div>
                <p style={styles.payLabel}>Cash on delivery</p>
                <p style={styles.payTotal}>{payLabel}</p>
              </div>
              <button
                type="button"
                style={styles.placeBtn}
                disabled={busy}
                onClick={() => void handleCheckout()}
              >
                Place Order
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <AddressPickerSheet
        open={pickerOpen}
        addresses={addresses}
        selectedId={selectedAddressId}
        townLabel={townLabel}
        hasTown={hasTown}
        busy={busy}
        error={error}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelectedAddressId}
        onNeedTown={openTownPicker}
        onCreate={async (values) => Boolean(await doCreateAddress(values))}
      />
      <ConfirmDialog
        open={confirmCheckout}
        title="Confirm your order"
        description={`Place this cash-on-delivery order for ${payLabel} to ${
          selectedAddress?.label || 'your selected address'
        }?`}
        confirmLabel="Yes, place order"
        cancelLabel="Review order"
        busy={busy}
        onConfirm={() => void confirmAndPlaceOrder()}
        onClose={() => setConfirmCheckout(false)}
      />
      <OrderCelebration
        open={showCelebration}
        townLabel={townLabel}
        onClose={() => {
          setShowCelebration(false);
          navigate('/orders');
        }}
      />

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {!cart || cart.items.length === 0 ? (
        <EmptyState
          icon="🧺"
          title="Your basket is empty"
          description="Browse local shops and tap ADD on items you want delivered today."
          actionLabel="Go to shop"
          onAction={() => navigate('/shop')}
        />
      ) : (
        <div style={styles.page}>
          <button type="button" style={styles.deliverRow} onClick={() => setPickerOpen(true)}>
            <span style={styles.deliverPin} aria-hidden>
              📍
            </span>
            <span style={styles.deliverText}>
              <span style={styles.deliverLabel}>Delivering to</span>
              <span style={styles.deliverValue}>
                {selectedAddress
                  ? `${selectedAddress.label || 'Home'} · ${selectedAddress.line1}`
                  : 'Add a delivery address'}
              </span>
            </span>
            <span style={styles.changeBtn}>Change</span>
          </button>

          <div style={styles.list}>
            {cart.items.map((item) => {
              const visual = productVisual(item.name);
              return (
                <Card key={item.itemId} padding="sm" style={styles.row}>
                  <div style={{ ...styles.thumb, background: visual.tint }} aria-hidden>
                    {visual.emoji}
                  </div>
                  <div style={styles.rowBody}>
                    <p style={styles.name}>{item.name}</p>
                    <p style={styles.meta}>
                      {item.shopName} · {item.lineLabel}
                    </p>
                  </div>
                  <QuantityStepper
                    quantity={item.quantity}
                    disabled={busyKey === item.itemId}
                    onIncrease={() => void doSetLineQuantity(item.itemId, item.quantity + 1)}
                    onDecrease={() => void doSetLineQuantity(item.itemId, item.quantity - 1)}
                  />
                </Card>
              );
            })}
          </div>

          {hasCartItems ? (
            <CartSuggestionStrip
              items={suggestions}
              loading={suggestionsLoading}
              busyKey={busyKey}
              quantityFor={quantityFor}
              onIncrease={(listingId) => void doIncrease(listingId)}
              onDecrease={(listingId) => void doDecrease(listingId)}
              onBrowseMore={() => navigate('/shop')}
            />
          ) : null}

          <Card padding="md" style={styles.billCard}>
            <div ref={couponSectionRef} style={styles.couponBlock}>
              <div style={styles.couponRow}>
                {cart.promoCode ? (
                  <>
                    <Banner tone="success" style={{ flex: 1, margin: 0 }}>
                      {cart.promoCode} applied
                      {cart.promoDescription ? ` — ${cart.promoDescription}` : ''} (−
                      {cart.promoDiscountLabel})
                    </Banner>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyKey === 'promo'}
                      onClick={() => {
                        setCouponError(null);
                        void doRemovePromo();
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <TextField
                        aria-label="Coupon code"
                        placeholder="Coupon code e.g. WELCOME50"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value);
                          if (couponError) setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleApplyCoupon();
                        }}
                        style={styles.couponInput}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={busyKey === 'promo' || !couponCode.trim()}
                      onClick={() => void handleApplyCoupon()}
                    >
                      Apply
                    </Button>
                  </>
                )}
              </div>
              {couponError ? (
                <Banner tone="danger" style={styles.couponAlert}>
                  {couponError}
                </Banner>
              ) : null}
            </div>

            <div style={styles.summaryRow}>
              <span>Item total</span>
              <strong>{cart.subtotalLabel}</strong>
            </div>
            {cart.promoDiscount > 0 ? (
              <div style={styles.summaryRow}>
                <span>Coupon discount</span>
                <strong style={styles.discount}>−{cart.promoDiscountLabel}</strong>
              </div>
            ) : null}
            <div style={styles.summaryRow}>
              <span>Delivery fee</span>
              <strong>₹{deliveryFee.toFixed(2)}</strong>
            </div>
            {deliveryNudge ? (
              <p style={styles.deliveryNudge}>
                {deliveryNudge.nextFee <= 0
                  ? `Add ₹${deliveryNudge.addMore.toFixed(2)} more for free delivery`
                  : `Add ₹${deliveryNudge.addMore.toFixed(2)} more to get delivery at ₹${deliveryNudge.nextFee.toFixed(2)}`}
              </p>
            ) : null}
            {creditToApply > 0 ? (
              <div style={styles.summaryRow}>
                <span>Store credit</span>
                <strong style={styles.discount}>−₹{creditToApply.toFixed(2)}</strong>
              </div>
            ) : null}
            <div style={styles.payRow}>
              <span>Pay on delivery</span>
              <strong style={styles.total}>{payLabel}</strong>
            </div>
            {storeCreditBalance > 0 ? (
              <label style={styles.creditToggle}>
                <input
                  type="checkbox"
                  checked={useStoreCredit}
                  onChange={(e) => setUseStoreCredit(e.target.checked)}
                  disabled={busy}
                />
                <span>
                  Use store credit (₹{storeCreditBalance.toFixed(2)} in{' '}
                  <Link to="/wallet" style={{ color: 'inherit', fontWeight: 800 }}>
                    wallet
                  </Link>
                  )
                  {useStoreCredit
                    ? ` · applying ₹${creditToApply.toFixed(2)}`
                    : ' · leave unused in wallet'}
                </span>
              </label>
            ) : null}
          </Card>
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: '0.55rem', paddingBottom: '5.25rem' },
  deliverRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 12,
    padding: '0.5rem 0.7rem',
    minHeight: 48,
    textAlign: 'left',
    cursor: 'pointer',
  },
  deliverPin: { fontSize: '0.95rem', flexShrink: 0 },
  deliverText: { flex: 1, minWidth: 0, display: 'grid', gap: '0.05rem' },
  deliverLabel: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  deliverValue: {
    fontWeight: 700,
    fontSize: '0.86rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  changeBtn: {
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  list: { display: 'grid', gap: '0.45rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.65rem',
    alignItems: 'center',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.2rem',
    flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { margin: 0, fontWeight: 700, fontSize: '0.9rem' },
  meta: { margin: '0.12rem 0 0', color: 'var(--text-muted)', fontSize: '0.76rem' },
  billCard: { display: 'grid', gap: '0.4rem' },
  couponBlock: { display: 'grid', gap: '0.35rem' },
  couponRow: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  couponInput: { padding: '0.5rem 0.7rem' },
  couponAlert: { animation: 'hlm-fade-up 220ms ease both' },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  discount: { color: 'var(--accent)' },
  deliveryNudge: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#b45309',
    lineHeight: 1.35,
  },
  payRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: '0.1rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  creditToggle: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.4rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
    background: 'var(--accent-soft)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.3,
    cursor: 'pointer',
  },
  total: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    color: 'var(--text)',
  },
  stickyCheckout: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    zIndex: 40,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0.85rem 0.45rem',
    pointerEvents: 'none',
  },
  stickyInner: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    background: '#1C1C1C',
    color: '#fff',
    borderRadius: 12,
    padding: '0.5rem 0.5rem 0.5rem 0.95rem',
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
  },
  payLabel: { margin: 0, fontSize: '0.68rem', opacity: 0.75, fontWeight: 700 },
  payTotal: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' },
  placeBtn: {
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    borderRadius: 10,
    padding: '0.8rem 1.1rem',
    minHeight: 44,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
