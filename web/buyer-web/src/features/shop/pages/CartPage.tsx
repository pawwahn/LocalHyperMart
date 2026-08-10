import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { apiRequest } from '@/shared/api/http';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { Banner, Button, Card, EmptyState, TextField } from '@/shared/ui';
import { AddressForm } from '../components/AddressForm';
import { QuantityStepper } from '../components/QuantityStepper';
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
    doSetLineQuantity,
    doApplyPromo,
    doRemovePromo,
    doCreateAddress,
    doUpdateAddress,
    doCheckout,
  } = useShop();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressHint, setAddressHint] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);
  const addressSectionRef = useRef<HTMLElement | null>(null);
  const couponSectionRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadFee() {
      try {
        if (townId) {
          const params = new URLSearchParams();
          if (itemsPayable > 0) params.set('orderValue', String(itemsPayable));
          const q = params.toString();
          const data = await apiRequest<{ deliveryFee?: number }>(
            `/api/v1/towns/${townId}/delivery-fee${q ? `?${q}` : ''}`,
            { token: session?.accessToken },
          );
          if (!cancelled) {
            setDeliveryFee(Math.max(0, Number(data?.deliveryFee) || DEFAULT_DELIVERY_FEE));
          }
          return;
        }
        const s = await getPublicPlatformSettings();
        if (!cancelled) {
          setDeliveryFee(Math.max(0, Number(s.deliveryFee) || DEFAULT_DELIVERY_FEE));
        }
      } catch {
        if (!cancelled) setDeliveryFee(DEFAULT_DELIVERY_FEE);
      }
    }
    void loadFee();
    return () => {
      cancelled = true;
    };
  }, [townId, itemsPayable, session?.accessToken]);

  useEffect(() => {
    if (selectedAddressId) setAddressHint(null);
  }, [selectedAddressId]);

  function promptForAddress(message: string) {
    setAddressHint(message);
    setEditingAddressId(null);
    setShowAddressForm(true);
    addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
      promptForAddress('Choose your town first — delivery address must match the selected town.');
      openTownPicker();
      return;
    }

    if (needsAddress) {
      promptForAddress(
        addresses.length === 0
          ? `Add a delivery address in ${townLabel} before placing your order.`
          : `Select a delivery address in ${townLabel} before placing your order.`,
      );
      return;
    }

    setAddressHint(null);
    await doCheckout({ useStoreCredit });
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <PortalShell
      title="Checkout"
      subtitle="Review items and place your COD order"
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
      showDeliveryBanner={false}
      showStickyCart={false}
      footerSlot={
        hasCartItems && !showAddressForm ? (
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
      ) : showAddressForm ? null : (
        <div style={styles.stack}>
          <Card elevated padding="md" style={styles.deliverCard}>
            <div>
              <p style={styles.deliverLabel}>Delivering to</p>
              <p style={styles.deliverValue}>
                {selectedAddress
                  ? `${selectedAddress.label || 'Home'} · ${selectedAddress.line1}`
                  : 'Add a delivery address'}
              </p>
            </div>
            <button
              type="button"
              style={styles.changeBtn}
              onClick={() =>
                addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Change
            </button>
          </Card>

          <div style={styles.list}>
            {cart.items.map((item) => {
              const visual = productVisual(item.name);
              return (
                <Card key={item.itemId} style={styles.row}>
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

          <AdSlot slot="cart_upsell" variant="strip" />

          <Card elevated padding="lg" style={styles.summary}>
            <div ref={couponSectionRef} style={styles.couponBlock}>
              <div style={styles.couponRow}>
                {cart.promoCode ? (
                  <>
                    <Banner tone="success" style={{ flex: 1 }}>
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
            {creditToApply > 0 ? (
              <div style={styles.summaryRow}>
                <span>Store credit</span>
                <strong style={styles.discount}>−₹{creditToApply.toFixed(2)}</strong>
              </div>
            ) : null}
            <div style={{ ...styles.summaryRow, marginTop: '0.35rem' }}>
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
            <Banner tone={cart.minOrderMet ? 'success' : 'warning'} style={{ marginTop: '0.75rem' }}>
              {cart.minOrderMet
                ? `Minimum order ${cart.minOrderLabel} — met`
                : `Minimum order ${cart.minOrderLabel} — add more items to checkout`}
            </Banner>
          </Card>
        </div>
      )}

      <section
        ref={addressSectionRef}
        style={showAddressForm ? styles.sectionEditing : styles.section}
        id="delivery-address"
      >
        {showAddressForm ? null : <h2 style={styles.h2}>Delivery address</h2>}

        {showAddressForm ? (
          <AddressForm
            key={editingAddressId ?? 'new'}
            townLabel={townLabel}
            phone={session?.phone ?? ''}
            busy={busy}
            mode={editingAddressId ? 'edit' : 'create'}
            error={error}
            onChangeTown={openTownPicker}
            initial={
              editingAddressId
                ? (() => {
                    const a = addresses.find((x) => x.id === editingAddressId);
                    if (!a) return undefined;
                    return {
                      label: a.label ?? 'Home',
                      recipientName: a.recipientName,
                      recipientPhone: a.recipientPhone,
                      line1: a.line1,
                      line2: a.line2 ?? '',
                      landmark: a.landmark ?? '',
                      pincode: a.pincode ?? '',
                    };
                  })()
                : undefined
            }
            onCancel={() => {
              setShowAddressForm(false);
              setEditingAddressId(null);
            }}
            onSubmit={async (values) => {
              if (!hasTown) {
                openTownPicker();
                return;
              }
              const ok = editingAddressId
                ? await doUpdateAddress(editingAddressId, values)
                : await doCreateAddress(values);
              if (ok) {
                setShowAddressForm(false);
                setEditingAddressId(null);
                setAddressHint(null);
              }
            }}
          />
        ) : (
          <>
            <p style={styles.townScope}>
              Showing addresses for <strong>{hasTown ? townLabel : 'your selected town'}</strong>
              {hasTown ? (
                <>
                  {' · '}
                  <button type="button" style={styles.townLink} onClick={openTownPicker}>
                    Change town
                  </button>
                </>
              ) : null}
            </p>

            {needsAddress || addressHint ? (
              <Banner tone="warning" style={styles.addressAlert}>
                {addressHint ??
                  (addresses.length === 0
                    ? hasTown
                      ? `No address in ${townLabel} yet. Add one below — it must match this town.`
                      : 'Choose your town first, then add a delivery address.'
                    : `Select a delivery address in ${townLabel} to place your COD order.`)}
              </Banner>
            ) : null}

            {addresses.length > 0 ? (
              <div style={styles.list}>
                {addresses.map((a) => (
                  <div key={a.id} style={selectedAddressId === a.id ? styles.addrActive : styles.addr}>
                    <label style={styles.addrSelect}>
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === a.id}
                        onChange={() => setSelectedAddressId(a.id)}
                      />
                      <span style={styles.addrText}>
                        <strong>{a.label || 'Address'}</strong>
                        <br />
                        {a.recipientName} · {a.recipientPhone}
                        <br />
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ''}
                        {a.pincode ? `, ${a.pincode}` : ''}
                      </span>
                    </label>
                    <button
                      type="button"
                      style={styles.editAddrBtn}
                      disabled={busy}
                      onClick={() => {
                        setEditingAddressId(a.id);
                        setShowAddressForm(true);
                        setAddressHint(null);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              variant={needsAddress ? 'primary' : 'ghost'}
              disabled={busy}
              fullWidth
              onClick={() => {
                if (!hasTown) {
                  openTownPicker();
                  setAddressHint('Choose your town first — delivery address must match the selected town.');
                  return;
                }
                setEditingAddressId(null);
                setShowAddressForm(true);
              }}
            >
              {addresses.length === 0 ? 'Add delivery address' : 'Add another address'}
            </Button>
          </>
        )}
      </section>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: { display: 'grid', gap: '0.85rem', paddingBottom: '4.5rem' },
  deliverCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
  },
  deliverLabel: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 },
  deliverValue: { margin: '0.15rem 0 0', fontWeight: 700, fontSize: '0.9rem' },
  changeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  list: { display: 'grid', gap: '0.65rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.35rem',
    flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { margin: 0, fontWeight: 700, fontSize: '0.92rem' },
  meta: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' },
  summary: { display: 'grid', gap: '0.55rem' },
  couponBlock: { display: 'grid', gap: '0.55rem' },
  couponRow: { display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' },
  couponInput: { flex: 1, minWidth: 160 },
  couponAlert: { animation: 'hlm-fade-up 220ms ease both' },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  discount: { color: 'var(--accent)' },
  creditToggle: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
    marginTop: '0.65rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
    background: 'var(--accent-soft)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.35,
    cursor: 'pointer',
  },
  total: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    color: 'var(--text)',
  },
  section: {
    display: 'grid',
    gap: '0.75rem',
    paddingBottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
    minWidth: 0,
  },
  sectionEditing: {
    display: 'grid',
    gap: '0.4rem',
    paddingBottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 1.25rem)',
    minWidth: 0,
  },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  addressAlert: { animation: 'hlm-fade-up 220ms ease both' },
  townScope: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  townLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent, #ea580c)',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
  },
  addr: {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 0.85rem',
    minWidth: 0,
  },
  addrActive: {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 0.85rem',
    minWidth: 0,
  },
  addrSelect: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  addrText: {
    minWidth: 0,
    flex: 1,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    fontSize: '0.88rem',
    lineHeight: 1.35,
  },
  editAddrBtn: {
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.82rem',
    padding: '0.45rem 0.7rem',
    minHeight: 'var(--touch-min)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  stickyCheckout: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    zIndex: 40,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0.85rem 0.55rem',
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
    padding: '0.55rem 0.55rem 0.55rem 1rem',
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
    padding: '0.85rem 1.15rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
