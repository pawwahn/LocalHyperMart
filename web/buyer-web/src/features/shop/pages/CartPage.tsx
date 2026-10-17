import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { Banner, Button, Card, EmptyState, TextField } from '@/shared/ui';
import { confirmOnlinePayment } from '../api/shopApi';
import { CheckoutDismissedError, openRazorpayCheckout } from '../lib/razorpayCheckout';
import { AddressPickerSheet } from '../components/AddressPickerSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OrderCelebration } from '../components/OrderCelebration';
import { BestDealsSheet } from '../components/BestDealsSheet';
import { MealPlannerSheet } from '@/features/meal-planner/components/MealPlannerSheet';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { CartSuggestionStrip } from '../components/CartSuggestionStrip';
import { DeliveryUnlockChip } from '../components/DeliveryUnlockChip';
import { QuantityStepper } from '../components/QuantityStepper';
import { fetchCartSuggestions, fetchCatalogPage, filterDealsForLane, type CatalogItemView } from '../api/shopApi';
import { productVisual } from '../lib/productVisual';
import { useDeliveryQuote } from '../hooks/useDeliveryQuote';
import { useShop } from '../hooks/useShop';
import { cheapestPurchasable, fetchMembershipCatalog, type MembershipCatalog } from '../api/membershipApi';
import { MembershipPlansSheet } from '../components/MembershipPlansSheet';
import { applyReferralCode, getReferralMe, type ReferralMeVm } from '../api/referralApi';
import { ApiError } from '@/shared/api/http';

function formatDeliverAddress(a: {
  label?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  pincode?: string;
  recipientName?: string;
  recipientPhone?: string;
}): string {
  const street = [a.line1, a.line2, a.landmark, a.pincode].filter(Boolean).join(', ');
  const head = [a.label?.trim() || 'Home', a.recipientName?.trim()].filter(Boolean).join(' · ');
  const tail = [street, a.recipientPhone?.trim()].filter(Boolean).join(' · ');
  if (head && tail) return `${head} — ${tail}`;
  return head || tail || '';
}

