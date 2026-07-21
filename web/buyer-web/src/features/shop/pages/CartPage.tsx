import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdSlot } from '@/features/ads/components/AdSlot';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button, Card, EmptyState, TextField } from '@/shared/ui';
import { AddressForm } from '../components/AddressForm';
import { QuantityStepper } from '../components/QuantityStepper';
import { productVisual } from '../lib/productVisual';
import { useShop } from '../hooks/useShop';

export function CartPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    cart,
    addresses,
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
    doCheckout,
  } = useShop();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressHint, setAddressHint] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const addressSectionRef = useRef<HTMLElement | null>(null);
  const couponSectionRef = useRef<HTMLDivElement | null>(null);

  const hasCartItems = Boolean(cart?.cartId && cart.items.length > 0);
  const needsAddress = hasCartItems && !selectedAddressId;

  useEffect(() => {
    if (selectedAddressId) setAddressHint(null);
  }, [selectedAddressId]);

  function promptForAddress(message: string) {
    setAddressHint(message);
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

    if (needsAddress) {
      promptForAddress(
        addresses.length === 0
          ? 'Add a delivery address before placing your order.'
          : 'Select a delivery address before placing your order.',
      );
      return;
    }

    setAddressHint(null);
    await doCheckout();
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
        hasCartItems ? (
          <div style={styles.stickyCheckout}>
            <div style={styles.stickyInner}>
              <div>
                <p style={styles.payLabel}>Cash on delivery</p>
                <p style={styles.payTotal}>{cart?.payableLabel}</p>
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
      ) : (
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
            <div style={{ ...styles.summaryRow, marginTop: '0.35rem' }}>
              <span>Grand total</span>
              <strong style={styles.total}>{cart.payableLabel}</strong>
            </div>
            {storeCreditBalance > 0 ? (
              <Banner tone="success" style={{ marginTop: '0.75rem' }}>
                Store credit ₹{storeCreditBalance.toFixed(2)} will apply automatically at checkout.{' '}
                <Link to="/wallet" style={{ color: 'inherit', fontWeight: 800 }}>
                  View wallet →
                </Link>
              </Banner>
            ) : null}
            <Banner tone={cart.minOrderMet ? 'success' : 'warning'} style={{ marginTop: '0.75rem' }}>
              {cart.minOrderMet
                ? `Minimum order ${cart.minOrderLabel} — met`
                : `Minimum order ${cart.minOrderLabel} — add more items to checkout`}
            </Banner>
          </Card>
        </div>
      )}

      <section ref={addressSectionRef} style={styles.section} id="delivery-address">
        <h2 style={styles.h2}>Delivery address</h2>

        {needsAddress || addressHint ? (
          <Banner tone="warning" style={styles.addressAlert}>
            {addressHint ??
              (addresses.length === 0
                ? 'No delivery address yet. Add one below to place your COD order.'
                : 'Select a delivery address below to place your COD order.')}
          </Banner>
        ) : null}

        {addresses.length > 0 ? (
          <div style={styles.list}>
            {addresses.map((a) => (
              <label key={a.id} style={selectedAddressId === a.id ? styles.addrActive : styles.addr}>
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === a.id}
                  onChange={() => setSelectedAddressId(a.id)}
                />
                <span>
                  <strong>{a.label || 'Address'}</strong>
                  <br />
                  {a.recipientName} · {a.recipientPhone}
                  <br />
                  {a.line1}
                  {a.pincode ? `, ${a.pincode}` : ''}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {showAddressForm ? (
          <AddressForm
            phone={session?.phone ?? ''}
            busy={busy}
            onCancel={() => setShowAddressForm(false)}
            onSubmit={(values) => {
              void doCreateAddress(values).then((ok) => {
                if (ok) {
                  setShowAddressForm(false);
                  setAddressHint(null);
                }
              });
            }}
          />
        ) : (
          <Button
            variant={needsAddress ? 'primary' : 'ghost'}
            disabled={busy}
            onClick={() => setShowAddressForm(true)}
          >
            {addresses.length === 0 ? 'Add delivery address' : 'Add another address'}
          </Button>
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
  total: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    color: 'var(--text)',
  },
  section: { display: 'grid', gap: '0.75rem', paddingBottom: '5rem' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  addressAlert: { animation: 'hlm-fade-up 220ms ease both' },
  addr: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'flex-start',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    cursor: 'pointer',
  },
  addrActive: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'flex-start',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    cursor: 'pointer',
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
