import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

const STICKY_CSS = `
  @media (max-width: 400px) {
    .cart-place-btn {
      padding-left: 0.7rem !important;
      padding-right: 0.7rem !important;
    }
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
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
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
  const [referralInput, setReferralInput] = useState('');
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const couponSectionRef = useRef<HTMLDivElement | null>(null);
  const checkoutErrorRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRequestRef = useRef(0);
  const rememberItemsRef = useRef(rememberItems);
  rememberItemsRef.current = rememberItems;

  const hasCartItems = Boolean(cart?.cartId && cart.items.length > 0);

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

  async function handleApplyReferral() {
    const token = session?.accessToken;
    if (!token || !referralInput.trim()) return;
    setReferralBusy(true);
    setReferralError(null);
    try {
      setReferralInfo(await applyReferralCode(token, referralInput.trim()));
      setReferralInput('');
    } catch (err) {
      setReferralError(err instanceof ApiError || err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setReferralBusy(false);
    }
  }

  useEffect(() => {
    if (!hasCartItems && notice && /^Order placed:/i.test(notice)) {
      setNotice(null);
    }
  }, [hasCartItems, notice, setNotice]);

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
  const showDealsLink = memberCredits > 0 && bestDealsEnabled;
  const showMealPlannerLink = mealPlannerOn && Boolean(townId);
  const showAuxLinks = showDealsLink || showMealPlannerLink;

  useEffect(() => {
    if (!hasCartItems || payOnDelivery <= 0) return;
    if (codEnabled && !upiEnabled) setPaymentMethod('COD');
    else if (!codEnabled && upiEnabled) setPaymentMethod('ONLINE');
  }, [hasCartItems, payOnDelivery, codEnabled, upiEnabled]);
  const payModeLabel = online ? 'Pay now' : 'Cash on delivery';
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
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
    const result = await doCheckout({ useStoreCredit, paymentMethod: online ? 'ONLINE' : 'COD' });
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
              {showAuxLinks ? (
                <div style={styles.auxLinks}>
                  {showDealsLink ? (
                    <button type="button" style={styles.dealsLinkInline} onClick={openDeals}>
                      Best deals in town
                    </button>
                  ) : null}
                  {showDealsLink && showMealPlannerLink ? (
                    <span style={styles.auxDivider} aria-hidden="true">
                      |
                    </span>
                  ) : null}
                  {showMealPlannerLink ? (
                    <button type="button" style={styles.dealsLinkInline} onClick={openMealPlanner}>
                      Meal planner
                    </button>
                  ) : null}
                </div>
              ) : memberCredits > 0 ? (
                <span style={styles.unlockSpacer} />
              ) : deliveryNudge ? (
                <DeliveryUnlockChip
                  addMore={deliveryNudge.addMore}
                  nextFee={deliveryNudge.nextFee}
                  progress={unlockProgress}
                />
              ) : (
                <span style={styles.unlockSpacer} />
              )}
              <button
                type="button"
                className="cart-place-btn"
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
        description={
          online
            ? `Pay ${payLabel} online for delivery to ${selectedAddress?.label || 'your selected address'}?`
            : `Place this cash-on-delivery order for ${payLabel} to ${
                selectedAddress?.label || 'your selected address'
              }?`
        }
        confirmLabel={online ? 'Pay now' : 'Yes, place order'}
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

      {error ? (
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
            {referralInfo?.programEnabled && hasCartItems ? (
              <div style={styles.couponBlock}>
                {referralInfo.hasAppliedCode ? (
                  <Banner tone="success" style={{ margin: 0 }}>
                    Referral {referralInfo.appliedCode} applied — wallet credit if eligible
                  </Banner>
                ) : (
                  <>
                    <div style={styles.couponRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <TextField
                          aria-label="Referral code"
                          placeholder="Friend’s referral code"
                          value={referralInput}
                          onChange={(e) => {
                            setReferralInput(e.target.value);
                            if (referralError) setReferralError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleApplyReferral();
                          }}
                          style={styles.couponInput}
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={referralBusy || !referralInput.trim()}
                        onClick={() => void handleApplyReferral()}
                      >
                        Apply
                      </Button>
                    </div>
                    {referralError ? (
                      <Banner tone="danger" style={styles.couponAlert}>
                        {referralError}
                      </Banner>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
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
              <span>{membershipWaives ? 'Delivery (membership)' : 'Delivery fee'}</span>
              <strong>
                {membershipWaives ? (
                  <span>
                    <s style={{ opacity: 0.55, fontWeight: 600 }}>₹{deliveryFee.toFixed(2)}</s> Free
                  </span>
                ) : (
                  `₹${deliveryFee.toFixed(2)}`
                )}
              </strong>
            </div>
            {showMembershipOffer ? (
              <button type="button" style={styles.memberOffer} onClick={() => setPlansOpen(true)}>
                <span style={styles.memberOfferIcon} aria-hidden>
                  🏷
                </span>
                <span style={styles.memberOfferCopy}>
                  <strong>Make delivery free</strong>
                  <span>
                    From ₹{Number(starterPlan?.price ?? 0).toFixed(0)} · {starterPlan?.credits} drops
                  </span>
                </span>
                <strong style={styles.memberOfferCta}>Plans</strong>
              </button>
            ) : memberCredits > 0 ? (
              <button type="button" style={styles.memberOffer} onClick={() => setPlansOpen(true)}>
                <span style={styles.memberOfferIcon} aria-hidden>
                  ✓
                </span>
                <span style={styles.memberOfferCopy}>
                  <strong>{memberCredits} free deliveries left</strong>
                  <span>Used when this town charges a fee</span>
                </span>
                <strong style={styles.memberOfferCta}>View</strong>
              </button>
            ) : null}
            <div style={styles.summaryRow}>
              <span>Platform fee</span>
              <strong>₹{platformFee.toFixed(2)}</strong>
            </div>
            {codFee > 0 ? (
              <div style={styles.summaryRow}>
                <span>COD charge</span>
                <strong>₹{codFee.toFixed(2)}</strong>
              </div>
            ) : null}
            {creditToApply > 0 ? (
              <div style={styles.summaryRow}>
                <span>Store credit</span>
                <strong style={styles.discount}>−₹{creditToApply.toFixed(2)}</strong>
              </div>
            ) : null}
            <div style={styles.payRow}>
              <span>{online ? 'Pay online' : 'Pay on delivery'}</span>
              <strong style={styles.total}>{payLabel}</strong>
            </div>
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
  page: { display: 'grid', gap: '0.55rem', paddingBottom: 0 },
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
  memberOffer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    margin: '0.05rem 0 0.1rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 12,
    border: '1px solid #B7E4C4',
    background: '#E7F6EC',
    color: '#1A1C1A',
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 48,
  },
  memberOfferIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#0C831F',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  memberOfferCopy: { flex: 1, minWidth: 0, display: 'grid', gap: '0.04rem', fontSize: '0.72rem', color: '#6B7280' },
  memberOfferCta: { color: '#0C831F', fontSize: '0.78rem', flexShrink: 0 },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  discount: { color: 'var(--accent)' },
  payRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: '0.1rem',
    fontWeight: 700,
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
    gap: '0.45rem',
    background: '#1C1C1C',
    color: '#fff',
    borderRadius: 12,
    padding: '0.45rem 0.45rem 0.45rem 0.8rem',
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
  },
  payBlock: { flex: '0 0 auto', minWidth: '4.4rem' },
  payLabel: { margin: 0, fontSize: '0.68rem', opacity: 0.75, fontWeight: 700 },
  payTotal: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' },
  unlockSpacer: { flex: '1 1 auto', minWidth: 0 },
  auxLinks: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.15rem',
    color: '#B7E4C4',
    fontSize: '0.78rem',
    fontWeight: 800,
    lineHeight: 1.25,
    minHeight: 36,
  },
  auxDivider: {
    flexShrink: 0,
    padding: '0 0.5rem',
    opacity: 0.75,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  dealsLinkInline: {
    margin: 0,
    padding: '0 0.15rem',
    border: 'none',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  placeBtn: {
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    borderRadius: 10,
    padding: '0.8rem 1.05rem',
    minHeight: 44,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
};