const STICKY_CSS = `
  .cart-sticky-mid {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1 1 auto;
    min-width: 0;
  }
  .cart-sticky-mid .cart-unlock {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

export function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { townId, bestDealsEnabled, codEnabled, upiEnabled, codCharge } = useTown();
  const {
    cart,
    addresses,
    townLabel,
    hasTown,
    openTownPicker,
    storeCreditBalance,
    selectedAddressId,
    selectedAddressSnapshot,
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
    setError,
    setNotice,
  } = useShop();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const creditChoice = useRef(false);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [dealsOpen, setDealsOpen] = useState(false);
  const [mealPlannerOpen, setMealPlannerOpen] = useState(false);
  const [mealPlannerOn, setMealPlannerOn] = useState(false);
  const openDeals = () => {
    setError(null);
    setDealsOpen(true);
  };
  const openMealPlanner = () => {
    setError(null);
    setMealPlannerOpen(true);
  };
  const [suggestions, setSuggestions] = useState<CatalogItemView[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [memberCredits, setMemberCredits] = useState(0);
  const [membershipCatalog, setMembershipCatalog] = useState<MembershipCatalog | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');
  const [referralInfo, setReferralInfo] = useState<ReferralMeVm | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const couponSectionRef = useRef<HTMLDivElement | null>(null);
  const checkoutErrorRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRequestRef = useRef(0);
  const rememberItemsRef = useRef(rememberItems);
  rememberItemsRef.current = rememberItems;

  const hasCartItems = Boolean(cart && cart.items.length > 0);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) {
      setReferralInfo(null);
      return;
    }
    void getReferralMe(token)
      .then(setReferralInfo)
      .catch(() => setReferralInfo(null));
  }, [session?.accessToken]);

  useEffect(() => {
    let cancelled = false;
    void getPublicPlatformSettings()
      .then((s) => {
        if (!cancelled) setMealPlannerOn(s.mealPlannerEnabled);
      })
      .catch(() => {
        if (!cancelled) setMealPlannerOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const state = location.state as { mealPlanner?: boolean } | null;
    if (!state?.mealPlanner || !mealPlannerOn) return;
    setMealPlannerOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, mealPlannerOn, navigate]);

  async function handleApplyCode() {
    const code = promoInput.trim();
    if (!code) {
      setPromoError('Enter a referral or coupon code.');
      couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setPromoError(null);
    setPromoBusy(true);
    try {
      if (!cart?.promoCode) {
        const promo = await doApplyPromo(code);
        if (promo.ok) {
          setPromoInput('');
          return;
        }
        const canTryReferral =
          Boolean(session?.accessToken) &&
          Boolean(referralInfo?.programEnabled) &&
          !referralInfo?.hasAppliedCode;
        if (canTryReferral) {
          try {
            setReferralInfo(await applyReferralCode(session!.accessToken, code));
            setPromoInput('');
            return;
          } catch {
            setPromoError(promo.message || 'This code isn’t valid as a coupon or referral.');
            couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        setPromoError(promo.message);
        couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (session?.accessToken && referralInfo?.programEnabled && !referralInfo.hasAppliedCode) {
        try {
          setReferralInfo(await applyReferralCode(session.accessToken, code));
          setPromoInput('');
          return;
        } catch (err) {
          setPromoError(err instanceof ApiError || err instanceof Error ? err.message : 'Invalid code');
          couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } finally {
      setPromoBusy(false);
    }
  }

  useEffect(() => {
    if (!hasCartItems && notice && /^Order placed:/i.test(notice)) {
      setNotice(null);
    }
  }, [hasCartItems, notice, setNotice]);

  useEffect(() => {
    window.dispatchEvent(new Event('hlm:wallet-invalidate'));
  }, []);

  useEffect(() => {
    if (creditChoice.current || storeCreditBalance <= 0) return;
    setUseStoreCredit(true);
  }, [storeCreditBalance]);

  const needsAddress = hasCartItems && !selectedAddressId;
  const itemsPayable = cart?.payableSubtotal ?? 0;
  const { deliveryFee, platformFee, nudge: deliveryNudge, progress: unlockProgress } = useDeliveryQuote(
    itemsPayable,
    hasCartItems,
  );
  const starterPlan = cheapestPurchasable(membershipCatalog);
  const showMembershipOffer =
    hasCartItems && Boolean(membershipCatalog?.platformEnabled) && memberCredits <= 0 && Boolean(starterPlan);
  const membershipWaives = hasCartItems && memberCredits > 0 && deliveryFee > 0;
  const chargedDelivery = membershipWaives ? 0 : deliveryFee;
  const codFee = hasCartItems && paymentMethod === 'COD' && codEnabled ? Math.max(0, codCharge) : 0;
  const extras = hasCartItems ? chargedDelivery + platformFee + codFee : 0;
  const orderGross = itemsPayable + extras;
  const creditToApply =
    useStoreCredit && storeCreditBalance > 0
      ? Math.min(storeCreditBalance, orderGross)
      : 0;
  const payOnDelivery = Math.max(0, orderGross - creditToApply);
  const payLabel = `₹${payOnDelivery.toFixed(2)}`;
  const online = paymentMethod === 'ONLINE' && payOnDelivery > 0;
  const showCodOption = codEnabled && payOnDelivery > 0;
  const showUpiOption = upiEnabled && payOnDelivery > 0;
  const showPayMethods = showCodOption || showUpiOption;
  const showMealPlannerLink = mealPlannerOn && Boolean(townId);
  const showStickyMembershipOffer =
    showMembershipOffer && !membershipCatalog?.mine?.active;

  useEffect(() => {
    if (!hasCartItems || payOnDelivery <= 0) return;
    if (codEnabled && !upiEnabled) setPaymentMethod('COD');
    else if (!codEnabled && upiEnabled) setPaymentMethod('ONLINE');
  }, [hasCartItems, payOnDelivery, codEnabled, upiEnabled]);
  const payModeLabel = online ? 'Pay now' : 'Cash on delivery';
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const deliverSummary = useMemo(() => {
    if (selectedAddress) return formatDeliverAddress(selectedAddress);
    if (selectedAddressId && selectedAddressSnapshot?.id === selectedAddressId) {
      return formatDeliverAddress(selectedAddressSnapshot);
    }
    return '';
  }, [selectedAddress, selectedAddressId, selectedAddressSnapshot]);
  const cartFingerprint = useMemo(
    () => cart?.items.map((item) => `${item.listingId}:${item.quantity}`).join('|') ?? '',
    [cart?.items],
  );
  const [dealCatalog, setDealCatalog] = useState<CatalogItemView[]>([]);
  const bestDeals = useMemo(() => filterDealsForLane(dealCatalog, 'all').slice(0, 10), [dealCatalog]);

  useEffect(() => {
    if (!session?.accessToken) {
      setMemberCredits(0);
      setMembershipCatalog(null);
      return;
    }
    let cancelled = false;
    void fetchMembershipCatalog(session.accessToken, townId || undefined)
      .then((catalog) => {
        if (cancelled) return;
        setMembershipCatalog(catalog);
        setMemberCredits(catalog.mine?.usableCredits ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setMemberCredits(0);
        setMembershipCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, townId]);

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
    void loadSuggestions();
    return () => {
      suggestionsRequestRef.current += 1;
    };
  }, [cartFingerprint, loadSuggestions]);

  useEffect(() => {
    if (!bestDealsEnabled) setDealsOpen(false);
  }, [bestDealsEnabled]);

  useEffect(() => {
    if (!townId || !bestDealsEnabled) {
      setDealCatalog([]);
      return;
    }
    let cancelled = false;
    void fetchCatalogPage({ townId, page: 0, size: 48, sort: 'price', dir: 'asc' })
      .then((data) => {
        if (cancelled) return;
        setDealCatalog(data.items);
        rememberItems(data.items, 'append');
      })
      .catch(() => {
        if (!cancelled) setDealCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [townId, bestDealsEnabled, rememberItems]);

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
    setCheckoutBusy(true);
    let result: Awaited<ReturnType<typeof doCheckout>>;
    try {
      const checkoutWaitMs = online ? 75_000 : 25_000;
      result = await Promise.race([
        doCheckout({ useStoreCredit, paymentMethod: online ? 'ONLINE' : 'COD' }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(
              new Error(
                online
                  ? 'Online checkout is taking longer than usual. Open My orders — if the order is there, finish payment from the order page.'
                  : 'Checkout is taking too long. Open My orders — if the order is there, you are done.',
              ),
            );
          }, checkoutWaitMs);
        }),
      ]);
    } catch (err) {
      setCheckoutBusy(false);
      setConfirmCheckout(false);
      setError(err instanceof Error ? err.message : 'Could not place the order. Try again.');
      return;
    }
    setCheckoutBusy(false);
    if (!result.ok) {
      setConfirmCheckout(false);
      requestAnimationFrame(() => {
        checkoutErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setConfirmCheckout(false);
    if (result.kind === 'pay') {
      if (!result.checkout.keyId) {
        setError('Online payment is not configured yet. Use cash on delivery, or add Razorpay keys and restart payment-service.');
        checkoutErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      try {
        const paid = await openRazorpayCheckout(result.checkout, {
          contact: session?.phone,
        });
        await confirmOnlinePayment(session?.accessToken ?? '', paid);
        setShowCelebration(true);
        await reload();
      } catch (err) {
        if (err instanceof CheckoutDismissedError) {
          setNotice(`Order ${result.orderNumber} is waiting for payment. Open it in My orders to finish paying.`);
          navigate(`/orders/${result.orderId}`);
          return;
        }
        setError(err instanceof Error ? err.message : 'Payment failed');
        checkoutErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
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
            <style>{STICKY_CSS}</style>
            <div style={styles.stickyInner}>
              <div style={styles.payBlock}>
                <p style={styles.payLabel}>{payModeLabel}</p>
                <p style={styles.payTotal}>{payLabel}</p>
              </div>
              <div className="cart-sticky-mid">
                {deliveryNudge ? (
                  <DeliveryUnlockChip
                    layout="compact"
                    addMore={deliveryNudge.addMore}
                    nextFee={deliveryNudge.nextFee}
                    progress={unlockProgress}
                  />
                ) : (
                  <span style={styles.unlockSpacer} />
                )}
                {showStickyMembershipOffer ? (
                  <button type="button" style={styles.stickyLink} onClick={() => setPlansOpen(true)}>
                    Free delivery ₹{Number(starterPlan?.price ?? 0).toFixed(0)}
                  </button>
                ) : null}
                {showMealPlannerLink ? (
                  <button type="button" style={styles.stickyLink} onClick={openMealPlanner}>
                    Meal planner
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="cart-place-btn"
                style={styles.placeBtn}
                disabled={busy}
                onClick={() => void handleCheckout()}
              >
                Place order
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
        description={
          online
            ? `Pay ${payLabel} online for delivery to ${selectedAddress?.label || 'your selected address'}?`
            : `Place this cash-on-delivery order for ${payLabel} to ${
                selectedAddress?.label || 'your selected address'
              }?`
        }
        confirmLabel={online ? 'Pay now' : 'Yes, place order'}
        cancelLabel="Review order"
        busy={checkoutBusy}
        onConfirm={() => void confirmAndPlaceOrder()}
        onClose={() => !checkoutBusy && setConfirmCheckout(false)}
      />
      <OrderCelebration
        open={showCelebration}
        townLabel={townLabel}
        onClose={() => {
          setShowCelebration(false);
          navigate('/orders');
        }}
      />
      <BestDealsSheet
        open={dealsOpen && bestDealsEnabled}
        busyKey={busyKey}
        quantityFor={quantityFor}
        rememberItems={rememberItems}
        onIncrease={(listingId) => void doIncrease(listingId)}
        onDecrease={(listingId) => void doDecrease(listingId)}
        onClose={() => setDealsOpen(false)}
      />
      <MealPlannerSheet
        open={mealPlannerOpen && mealPlannerOn}
        townId={townId ?? ''}
        busyKey={busyKey}
        quantityFor={quantityFor}
        rememberItems={rememberItems}
        onIncrease={(listingId) => void doIncrease(listingId)}
        onDecrease={(listingId) => void doDecrease(listingId)}
        onClose={() => setMealPlannerOpen(false)}
      />
      <MembershipPlansSheet
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        onBought={() => {
          void fetchMembershipCatalog(session?.accessToken ?? '', townId || undefined)
            .then((catalog) => {
              setMembershipCatalog(catalog);
              setMemberCredits(catalog.mine?.usableCredits ?? 0);
            })
            .catch(() => undefined);
        }}
      />

      {error && error !== 'Cart is empty' ? (
        <div ref={checkoutErrorRef}>
          <Banner tone="danger">{error}</Banner>
        </div>
      ) : null}
      {notice && hasCartItems ? <Banner tone="success">{notice}</Banner> : null}

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
                {deliverSummary || 'Add a delivery address'}
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
                    quantity={quantityFor(item.listingId)}
                    disabled={busyKey === item.itemId}
                    onIncrease={() =>
                      void doSetLineQuantity(item.itemId, quantityFor(item.listingId) + 1)
                    }
                    onDecrease={() =>
                      void doSetLineQuantity(item.itemId, quantityFor(item.listingId) - 1)
                    }
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
              {referralInfo?.hasAppliedCode ? (
                <Banner tone="success" style={{ margin: 0 }}>
                  Referral {referralInfo.appliedCode} applied — wallet credit if eligible
                </Banner>
              ) : null}
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
                        setPromoError(null);
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
                        aria-label="Referral or coupon code"
                        placeholder="Referral / coupon code"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          if (promoError) setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleApplyCode();
                        }}
                        style={styles.couponInput}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={promoBusy || busyKey === 'promo' || !promoInput.trim()}
                      onClick={() => void handleApplyCode()}
                    >
                      Apply
                    </Button>
                  </>
                )}
              </div>
              {promoError ? (
                <Banner tone="danger" style={styles.couponAlert}>
                  {promoError}
                </Banner>
              ) : null}
            </div>

            <div style={styles.bill}>
              <div style={styles.billLine}>
                <span>Item total</span>
                <span style={styles.billAmt}>{cart.subtotalLabel}</span>
              </div>
              {cart.promoDiscount > 0 ? (
                <div style={styles.billLine}>
                  <span>Coupon</span>
                  <span style={styles.billCredit}>−{cart.promoDiscountLabel}</span>
                </div>
              ) : null}
              <div style={styles.billLine}>
                <span>Delivery</span>
                {membershipWaives ? (
                  <span style={styles.billAmt}>
                    <s style={styles.billStruck}>₹{deliveryFee.toFixed(2)}</s>
                    <span style={styles.billCredit}> Free</span>
                  </span>
                ) : (
                  <span style={styles.billAmt}>₹{deliveryFee.toFixed(2)}</span>
                )}
              </div>
              <div style={styles.billLine}>
                <span>Platform fee</span>
                <span style={styles.billAmt}>₹{platformFee.toFixed(2)}</span>
              </div>
              {codFee > 0 ? (
                <div style={styles.billLine}>
                  <span>COD charge</span>
                  <span style={styles.billAmt}>₹{codFee.toFixed(2)}</span>
                </div>
              ) : null}
              {storeCreditBalance > 0 ? (
                <label style={styles.walletRow}>
                  <span style={styles.walletLabel}>
                    <input
                      type="checkbox"
                      checked={useStoreCredit}
                      disabled={busy}
                      style={styles.walletCheck}
                      onChange={(e) => {
                        creditChoice.current = true;
                        setUseStoreCredit(e.target.checked);
                      }}
                    />
                    Wallet
                  </span>
                  <span style={useStoreCredit ? styles.billCredit : styles.billMuted}>
                    {useStoreCredit ? `−₹${creditToApply.toFixed(2)}` : `₹${storeCreditBalance.toFixed(2)}`}
                  </span>
                </label>
              ) : null}
              <div style={styles.billTotal}>
                <span>{online ? 'Pay online' : 'Pay on delivery'}</span>
                <span style={styles.total}>{payLabel}</span>
              </div>
            </div>
            {showMembershipOffer ? (
              <button type="button" style={styles.memberOffer} onClick={() => setPlansOpen(true)}>
                <span style={styles.memberOfferCopy}>
                  Make delivery free · from ₹{Number(starterPlan?.price ?? 0).toFixed(0)}
                </span>
                <strong style={styles.memberOfferCta}>Plans</strong>
              </button>
            ) : memberCredits > 0 ? (
              <button type="button" style={styles.memberOffer} onClick={() => setPlansOpen(true)}>
                <span style={styles.memberOfferCopy}>{memberCredits} free deliveries left</span>
                <strong style={styles.memberOfferCta}>View</strong>
              </button>
            ) : null}
            {showPayMethods ? (
              <div style={styles.payMethods} role="radiogroup" aria-label="Payment method">
                {showCodOption ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!online}
                    style={{ ...styles.payMethod, ...(!online ? styles.payMethodOn : null) }}
                    onClick={() => setPaymentMethod('COD')}
                  >
                    Cash on delivery
                  </button>
                ) : null}
                {showUpiOption ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={online}
                    style={{ ...styles.payMethod, ...(online ? styles.payMethodOn : null) }}
                    onClick={() => setPaymentMethod('ONLINE')}
                  >
                    UPI / Online
                  </button>
                ) : null}
              </div>
            ) : null}
            {hasCartItems ? (
              <button
                type="button"
                className="cart-place-btn"
                style={styles.billPlaceBtn}
                disabled={busy}
                onClick={() => void handleCheckout()}
              >
                {online ? 'Pay now' : 'Place order'}
              </button>
            ) : null}
          </Card>

          {bestDealsEnabled ? (
          <CartSuggestionStrip
            title="Best deals in your town"
            items={bestDeals}
            loading={false}
            busyKey={busyKey}
            flushBottom
            quantityFor={quantityFor}
            onIncrease={(listingId) => void doIncrease(listingId)}
            onDecrease={(listingId) => void doDecrease(listingId)}
            onBrowseMore={openDeals}
          />
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: '0.55rem',
    paddingBottom: 'calc(var(--sticky-cart-h) + 0.35rem)',
  },
  deliverRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
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
    color: 'var(--text)',
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
  memberOffer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    padding: '0.32rem 0.55rem',
    borderRadius: 8,
    border: '1px solid #B7E4C4',
    background: '#F3FBF5',
    color: '#14532D',
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 32,
  },
  memberOfferCopy: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.74rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  memberOfferCta: { color: '#0C831F', fontSize: '0.74rem', flexShrink: 0 },
  bill: {
    display: 'grid',
    gap: 0,
    paddingTop: '0.15rem',
    borderTop: '1px solid var(--border)',
  },
  billLine: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    columnGap: '0.75rem',
    minHeight: 28,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  billAmt: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: 'var(--text)',
    fontSize: '0.82rem',
    textAlign: 'right',
  },
  billStruck: {
    opacity: 0.45,
    fontWeight: 600,
    marginRight: '0.3rem',
  },
  billCredit: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 800,
    color: '#0C831F',
    fontSize: '0.82rem',
  },
  billMuted: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  walletRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    columnGap: '0.5rem',
    minHeight: 32,
    marginTop: '0.1rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text)',
    cursor: 'pointer',
  },
  walletLabel: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem' },
  walletCheck: { width: 16, height: 16, margin: 0, accentColor: '#0C831F', cursor: 'pointer' },
  billTotal: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'baseline',
    columnGap: '0.75rem',
    marginTop: '0.15rem',
    paddingTop: '0.4rem',
    borderTop: '1px dashed var(--border)',
    fontWeight: 800,
    fontSize: '0.92rem',
    color: 'var(--text)',
  },
  payMethods: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.35rem',
    marginTop: '0.35rem',
  },
  payMethod: {
    minHeight: 40,
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  payMethodOn: {
    border: '1.5px solid #0C831F',
    background: '#F3FBF5',
    color: '#0C831F',
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
    zIndex: 55,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0.75rem 0.35rem',
    pointerEvents: 'none',
  },
  stickyInner: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#0C831F',
    color: '#fff',
    borderRadius: 12,
    padding: '0.35rem 0.35rem 0.35rem 0.65rem',
    boxShadow: '0 8px 20px rgba(12, 131, 31, 0.32)',
    minHeight: 48,
  },
  payBlock: { flex: '0 0 auto', minWidth: 0, lineHeight: 1.15 },
  payLabel: { margin: 0, fontSize: '0.6rem', opacity: 0.85, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' },
  payTotal: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.02em' },
  unlockSpacer: { flex: '1 1 auto', minWidth: 0 },
  stickyLink: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: '#F7CE46',
    fontWeight: 800,
    fontSize: '0.62rem',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  placeBtn: {
    border: 'none',
    background: '#F7CE46',
    color: '#0a1a08',
    fontWeight: 800,
    borderRadius: 999,
    padding: '0.38rem 0.7rem',
    minHeight: 32,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '0.78rem',
    flex: '0 0 auto',
  },
  billPlaceBtn: {
    marginTop: '0.5rem',
    width: '100%',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    borderRadius: 10,
    padding: '0.85rem 1rem',
    minHeight: 48,
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
};
