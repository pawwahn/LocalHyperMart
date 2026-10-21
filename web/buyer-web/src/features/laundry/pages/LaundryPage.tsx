import { Component, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { ApiError } from '@/shared/api/http';
import { QuantityStepper } from '@/features/shop/components/QuantityStepper';
import { CheckoutDismissedError, checkoutCanOpen, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { PaymentGatewayChoices, usePaymentGateways } from '@/features/shop/components/PaymentGatewayChoices';
import { confirmOnlinePayment, fetchPaymentCheckout } from '@/features/shop/api/shopApi';
import { pollUntilCheckoutReady } from '@/features/shop/lib/paymentCheckoutPoll';
import { listAddresses, type AddressDto } from '@/features/shop/api/shopApi';
import {
  LAUNDRY_ITEMS,
  LAUNDRY_SERVICES,
  LOGISTICS,
  fetchLaundryShops,
  laundryLabel,
  placeLaundryOrder,
  uploadLaundryPhoto,
  type LaundryShop,
} from '../api/laundryApi';

type Piece = { quantity: number; otherLabel: string; photoMediaId?: string };

const PICKUP_SLOTS = [
  { id: '08', label: '8–10 AM', start: '08:00', end: '10:00' },
  { id: '10', label: '10–12', start: '10:00', end: '12:00' },
  { id: '12', label: '12–2 PM', start: '12:00', end: '14:00' },
  { id: '14', label: '2–4 PM', start: '14:00', end: '16:00' },
  { id: '16', label: '4–6 PM', start: '16:00', end: '18:00' },
] as const;

function slotInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

function istDate(when: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

function slotBookable(date: string, end: string, now: Date): boolean {
  if (!date || date < istDate(now)) return false;
  return new Date(`${date}T${end}:00+05:30`).getTime() > now.getTime();
}

function nextIstDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return istDate(new Date(Date.UTC(year, month - 1, day + 1, 6, 0, 0)));
}

const SERVICE_LOOK: Record<string, { emoji: string; tint: string }> = {
  WASH_AND_IRON: { emoji: '✨', tint: '#E8F7EE' },
  WASH_ONLY: { emoji: '💧', tint: '#E7F1FF' },
  IRON_ONLY: { emoji: '👔', tint: '#FFF4E5' },
};

const TRIP_LOOK: Record<string, string> = {
  PICKUP_AND_DROP: '🚚',
  PICKUP_ONLY: '🏠',
  DROP_ONLY: '🏪',
};

function tripCharge(shop: LaundryShop | null, logistics: string): number {
  if (!shop) return 0;
  const raw = logistics === 'PICKUP_ONLY'
    ? shop.pickupCharge
    : logistics === 'DROP_ONLY'
      ? shop.dropCharge
      : logistics === 'PICKUP_AND_DROP'
        ? shop.pickupAndDropCharge
        : 0;
  const amount = Number(raw || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function platformFee(townFee: number, pieces: number): number {
  if (pieces < 1) return 0;
  const amount = Number(townFee || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function money(value: number): string {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function addressName(item: AddressDto, all: AddressDto[]): string {
  const label = item.label?.trim() || 'Address';
  const shared = all.filter((row) => (row.label?.trim() || 'Address') === label).length > 1;
  const street = item.line1?.trim();
  return shared && street ? `${label} · ${street}` : (item.label?.trim() || street || 'Address');
}

function pieceKey(serviceType: string, itemType: string): string {
  return `${serviceType}|${itemType}`;
}

class LaundryScreenError extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>{this.state.error.message}</p>;
    }
    return this.props.children;
  }
}

export function LaundryPage() {
  return (
    <LaundryScreenError>
      <LaundryBooking />
    </LaundryScreenError>
  );
}

function LaundryBooking() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { townId, townLabel, hasTown, laundryEnabled, laundryReady, platformFee: townPlatformFee, codEnabled, upiEnabled, codCharge } = useTown();
  const token = session?.accessToken ?? '';
  const [shops, setShops] = useState<LaundryShop[]>([]);
  const [shopId, setShopId] = useState('');
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [addressId, setAddressId] = useState('');
  const [serviceType, setServiceType] = useState('WASH_AND_IRON');
  const [logistics, setLogistics] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const { options: paymentGateways, gateway: paymentGateway, setGateway: setPaymentGateway } = usePaymentGateways(token);
  const [pickupDate, setPickupDate] = useState(() => istDate(new Date()));
  const [pickupSlot, setPickupSlot] = useState('10');
  const [now, setNow] = useState(() => new Date());
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [pieces, setPieces] = useState<Record<string, Piece>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shop = shops.find((item) => item.vendorId === shopId) ?? null;

  useEffect(() => {
    setError(null);
    setNotice(null);
    if (!token || !townId || !laundryReady) return;
    if (!laundryEnabled) {
      setShops([]);
      return;
    }
    let cancelled = false;
    void Promise.all([fetchLaundryShops(token, townId), listAddresses(token)])
      .then(([shopRows, addressRows]) => {
        if (cancelled) return;
        setError(null);
        const nextShops = Array.isArray(shopRows) ? shopRows : [];
        const nextAddresses = Array.isArray(addressRows) ? addressRows : [];
        setShops(nextShops);
        const townAddresses = nextAddresses.filter((row) => row.townId === townId);
        setAddresses(townAddresses);
        setAddressId((prev) => (townAddresses.some((row) => row.id === prev) ? prev : townAddresses[0]?.id || ''));
        setShopId((prev) => (nextShops.some((row) => row.vendorId === prev) ? prev : nextShops[0]?.vendorId || ''));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load laundry');
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, laundryEnabled, laundryReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (logistics !== 'PICKUP_AND_DROP' && logistics !== 'PICKUP_ONLY') return;
    if (!pickupDate) return;
    const open = PICKUP_SLOTS.filter((item) => slotBookable(pickupDate, item.end, now));
    if (open.length === 0 && pickupDate <= istDate(now)) {
      setPickupDate(nextIstDate(pickupDate));
      return;
    }
    if (open.some((item) => item.id === pickupSlot)) return;
    setPickupSlot(open[0]?.id ?? '');
  }, [logistics, pickupDate, pickupSlot, now]);

  function rateFor(service: string, item: string): number {
    const rate = (shop?.rates ?? []).find((row) => row.serviceType === service && row.itemType === item && !row.paused);
    return rate && rate.unitPrice > 0 ? Number(rate.unitPrice) : 0;
  }

  function qtyFor(service: string, item: string): number {
    return pieces[pieceKey(service, item)]?.quantity ?? 0;
  }

  function bump(item: string, delta: number) {
    const key = pieceKey(serviceType, item);
    setPieces((prev) => {
      const current = prev[key]?.quantity ?? 0;
      const quantity = Math.max(0, Math.min(99, current + delta));
      return { ...prev, [key]: { quantity, otherLabel: prev[key]?.otherLabel ?? '', photoMediaId: prev[key]?.photoMediaId } };
    });
  }

  const offered = LAUNDRY_ITEMS.filter((item) => rateFor(serviceType, item.id) > 0);

  const basket = useMemo(() => {
    return Object.entries(pieces)
      .map(([key, piece]) => {
        const [service, item] = key.split('|');
        const unit = rateFor(service, item);
        return { key, service, item, ...piece, unit, amount: unit * piece.quantity };
      })
      .filter((row) => row.quantity > 0 && row.unit > 0);
  }, [pieces, shop]);

  const pieceTotal = basket.reduce((sum, row) => sum + row.amount, 0);
  const pieceCount = basket.reduce((sum, row) => sum + row.quantity, 0);
  const tripChosen = logistics === 'PICKUP_AND_DROP' || logistics === 'PICKUP_ONLY' || logistics === 'DROP_ONLY';
  const travel = tripChosen ? tripCharge(shop, logistics) : 0;
  const fee = platformFee(townPlatformFee, pieceCount);
  const cashOn = paymentMethod === 'CASH' && codEnabled;
  const codFee = pieceCount > 0 && cashOn ? Math.max(0, Number(codCharge) || 0) : 0;
  const dockTotal = pieceTotal + travel;
  const total = pieceTotal + travel + fee + (tripChosen ? codFee : 0);
  const payAllowed = (paymentMethod === 'CASH' && codEnabled) || (paymentMethod === 'UPI' && upiEnabled);
  const otherMissing = basket.some((row) => row.item === 'OTHER' && !row.otherLabel.trim());
  const needsPickup = logistics === 'PICKUP_AND_DROP' || logistics === 'PICKUP_ONLY';
  const slot = PICKUP_SLOTS.find((item) => item.id === pickupSlot) ?? null;
  const slotOk = !needsPickup || Boolean(pickupDate && slot && slotBookable(pickupDate, slot.end, now));
  const canPlace = Boolean(shop && addressId && pieceTotal > 0 && tripChosen && !otherMissing && slotOk && payAllowed);

  useEffect(() => {
    if (pieceCount === 0 && logistics) setLogistics('');
  }, [pieceCount, logistics]);

  useEffect(() => {
    if (codEnabled && !upiEnabled) setPaymentMethod('CASH');
    else if (!codEnabled && upiEnabled) setPaymentMethod('UPI');
  }, [codEnabled, upiEnabled]);

  async function submit() {
    if (!token || !shop || !townId || !canPlace || (needsPickup && !slot)) return;
    setBusy(true);
    setError(null);
    try {
      const placed = await placeLaundryOrder(token, {
        townId,
        vendorId: shop.vendorId,
        addressId,
        logistics,
        paymentMethod,
        paymentGateway: paymentMethod === 'UPI' ? paymentGateway : undefined,
        specialInstructions: note.trim() || undefined,
        slaAcknowledged: true,
        requestedPickupStart: needsPickup && slot ? slotInstant(pickupDate, slot.start) : undefined,
        requestedPickupEnd: needsPickup && slot ? slotInstant(pickupDate, slot.end) : undefined,
        lines: basket.map((row) => ({
          serviceType: row.service,
          itemType: row.item,
          quantity: row.quantity,
          otherLabel: row.item === 'OTHER' ? row.otherLabel.trim() : undefined,
          photoMediaId: row.photoMediaId,
        })),
      });
      setPieces({});
      setNote('');
      setNoteOpen(false);
      setConfirming(false);
      let payError: string | null = null;
      if (paymentMethod === 'UPI') {
        let checkout = placed.payment?.checkout ?? null;
        const paymentId = placed.payment?.paymentId;
        if (!checkout?.gatewayOrderId && paymentId) {
          checkout = await pollUntilCheckoutReady(() => fetchPaymentCheckout(token, paymentId));
        }
        if (!checkoutCanOpen(checkout)) {
          payError = 'Online payment is not configured yet. Use cash, or tap Pay now on the order.';
        } else {
          try {
            const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
            await confirmOnlinePayment(token, paid);
          } catch (err) {
            if (!(err instanceof CheckoutDismissedError)) {
              payError = err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed';
            }
          }
        }
      }
      navigate(`/laundry/orders/${placed.id}`, payError ? { state: { payError } } : undefined);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not place request');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!confirming) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) setConfirming(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener('keydown', onKey);
    };
  }, [confirming, busy]);

  const otherPiece = pieces[pieceKey(serviceType, 'OTHER')];

  return (
    <PortalShell
      title="Laundry"
      subtitle={hasTown ? townLabel : 'Choose a town'}
      showDeliveryBanner={false}
      showStickyCart={false}
      footerSlot={pieceCount > 0 ? (
        <div style={styles.dock}>
          <div style={styles.dockRow}>
            <div>
              <strong style={styles.dockTotal}>{money(dockTotal)}</strong>
              <span style={styles.dockMeta}>
                {pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}
                {tripChosen ? '' : ' · pick pickup or drop'}
              </span>
            </div>
            <button
              type="button"
              style={styles.dockBtn}
              disabled={!canPlace || busy}
              onClick={() => { setError(null); setConfirming(true); }}
            >
              Place Order
            </button>
          </div>
        </div>
      ) : null}
    >
      {!laundryReady ? <p style={styles.muted}>Loading laundry…</p> : null}
      {laundryReady && !laundryEnabled ? <p style={styles.muted}>Laundry is not available in this town.</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}
      {laundryReady && laundryEnabled ? (
        <div className="laundry-page">
          <style>{LAUNDRY_LAYOUT}</style>
          <div className="laundry-top">
          <div className="laundry-shops" style={styles.scroller} aria-label="Shops">
            {shops.map((item) => {
              const priced = (item.rates ?? []).filter((rate) => rate.unitPrice > 0 && !rate.paused).map((rate) => Number(rate.unitPrice));
              const from = priced.length ? Math.min(...priced) : 0;
              const on = item.vendorId === shopId;
              return (
                <button key={item.vendorId} type="button" style={on ? styles.shopOn : styles.shop} onClick={() => setShopId(item.vendorId)}>
                  <strong>{item.businessName}</strong>
                  <span style={styles.shopMeta}>{from ? `From ${money(from)}` : 'Rates soon'}</span>
                </button>
              );
            })}
          </div>

          <div className="laundry-services">
            {LAUNDRY_SERVICES.map((service) => {
              const look = SERVICE_LOOK[service.id] ?? { emoji: '🧺', tint: '#fff' };
              const on = serviceType === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  className="laundry-hit"
                  style={{ ...(on ? styles.serviceOn : styles.service), background: on ? look.tint : '#fff' }}
                  onClick={() => setServiceType(service.id)}
                >
                  <span style={styles.serviceEmoji} aria-hidden>{look.emoji}</span>
                  {service.label.replace(' only', '')}
                </button>
              );
            })}
          </div>
          </div>

          <div className="laundry-catalog">
          {offered.length === 0 ? (
            <p style={styles.muted}>This shop has not priced {laundryLabel('service', serviceType).toLowerCase()} yet.</p>
          ) : (
            <div className="laundry-grid">
              {offered.map((item) => {
                const qty = qtyFor(serviceType, item.id);
                const rate = rateFor(serviceType, item.id);
                return (
                  <article
                    key={item.id}
                    className="laundry-hit"
                    style={qty > 0 ? styles.tileOn : styles.tile}
                    onClick={() => bump(item.id, 1)}
                  >
                    <div style={{ ...styles.swatch, background: item.tint, boxShadow: qty > 0 ? 'inset 0 0 0 2px var(--accent, #166534)' : styles.swatch.boxShadow }}>
                      {qty > 0 ? <span style={styles.badge}>{qty}</span> : null}
                      {typeof item.image === 'string' && item.image ? <img src={item.image} alt="" style={styles.itemPhoto} /> : <span style={styles.emoji} aria-hidden>🧺</span>}
                      <div style={styles.stepper} onClick={(event) => event.stopPropagation()}>
                        <QuantityStepper
                          quantity={qty}
                          size="xs"
                          addMode="icon"
                          chrome="circle"
                          onIncrease={() => bump(item.id, 1)}
                          onDecrease={() => bump(item.id, -1)}
                        />
                      </div>
                    </div>
                    <strong style={styles.tileName}>{item.label}</strong>
                    <span style={styles.tilePrice}>{money(rate)}</span>
                    {qty > 0 ? (
                      <label style={pieces[pieceKey(serviceType, item.id)]?.photoMediaId ? styles.photoOn : styles.photo}>
                        {pieces[pieceKey(serviceType, item.id)]?.photoMediaId ? 'Photo added' : 'Add photo'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            const key = pieceKey(serviceType, item.id);
                            if (!file || !token) return;
                            void uploadLaundryPhoto(token, file)
                              .then((mediaId) => setPieces((prev) => ({
                                ...prev,
                                [key]: { quantity: prev[key]?.quantity ?? qty, otherLabel: prev[key]?.otherLabel ?? '', photoMediaId: mediaId },
                              })))
                              .catch((err) => setError(err instanceof Error ? err.message : 'Photo upload failed'));
                          }}
                        />
                      </label>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {otherPiece && otherPiece.quantity > 0 ? (
            <input
              style={styles.other}
              placeholder="What is the other item?"
              value={otherPiece.otherLabel}
              onChange={(e) => {
                const key = pieceKey(serviceType, 'OTHER');
                const value = e.target.value;
                setPieces((prev) => ({ ...prev, [key]: { ...prev[key], otherLabel: value } }));
              }}
            />
          ) : null}

          {basket.length > 0 ? (
            <div style={styles.basket} aria-label="Pieces in this request">
              {basket.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  style={styles.basketChip}
                  onClick={() => setServiceType(row.service)}
                >
                  {row.quantity} {laundryLabel('item', row.item)} · {laundryLabel('service', row.service).replace(' only', '')}
                </button>
              ))}
            </div>
          ) : null}
          </div>

          <div className="laundry-book">
          <div style={styles.addressRow}>
            {addresses.map((item) => (
              <button key={item.id} type="button" style={addressId === item.id ? styles.addressOn : styles.address} onClick={() => setAddressId(item.id)}>
                {addressName(item, addresses)}
              </button>
            ))}
            <Link to="/addresses" style={styles.addressAdd}>{addresses.length ? 'Edit' : 'Add address'}</Link>
          </div>

          <button type="button" style={styles.noteToggle} onClick={() => setNoteOpen((open) => !open)}>
            {noteOpen || note ? 'Care note' : 'Add a care note'}
          </button>
          {noteOpen || note ? (
            <input style={styles.note} placeholder="Starch, no bleach, separate colors" value={note} onChange={(e) => setNote(e.target.value)} />
          ) : null}

          {pieceCount > 0 ? (
            <>
              <p style={styles.tripLabel}>Pickup or drop</p>
              <div style={styles.tripRow}>
                {LOGISTICS.map((item) => {
                  const charge = tripCharge(shop, item.id);
                  return (
                    <button key={item.id} type="button" className="laundry-hit" style={logistics === item.id ? styles.tripOn : styles.trip} onClick={() => setLogistics(item.id)}>
                      <span aria-hidden>{TRIP_LOOK[item.id]}</span>
                      {item.label.replace(' and ', ' & ')}
                      {charge > 0 ? <span>{money(charge)}</span> : null}
                    </button>
                  );
                })}
              </div>
              {needsPickup ? (
                <div style={styles.slotBlock}>
                  <label style={styles.slotDate}>
                    Pickup date
                    <input
                      style={styles.dateInput}
                      type="date"
                      value={pickupDate}
                      min={istDate(now)}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && next < istDate(new Date())) return;
                        setNow(new Date());
                        setPickupDate(next);
                      }}
                    />
                  </label>
                  <div style={styles.slotRow}>
                    {PICKUP_SLOTS.map((item) => {
                      const open = !pickupDate || slotBookable(pickupDate, item.end, now);
                      const selected = open && pickupSlot === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="laundry-hit"
                          disabled={!open}
                          aria-disabled={!open}
                          title={open ? undefined : 'This time has passed'}
                          style={open ? (selected ? styles.slotOn : styles.slot) : styles.slotOff}
                          onClick={() => {
                            if (open) setPickupSlot(item.id);
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  {pickupDate && pickupDate <= istDate(now) && !PICKUP_SLOTS.some((item) => slotBookable(pickupDate, item.end, now)) ? (
                    <p style={styles.slotHint}>No slots left today. Pick a later date.</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          </div>

        </div>
      ) : null}
      {confirming ? createPortal(
        <div
          style={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirming(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="laundry-order-title" style={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
            <style>{'.laundry-bill::-webkit-scrollbar{display:none}'}</style>
            <h2 id="laundry-order-title" style={styles.dialogTitle}>Place order</h2>
            <p style={styles.dialogNote}>
              1–3 days. Pay {money(total)} {paymentMethod === 'UPI' ? 'online.' : 'to the shop.'}
            </p>
            <ul className="laundry-bill" style={styles.bill}>
              {basket.map((row) => (
                <li key={row.key} style={styles.billRow}>
                  <span>{row.quantity} × {row.item === 'OTHER' && row.otherLabel.trim() ? row.otherLabel.trim() : laundryLabel('item', row.item)} · {laundryLabel('service', row.service)}</span>
                  <strong>{money(row.amount)}</strong>
                </li>
              ))}
              {travel > 0 ? (
                <li style={styles.billRow}>
                  <span>{laundryLabel('logistics', logistics)}</span>
                  <strong>{money(travel)}</strong>
                </li>
              ) : null}
              {needsPickup && pickupDate && slot ? (
                <li style={styles.billRow}>
                  <span>Pickup {pickupDate} · {slot.label}</span>
                </li>
              ) : null}
              {fee > 0 ? (
                <li style={styles.billRow}>
                  <span>Platform fee</span>
                  <strong>{money(fee)}</strong>
                </li>
              ) : null}
              {codFee > 0 ? (
                <li style={styles.billRow}>
                  <span>COD charge</span>
                  <strong>{money(codFee)}</strong>
                </li>
              ) : null}
            </ul>
            {codEnabled || upiEnabled ? (
              <>
                <div style={styles.payRow} role="radiogroup" aria-label="Payment">
                  {codEnabled ? (
                    <button type="button" role="radio" aria-checked={paymentMethod === 'CASH'} style={paymentMethod === 'CASH' ? styles.payOn : styles.pay} onClick={() => setPaymentMethod('CASH')}>
                      Cash
                    </button>
                  ) : null}
                  {upiEnabled ? (
                    <button type="button" role="radio" aria-checked={paymentMethod === 'UPI'} style={paymentMethod === 'UPI' ? styles.payOn : styles.pay} onClick={() => setPaymentMethod('UPI')}>
                      UPI
                    </button>
                  ) : null}
                </div>
                {paymentMethod === 'UPI' ? (
                  <PaymentGatewayChoices value={paymentGateway} options={paymentGateways} onChange={setPaymentGateway} />
                ) : null}
              </>
            ) : (
              <p style={styles.error}>Cash and UPI are not available in this town.</p>
            )}
            <div style={styles.billTotal}>
              <span>{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</span>
              <strong>{money(total)}</strong>
            </div>
            {error ? <p style={styles.error}>{error}</p> : null}
            <div style={styles.dialogActions}>
              <button type="button" style={styles.dialogGhost} disabled={busy} onClick={() => setConfirming(false)}>Go back</button>
              <button type="button" style={styles.dialogConfirm} disabled={busy || !canPlace} onClick={() => void submit()}>
                {busy ? 'Sending…' : paymentMethod === 'UPI' ? 'Pay now' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </PortalShell>
  );
}

const LAUNDRY_LAYOUT = `
.laundry-hit{transition:transform .12s ease}
.laundry-page{overflow-x:hidden}
.laundry-shops{scrollbar-width:none}
.laundry-shops::-webkit-scrollbar{display:none}
.laundry-hit:active{transform:scale(.97)}
.laundry-page{display:grid;gap:0.45rem;align-content:start}
.laundry-top,.laundry-catalog,.laundry-book{display:grid;gap:0.45rem;align-content:start;min-width:0}
.laundry-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.4rem}
.laundry-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.4rem}
@media (min-width:768px){
  .laundry-page{grid-template-columns:minmax(0,1fr) minmax(17.5rem,22rem);column-gap:1rem;row-gap:0.7rem;align-items:start}
  .laundry-top{grid-column:1;grid-row:1}
  .laundry-catalog{grid-column:1;grid-row:2}
  .laundry-services{grid-template-columns:repeat(3,minmax(0,12.5rem));justify-content:start}
  .laundry-grid{grid-template-columns:repeat(auto-fill,minmax(8.25rem,1fr));gap:0.55rem}
  .laundry-book{
    grid-column:2;grid-row:1 / span 2;position:sticky;top:0.4rem;
    background:var(--bg-elevated,#fff);border:1px solid var(--border,#e4e7ea);
    border-radius:18px;padding:0.65rem;box-shadow:var(--shadow-card);
  }
}
`;

const styles: Record<string, CSSProperties> = {
  scroller: { display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.15rem', scrollbarWidth: 'none' },
  shop: {
    flex: '0 0 auto',
    minWidth: '8.4rem',
    minHeight: 52,
    display: 'grid',
    alignContent: 'center',
    gap: '0.05rem',
    textAlign: 'left',
    padding: '0.4rem 0.7rem',
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  shopOn: {
    flex: '0 0 auto',
    minWidth: '8.4rem',
    minHeight: 52,
    display: 'grid',
    alignContent: 'center',
    gap: '0.05rem',
    textAlign: 'left',
    padding: '0.4rem 0.7rem',
    borderRadius: 14,
    border: '1.5px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 12%, #fff)',
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  shopMeta: { fontSize: '0.72rem', color: 'var(--text-muted, #667)', fontWeight: 600 },
  serviceRow: { display: 'grid', gap: '0.4rem' },
  service: {
    minHeight: 52,
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '0.1rem',
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  serviceOn: {
    minHeight: 52,
    borderRadius: 14,
    border: '1.5px solid var(--accent, #166534)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '0.1rem',
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--text, #111)',
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(16, 24, 40, 0.03)',
  },
  serviceEmoji: { fontSize: '1.15rem', lineHeight: 1 },
  grid: { display: 'grid', gap: '0.4rem' },
  tile: { display: 'grid', gap: '0.12rem', justifyItems: 'start', cursor: 'pointer' },
  tileOn: { display: 'grid', gap: '0.12rem', justifyItems: 'start', cursor: 'pointer' },
  swatch: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 0.92',
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center',
    boxShadow: 'inset 0 0 0 1px rgba(16, 24, 40, 0.04)',
  },
  emoji: { fontSize: '1.55rem', lineHeight: 1 },
  itemPhoto: { width: '78%', height: '78%', objectFit: 'contain', pointerEvents: 'none' },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    borderRadius: 999,
    background: 'var(--accent, #166534)',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
  },
  stepper: { position: 'absolute', right: 4, bottom: 4 },
  tileName: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--text, #111)' },
  tilePrice: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #444)' },
  photo: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent, #166534)', cursor: 'pointer' },
  photoOn: { fontSize: '0.68rem', fontWeight: 800, color: '#14532d', cursor: 'pointer' },
  other: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    padding: '0 0.7rem',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
  },
  basket: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  basketChip: {
    flex: '0 0 auto',
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    padding: '0 0.65rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  tripLabel: { margin: '0.15rem 0 0', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text, #111)' },
  tripRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' },
  payRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', flex: '0 0 auto' },
  slotBlock: { display: 'grid', gap: '0.35rem' },
  slotRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem' },
  slot: {
    minHeight: 40,
    borderRadius: 999,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    color: '#111',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  slotOn: {
    minHeight: 40,
    borderRadius: 999,
    border: '1.5px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 14%, #fff)',
    color: '#111',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  slotOff: {
    minHeight: 40,
    borderRadius: 999,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-muted, #f3f4f6)',
    color: 'var(--text-muted, #98a2b3)',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'not-allowed',
  },
  slotDate: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 800 },
  dateInput: { minHeight: 40, border: '1px solid var(--border)', borderRadius: 8, padding: '0 0.45rem', background: '#fff', color: '#111', colorScheme: 'light' },
  slotHint: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #667)' },
  tripOff: {
    minHeight: 48,
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-muted, #f3f4f6)',
    color: 'var(--text-muted, #98a2b3)',
    fontWeight: 700,
    fontSize: '0.75rem',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '0.05rem',
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  trip: {
    minHeight: 48,
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    color: 'var(--text, #111)',
    fontWeight: 700,
    fontSize: '0.75rem',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '0.05rem',
    cursor: 'pointer',
  },
  tripOn: {
    minHeight: 48,
    borderRadius: 14,
    border: '1.5px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 12%, #fff)',
    color: 'var(--text, #111)',
    fontWeight: 800,
    fontSize: '0.75rem',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '0.05rem',
    cursor: 'pointer',
  },
  addressRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  address: {
    minHeight: 40,
    borderRadius: 999,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    padding: '0 0.7rem',
    fontWeight: 700,
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  addressOn: {
    minHeight: 40,
    borderRadius: 999,
    border: '1.5px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 12%, #fff)',
    padding: '0 0.7rem',
    fontWeight: 800,
    color: 'var(--text, #111)',
    cursor: 'pointer',
  },
  addressAdd: { minHeight: 40, display: 'inline-flex', alignItems: 'center', fontWeight: 800, color: 'var(--accent, #166534)', textDecoration: 'none' },
  noteToggle: { border: 0, background: 'transparent', padding: 0, minHeight: 36, textAlign: 'left', fontWeight: 800, color: 'var(--accent, #166534)', cursor: 'pointer' },
  note: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    padding: '0 0.7rem',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
  },
  dock: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    zIndex: 40,
    display: 'grid',
    gap: '0.35rem',
    padding: '0.45rem 0.75rem',
    background: '#fff',
    borderTop: '1px solid var(--border, #e5e7eb)',
    boxSizing: 'border-box',
    boxShadow: '0 -8px 24px rgba(16, 24, 40, 0.06)',
  },
  dockRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' },
  dockTotal: { display: 'block', fontSize: '1.05rem' },
  dockMeta: { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted, #667)', fontWeight: 600 },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 130,
    display: 'grid',
    placeItems: 'end center',
    padding: '0.4rem 0.6rem calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 0.35rem)',
    background: 'rgba(15, 23, 20, 0.45)',
    overflow: 'hidden',
  },
  dialog: {
    width: 'min(28rem, 100%)',
    maxHeight: '100%',
    overflow: 'hidden',
    background: 'var(--bg-elevated, #fff)',
    color: 'var(--text, #111)',
    borderRadius: 18,
    padding: '0.65rem 0.75rem 0.6rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    boxShadow: '0 16px 40px rgba(16, 24, 40, 0.18)',
  },
  dialogTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 800 },
  dialogNote: { margin: 0, padding: '0.35rem 0.5rem', borderRadius: 10, background: '#fef3c7', fontSize: '0.75rem', lineHeight: 1.3 },
  bill: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.12rem', overflowY: 'auto', minHeight: 0, flex: '0 1 auto', scrollbarWidth: 'none' },
  billRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', fontSize: '0.82rem' },
  billMeta: { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted, #667)', fontWeight: 600 },
  billTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: '0.3rem', fontSize: '1rem', flex: '0 0 auto' },
  pay: {
    minHeight: 40,
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
    fontWeight: 800,
    cursor: 'pointer',
  },
  payOn: {
    minHeight: 40,
    borderRadius: 12,
    border: '1.5px solid var(--accent, #166534)',
    background: 'color-mix(in srgb, var(--accent, #166534) 12%, #fff)',
    color: '#111',
    colorScheme: 'light',
    fontWeight: 800,
    cursor: 'pointer',
  },
  dialogActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', flex: '0 0 auto' },
  dialogGhost: {
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
    fontWeight: 800,
    cursor: 'pointer',
  },
  dialogConfirm: {
    minHeight: 44,
    border: 0,
    borderRadius: 12,
    background: 'var(--accent, #166534)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  dockBtn: {
    minHeight: 44,
    border: 0,
    borderRadius: 12,
    background: 'var(--accent, #166534)',
    color: '#fff',
    fontWeight: 800,
    padding: '0 1rem',
    cursor: 'pointer',
  },
  card: { padding: '0.6rem 0.7rem', borderRadius: 16, background: 'var(--bg-elevated, #fff)', display: 'grid', gap: '0.15rem' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' },
  status: { fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent, #166534)' },
  cardActions: { display: 'flex', gap: '0.7rem' },
  h2: { fontSize: '0.95rem', margin: '0.2rem 0 0' },
  muted: { color: 'var(--text-muted, #666)', fontSize: '0.75rem', margin: 0 },
  error: { color: '#b91c1c', fontWeight: 700, margin: 0 },
  notice: { color: '#166534', fontWeight: 700, margin: 0 },
  textBtn: { minHeight: 36, border: 0, background: 'transparent', color: 'var(--accent, #166534)', fontWeight: 800, padding: 0, cursor: 'pointer' },
};
