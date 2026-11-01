import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Toast } from '@/shared/ui';
import { getTownConfig, listTowns, setTownLaundryEnabled, type TownVm } from '@/features/towns/api/townsApi';
import {
  LAUNDRY_ITEMS,
  LAUNDRY_SERVICES,
  fetchAdminLaundryOrders,
  fetchTownLaundryShops,
  saveTownLaundryShop,
  type LaundryAdminOrder,
  type LaundryRate,
  type LaundryShop,
} from '../api/laundryApi';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function adminFeeText(shop?: LaundryShop): string {
  if (!shop) return 'Customer platform fee is the town fee. Vendor billing is set on Billing.';
  const perPiece = Number(shop.perPieceAmount || 0);
  const perOrder = Number(shop.perOrderFlatAmount || 0);
  if (shop.feeModel === 'PER_PIECE' || shop.feeModel === 'PER_PIECE_WITH_SUBSCRIPTION') {
    return `Billing fee ₹${perPiece} per piece is collected from the shop at settlement. The customer platform fee is the town fee.`;
  }
  if (shop.feeModel === 'PER_ORDER_FLAT' || shop.feeModel === 'PER_ORDER_WITH_SUBSCRIPTION') {
    return `Billing fee ₹${perOrder} per order is collected from the shop at settlement. The customer platform fee is the town fee.`;
  }
  return 'No vendor billing fee on the order. The customer platform fee is the town fee. A monthly subscription is billed to the shop on its own.';
}

function priceText(value: number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : '';
}

function openDaysFromStored(raw?: string | null): string[] {
  const closed = (raw ?? '').split(',').map((day) => day.trim()).filter(Boolean);
  if (closed.length === 0 || closed.length >= WEEKDAYS.length) return [...WEEKDAYS];
  return WEEKDAYS.filter((day) => !closed.includes(day));
}

function payloadFromShop(shop: LaundryShop, enabled: boolean, priceEditAllowed: boolean) {
  return {
    enabled,
    priceEditAllowed,
    dailyPieceCapacity: shop.dailyPieceCapacity ?? undefined,
    clearDailyPieceCapacity: !shop.dailyPieceCapacity,
    closedWeekdays: shop.closedWeekdays ?? '',
    pickupCharge: Number(shop.pickupCharge ?? 0),
    dropCharge: Number(shop.dropCharge ?? 0),
    pickupAndDropCharge: Number(shop.pickupAndDropCharge ?? 0),
    rates: shop.rates ?? [],
  };
}

export function LaundryAdminPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [laundryOn, setLaundryOn] = useState(false);
  const [townBusy, setTownBusy] = useState(false);
  const [shops, setShops] = useState<LaundryShop[]>([]);
  const [orders, setOrders] = useState<LaundryAdminOrder[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [priceEdit, setPriceEdit] = useState(false);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');
  const [pickupCharge, setPickupCharge] = useState('');
  const [dropCharge, setDropCharge] = useState('');
  const [bothCharge, setBothCharge] = useState('');
  const [openDays, setOpenDays] = useState<string[]>([...WEEKDAYS]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shopPricesExpanded, setShopPricesExpanded] = useState(false);
  const townIdRef = useRef(townId);
  townIdRef.current = townId;

  useEffect(() => {
    if (!token) return;
    void listTowns(token)
      .then((rows) => {
        setTowns(rows);
        setTownId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load towns'));
  }, [token]);

  useEffect(() => {
    if (!token || !townId) return;
    const loadForTown = townId;
    let cancelled = false;
    setError(null);

    void getTownConfig(token, loadForTown)
      .then((config) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setLaundryOn(config.laundryEnabled === true);
      })
      .catch((err) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load town laundry settings');
      });

    void fetchTownLaundryShops(token, loadForTown)
      .then((shopRows) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setShops(shopRows);
        setVendorId((prev) => (shopRows.some((shop) => shop.vendorId === prev) ? prev : shopRows[0]?.vendorId ?? ''));
      })
      .catch((err) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setShops([]);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load laundry shops');
      });

    void fetchAdminLaundryOrders(token, loadForTown)
      .then((orderRows) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setOrders(orderRows);
      })
      .catch((err) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setOrders([]);
        setError((prev) =>
          prev
            ? `${prev} · Requests list did not load`
            : err instanceof ApiError || err instanceof Error
              ? `${err.message} (requests list)`
              : 'Could not load laundry requests',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, townId]);

  useEffect(() => {
    const shop = shops.find((item) => item.vendorId === vendorId);
    if (!shop) return;
    setEnabled(shop.enabled);
    setPriceEdit(shop.priceEditAllowed);
    setCapacity(shop.dailyPieceCapacity ? String(shop.dailyPieceCapacity) : '');
    setPickupCharge(shop.pickupCharge ? String(shop.pickupCharge) : '');
    setDropCharge(shop.dropCharge ? String(shop.dropCharge) : '');
    setBothCharge(shop.pickupAndDropCharge ? String(shop.pickupAndDropCharge) : '');
    setOpenDays(openDaysFromStored(shop.closedWeekdays));
    const next: Record<string, string> = {};
    for (const service of LAUNDRY_SERVICES) {
      for (const item of LAUNDRY_ITEMS) {
        const found = shop.rates?.find((rate) => rate.serviceType === service.id && rate.itemType === item.id);
        next[`${service.id}|${item.id}`] = found ? priceText(found.unitPrice) : '';
      }
    }
    setRates(next);
  }, [vendorId, shops]);

  useEffect(() => {
    setShopPricesExpanded(false);
  }, [vendorId]);

  function shopPayload(shopEnabled: boolean, shopPriceEdit: boolean) {
    const payload: LaundryRate[] = Object.entries(rates)
      .filter(([, price]) => price !== '')
      .map(([key, price]) => {
        const [serviceType, itemType] = key.split('|');
        return { serviceType, itemType, unitPrice: Number(price) };
      });
    const closedWeekdays = WEEKDAYS.filter((day) => !openDays.includes(day)).join(',');
    return {
      enabled: shopEnabled,
      priceEditAllowed: shopPriceEdit,
      dailyPieceCapacity: capacity ? Number(capacity) : undefined,
      clearDailyPieceCapacity: !capacity,
      closedWeekdays,
      pickupCharge: Number(pickupCharge || 0),
      dropCharge: Number(dropCharge || 0),
      pickupAndDropCharge: Number(bothCharge || 0),
      rates: payload,
    };
  }

  async function setTownLaundry(next: boolean) {
    if (!token || !townId || townBusy) return;
    const targetTownId = townId;
    setTownBusy(true);
    setError(null);
    try {
      const saved = await setTownLaundryEnabled(token, targetTownId, next);
      if (townIdRef.current === targetTownId) {
        setLaundryOn(saved.laundryEnabled === true);
      }
      setToast(saved.laundryEnabled ? 'Laundry enabled for this town' : 'Laundry turned off for buyers');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update town');
    } finally {
      setTownBusy(false);
    }
  }

  async function setShopVisible(targetVendorId: string, next: boolean) {
    if (!token || visibilityBusyId) return;
    const shop = shops.find((row) => row.vendorId === targetVendorId);
    if (!shop) return;
    const body =
      targetVendorId === vendorId
        ? shopPayload(next, priceEdit)
        : payloadFromShop(shop, next, shop.priceEditAllowed);
    setVisibilityBusyId(targetVendorId);
    setError(null);
    const previousEnabled = shop.enabled;
    setShops((prev) =>
      prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: next } : row)),
    );
    if (targetVendorId === vendorId) setEnabled(next);
    try {
      const saved = await saveTownLaundryShop(token, targetVendorId, body);
      setShops((prev) => prev.map((row) => (row.vendorId === saved.vendorId ? saved : row)));
      if (targetVendorId === vendorId) setEnabled(saved.enabled);
      setToast(`${saved.businessName}: ${saved.enabled ? 'visible to buyers' : 'hidden from buyers'}`);
    } catch (err) {
      setShops((prev) =>
        prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: previousEnabled } : row)),
      );
      if (targetVendorId === vendorId) setEnabled(previousEnabled);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update shop');
    } finally {
      setVisibilityBusyId(null);
    }
  }

  async function saveShop() {
    if (!token || !vendorId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTownLaundryShop(token, vendorId, shopPayload(enabled, priceEdit));
      setShops((prev) => prev.map((shop) => (shop.vendorId === saved.vendorId ? saved : shop)));
      setToast(`${saved.businessName} saved`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save shop');
    } finally {
      setSaving(false);
    }
  }

  const townName = towns.find((town) => town.id === townId)?.displayName ?? 'this town';
  const selectedShop = shops.find((shop) => shop.vendorId === vendorId);

  return (
    <PortalShell title="Koya Laundry — town setup">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Toast open={Boolean(toast)} message={toast ?? ''} tone="success" placement="center" durationMs={3500} onClose={() => setToast(null)} />

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>How laundry works</h2>
        <ol style={styles.steps}>
          <li>
            <strong>Vendors</strong> — Register with service <em>Laundry</em> (
            <Link to="/vendors" style={styles.link}>
              Vendors
            </Link>
            ).
          </li>
          <li>
            <strong>Shop</strong> — In the vendor portal (Laundry), they manage pickups and daily capacity.
          </li>
          <li>
            <strong>You (here)</strong> — Turn laundry on for the town, choose which shops buyers see, and set prices.
          </li>
        </ol>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>1</span>
          <div>
            <h3 style={styles.cardTitle}>Town</h3>
            <p style={styles.cardSub}>When off, buyers never see Laundry in {townName}.</p>
          </div>
        </div>
        <div style={styles.row}>
          <label style={styles.field}>
            Town
            <select style={styles.input} value={townId} onChange={(e) => setTownId(e.target.value)}>
              {towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.displayName}
                </option>
              ))}
            </select>
          </label>
          <div style={styles.switchBlock}>
            <span style={styles.switchLabel}>Allow laundry orders</span>
            <button
              type="button"
              disabled={townBusy}
              style={laundryOn ? styles.switchOn : styles.switchOff}
              aria-pressed={laundryOn}
              onClick={() => void setTownLaundry(!laundryOn)}
            >
              <span style={styles.knob} data-on={laundryOn ? '1' : '0'} />
              {townBusy ? 'Saving…' : laundryOn ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>2</span>
          <div>
            <h3 style={styles.cardTitle}>Laundry shop</h3>
            <p style={styles.cardSub}>Only vendors assigned to Laundry appear here (not glam or grocery).</p>
          </div>
        </div>
        {shops.length === 0 ? (
          <p style={styles.muted}>
            No laundry shops in this town yet.{' '}
            <Link to="/vendors" style={styles.link}>
              Add or edit a vendor
            </Link>{' '}
            and set Service to <strong>Laundry</strong>.
          </p>
        ) : (
          <div style={styles.fieldGrow}>
            <span>Shop ({shops.length}) — tap a name to edit prices; use Visible on each card for buyers.</span>
            <div style={styles.vendorPickRow} role="tablist" aria-label="Laundry shops">
              {shops.map((shop) => {
                const selected = shop.vendorId === vendorId;
                const busy = visibilityBusyId === shop.vendorId;
                return (
                  <div
                    key={shop.vendorId}
                    role="tab"
                    aria-selected={selected}
                    style={selected ? styles.vendorPickOn : styles.vendorPickOff}
                  >
                    <button type="button" style={styles.vendorPickSelect} onClick={() => setVendorId(shop.vendorId)}>
                      {shop.businessName}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(visibilityBusyId)}
                      style={shop.enabled ? styles.shopVisOn : styles.shopVisOff}
                      aria-pressed={shop.enabled}
                      title="Show or hide this shop for buyers"
                      onClick={() => void setShopVisible(shop.vendorId, !shop.enabled)}
                    >
                      <span style={styles.knob} data-on={shop.enabled ? '1' : '0'} />
                      {busy ? 'Saving…' : shop.enabled ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!laundryOn && shops.length > 0 ? (
          <p style={styles.warn}>Town laundry is off — buyers still cannot order even if a shop is visible.</p>
        ) : null}
      </section>

      {vendorId && selectedShop ? (
        <section style={styles.card}>
          <div style={styles.cardHeadCompact}>
            <span style={styles.stepNumSm}>3</span>
            <h3 style={styles.cardTitleInline}>
              {selectedShop.businessName} — prices &amp; ops
              <span style={styles.cardSubInline}> · ₹/pc; empty = not offered</span>
            </h3>
            <button
              type="button"
              style={styles.expandBtn}
              aria-expanded={shopPricesExpanded}
              aria-label={shopPricesExpanded ? 'Collapse price grid' : 'Expand price grid'}
              title={shopPricesExpanded ? 'Minimize' : 'Maximize'}
              onClick={() => setShopPricesExpanded((open) => !open)}
            >
              <span style={styles.expandIcon} aria-hidden>
                {shopPricesExpanded ? '▲' : '▼'}
              </span>
            </button>
          </div>

          <div style={styles.rowTight}>
            <span style={styles.dayLabel}>Open</span>
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                style={openDays.includes(day) ? styles.dayOn : styles.dayOff}
                onClick={() =>
                  setOpenDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]))
                }
              >
                {day.slice(0, 3)}
              </button>
            ))}
            <label style={styles.field}>
              Pieces / day
              <input
                style={styles.narrow}
                inputMode="numeric"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
            <div style={styles.switchBlock}>
              <span style={styles.switchLabel}>Vendor can edit prices</span>
              <button
                type="button"
                style={priceEdit ? styles.switchOn : styles.switchOff}
                aria-pressed={priceEdit}
                onClick={() => setPriceEdit((v) => !v)}
              >
                <span style={styles.knob} data-on={priceEdit ? '1' : '0'} />
                {priceEdit ? 'Unlocked' : 'Locked'}
              </button>
            </div>
          </div>

          <div style={styles.rowTight}>
            <label style={styles.field}>
              Pickup ₹
              <input
                style={styles.narrow}
                inputMode="decimal"
                value={pickupCharge}
                placeholder="0"
                onChange={(e) => setPickupCharge(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </label>
            <label style={styles.field}>
              Drop ₹
              <input
                style={styles.narrow}
                inputMode="decimal"
                value={dropCharge}
                placeholder="0"
                onChange={(e) => setDropCharge(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </label>
            <label style={styles.field}>
              Pickup &amp; drop ₹
              <input
                style={styles.narrow}
                inputMode="decimal"
                value={bothCharge}
                placeholder="0"
                onChange={(e) => setBothCharge(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </label>
          </div>
          <p style={styles.mutedTight} title={adminFeeText(selectedShop)}>
            Trip fee once per order · {adminFeeText(selectedShop).slice(0, 72)}
            {adminFeeText(selectedShop).length > 72 ? '…' : ''}{' '}
            <Link to="/vendor-billing" style={styles.link}>
              Billing
            </Link>
          </p>

          {shopPricesExpanded ? (
            <>
              <div style={styles.tableScroll}>
                <div style={styles.table}>
                  <span style={styles.colHeadSticky} />
                  {LAUNDRY_SERVICES.map((service) => (
                    <span key={service.id} style={styles.colHeadSticky}>
                      {service.label}
                    </span>
                  ))}
                  {LAUNDRY_ITEMS.map((item) => (
                    <Fragment key={item.id}>
                      <span style={styles.item}>{item.label}</span>
                      {LAUNDRY_SERVICES.map((service) => {
                        const key = `${service.id}|${item.id}`;
                        return (
                          <input
                            key={key}
                            style={styles.price}
                            inputMode="decimal"
                            aria-label={`${item.label} ${service.label}`}
                            placeholder="—"
                            value={rates[key] ?? ''}
                            onChange={(e) => setRates((prev) => ({ ...prev, [key]: e.target.value.replace(/[^\d.]/g, '') }))}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

            </>
          ) : null}

          <div style={styles.actionsTight}>
            <button type="button" style={styles.primary} disabled={saving} onClick={() => void saveShop()}>
              {saving ? 'Saving…' : 'Save shop'}
            </button>
          </div>
        </section>
      ) : null}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Requests in {townName}</h3>
        {orders.length === 0 ? <p style={styles.muted}>No requests yet.</p> : null}
        {orders.map((order) => (
          <div key={order.id} style={styles.order}>
            <strong>{order.orderNumber}</strong>
            <span>{order.shopName}</span>
            <span>{order.statusLabel}</span>
            <span>{order.pieceCount} pcs</span>
            <span>
              ₹
              {(Number(order.goodsAmount) + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0)).toFixed(0)}
            </span>
            {Number(order.platformFeeAmount) > 0 ? (
              <span>Platform fee ₹{Number(order.platformFeeAmount).toFixed(0)}</span>
            ) : null}
            {Number(order.codFee) > 0 ? <span>COD ₹{Number(order.codFee).toFixed(0)}</span> : null}
            <span>{order.paymentStatus}</span>
          </div>
        ))}
      </section>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    padding: '0.85rem 1rem',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #ecfdf5 0%, #fff 50%, #f0fdf4 100%)',
    border: '1px solid var(--border, #e5e7eb)',
    marginBottom: '0.55rem',
  },
  heroTitle: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 900 },
  steps: { margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  link: { color: '#166534', fontWeight: 800, textDecoration: 'none' },
  card: {
    padding: '0.55rem 0.65rem',
    borderRadius: 12,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-elevated, #fff)',
    marginBottom: '0.45rem',
    display: 'grid',
    gap: '0.4rem',
  },
  cardHead: { display: 'flex', gap: '0.45rem', alignItems: 'flex-start' },
  cardHeadCompact: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' },
  expandBtn: {
    marginLeft: 'auto',
    minWidth: 36,
    minHeight: 36,
    border: '1px solid var(--border, #ddd)',
    borderRadius: 8,
    background: '#f9fafb',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  expandIcon: { fontSize: '0.75rem', lineHeight: 1, color: '#166534', fontWeight: 900 },
  cardTitleInline: { margin: 0, fontSize: '0.86rem', fontWeight: 900, lineHeight: 1.25 },
  cardSubInline: { fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' },
  stepNumSm: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#166534',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.72rem',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#166534',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.85rem',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  cardTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 900 },
  cardSub: { margin: '0.15rem 0 0', fontSize: '0.72rem', lineHeight: 1.4, color: 'var(--text-muted)', fontWeight: 600 },
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' },
  rowTight: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700 },
  fieldGrow: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700, flex: '1 1 14rem', minWidth: 180 },
  vendorPickRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  vendorPickOn: {
    flex: '1 1 11rem',
    maxWidth: '100%',
    borderRadius: 10,
    border: '2px solid #166534',
    background: 'linear-gradient(135deg, #dcfce7, #fff)',
    padding: '0.35rem 0.45rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    justifyContent: 'space-between',
  },
  vendorPickOff: {
    flex: '1 1 11rem',
    maxWidth: '100%',
    borderRadius: 10,
    border: '1px solid var(--border, #ddd)',
    background: '#fff',
    padding: '0.35rem 0.45rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    justifyContent: 'space-between',
  },
  vendorPickSelect: {
    border: 0,
    background: 'transparent',
    padding: 0,
    margin: 0,
    fontSize: '0.82rem',
    fontWeight: 900,
    color: 'var(--text, #111)',
    cursor: 'pointer',
    textAlign: 'left',
    flex: '1 1 6rem',
    minHeight: 36,
  },
  shopVisOn: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    border: '1px solid #166534',
    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
    fontWeight: 900,
    fontSize: '0.72rem',
    color: '#14532d',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
    flexShrink: 0,
  },
  shopVisOff: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 800,
    fontSize: '0.72rem',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
    flexShrink: 0,
  },
  switchBlock: { display: 'grid', gap: '0.2rem' },
  switchLabel: { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' },
  switchOn: {
    minHeight: 32,
    minWidth: 80,
    borderRadius: 999,
    border: '1px solid #166534',
    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
    fontWeight: 900,
    fontSize: '0.72rem',
    color: '#14532d',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
  },
  switchOff: {
    minHeight: 32,
    minWidth: 80,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 800,
    fontSize: '0.72rem',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
  },
  knob: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    background: 'currentColor',
    opacity: 0.35,
  },
  input: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.5rem', background: '#fff', minWidth: '9rem' },
  narrow: { minHeight: 30, width: '3.75rem', border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0 0.35rem', background: '#fff', fontSize: '0.78rem' },
  dayLabel: { fontSize: '0.68rem', fontWeight: 800, alignSelf: 'center' },
  dayOn: { minHeight: 28, minWidth: 34, borderRadius: 999, border: '1px solid #166534', background: '#dcfce7', fontWeight: 800, fontSize: '0.65rem', padding: '0 0.2rem' },
  dayOff: { minHeight: 28, minWidth: 34, borderRadius: 999, border: '1px solid var(--border)', background: '#fff', color: '#888', fontSize: '0.65rem', padding: '0 0.2rem' },
  tableScroll: {
    maxHeight: 'min(38vh, 280px)',
    overflowY: 'auto',
    overflowX: 'auto',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    padding: '0.35rem 0.4rem',
    background: '#fafafa',
  },
  table: {
    display: 'grid',
    gridTemplateColumns: 'minmax(6.5rem, 9rem) repeat(3, minmax(3.5rem, 4.5rem))',
    gap: '0.15rem 0.35rem',
    alignItems: 'center',
    width: 'max-content',
    minWidth: '100%',
  },
  colHead: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  colHeadSticky: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    fontSize: '0.62rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    background: '#fafafa',
    padding: '0.15rem 0',
    lineHeight: 1.2,
  },
  item: { fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' },
  price: {
    minHeight: 28,
    width: '100%',
    border: '1px solid var(--border, #ddd)',
    borderRadius: 6,
    padding: '0 0.3rem',
    background: '#fff',
    fontSize: '0.78rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  actionsTight: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginTop: '0.05rem' },
  primary: { minHeight: 34, border: 0, borderRadius: 8, background: '#166534', color: '#fff', fontWeight: 800, fontSize: '0.78rem', padding: '0 0.75rem' },
  mutedTight: { margin: 0, fontSize: '0.68rem', lineHeight: 1.35, color: 'var(--text-muted)', fontWeight: 600 },
  order: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  warn: { margin: 0, fontSize: '0.72rem', color: '#b45309', fontWeight: 700 },
};
