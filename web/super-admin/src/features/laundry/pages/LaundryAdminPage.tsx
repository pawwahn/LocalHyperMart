import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner } from '@/shared/ui/Banner';
import { Toast } from '@/shared/ui/Toast';
import { getTownConfig, listTowns, updateTownConfig, type TownVm } from '@/features/towns/api/townsApi';
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

/** Stored value is closed days. A shop closed every day was the old inverted control, so treat that as open all week. */
function openDaysFromStored(raw?: string | null): string[] {
  const closed = (raw ?? '').split(',').map((day) => day.trim()).filter(Boolean);
  if (closed.length === 0 || closed.length >= WEEKDAYS.length) return [...WEEKDAYS];
  return WEEKDAYS.filter((day) => !closed.includes(day));
}

export function LaundryAdminPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [laundryOn, setLaundryOn] = useState(false);
  const [shops, setShops] = useState<LaundryShop[]>([]);
  const [orders, setOrders] = useState<LaundryAdminOrder[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [priceEdit, setPriceEdit] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [pickupCharge, setPickupCharge] = useState('');
  const [dropCharge, setDropCharge] = useState('');
  const [bothCharge, setBothCharge] = useState('');
  const [openDays, setOpenDays] = useState<string[]>([...WEEKDAYS]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAlert, setSavedAlert] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void listTowns(token).then((rows) => {
      setTowns(rows);
      setTownId((prev) => prev || rows[0]?.id || '');
    }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load towns'));
  }, [token]);

  useEffect(() => {
    if (!token || !townId) return;
    void Promise.all([
      getTownConfig(token, townId),
      fetchTownLaundryShops(token, townId),
      fetchAdminLaundryOrders(token, townId),
    ]).then(([config, shopRows, orderRows]) => {
      setLaundryOn(config.laundryEnabled);
      setShops(shopRows);
      setOrders(orderRows);
      setVendorId((prev) => (shopRows.some((shop) => shop.vendorId === prev) ? prev : shopRows[0]?.vendorId ?? ''));
    }).catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load laundry'));
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

  async function toggleTown(next: boolean) {
    if (!token || !townId) return;
    setError(null);
    try {
      const config = await getTownConfig(token, townId);
      const saved = await updateTownConfig(token, townId, { ...config, laundryEnabled: next });
      setLaundryOn(saved.laundryEnabled);
      setNotice(next ? 'Laundry is on in this town' : 'Laundry is off in this town');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update the town');
    }
  }

  async function saveShop() {
    if (!token || !vendorId || saving) return;
    setSaving(true);
    setError(null);
    setSavedAlert(false);
    const payload: LaundryRate[] = Object.entries(rates)
      .filter(([, price]) => price !== '')
      .map(([key, price]) => {
        const [serviceType, itemType] = key.split('|');
        return { serviceType, itemType, unitPrice: Number(price) };
      });
    const closedWeekdays = WEEKDAYS.filter((day) => !openDays.includes(day)).join(',');
    try {
      const saved = await saveTownLaundryShop(token, vendorId, {
        enabled,
        priceEditAllowed: priceEdit,
        dailyPieceCapacity: capacity ? Number(capacity) : undefined,
        clearDailyPieceCapacity: !capacity,
        closedWeekdays,
        pickupCharge: Number(pickupCharge || 0),
        dropCharge: Number(dropCharge || 0),
        pickupAndDropCharge: Number(bothCharge || 0),
        rates: payload,
      });
      setShops((prev) => prev.map((shop) => (shop.vendorId === saved.vendorId ? saved : shop)));
      setNotice('Shop saved');
      setSavedAlert(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save shop');
    } finally {
      setSaving(false);
    }
  }

  const townName = towns.find((town) => town.id === townId)?.displayName ?? 'this town';

  return (
    <PortalShell title="Laundry">
      {error ? <p style={styles.error}>{error}</p> : null}
      <Toast
        open={savedAlert}
        message="Shop saved"
        tone="success"
        placement="center"
        durationMs={5000}
        onClose={() => setSavedAlert(false)}
      />
      <div style={styles.row}>
        <label style={styles.field}>
          Town
          <select style={styles.input} value={townId} onChange={(e) => setTownId(e.target.value)}>
            {towns.map((town) => <option key={town.id} value={town.id}>{town.displayName}</option>)}
          </select>
        </label>
        <button type="button" style={laundryOn ? styles.chipOn : styles.chipOff} onClick={() => void toggleTown(!laundryOn)}>
          {laundryOn ? 'Town laundry on' : 'Town laundry off'}
        </button>
        <label style={styles.field}>
          Shop
          <select style={styles.input} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            {shops.map((shop) => <option key={shop.vendorId} value={shop.vendorId}>{shop.businessName}</option>)}
          </select>
        </label>
        <button type="button" style={enabled ? styles.chipOn : styles.chipOff} onClick={() => setEnabled((v) => !v)}>
          {enabled ? 'Shop on' : 'Shop off'}
        </button>
        <button type="button" style={priceEdit ? styles.chipOn : styles.chip} onClick={() => setPriceEdit((v) => !v)}>
          {priceEdit ? 'Shop can edit prices' : 'Prices locked'}
        </button>
      </div>
      {!laundryOn ? <p style={styles.muted}>Customers in {townName} cannot order until town laundry is on.</p> : null}
      <div style={styles.row}>
        <span style={styles.dayLabel}>Open</span>
        {WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            style={openDays.includes(day) ? styles.dayOn : styles.dayOff}
            onClick={() => setOpenDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]))}
          >
            {day.slice(0, 3)}
          </button>
        ))}
        <label style={styles.field}>
          Pieces / day
          <input style={styles.narrow} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
        <button type="button" style={styles.primary} disabled={!vendorId || saving} onClick={() => void saveShop()}>
          {saving ? 'Saving…' : 'Save shop'}
        </button>
        {notice === 'Shop saved' ? <Banner tone="success" style={{ padding: '0.45rem 0.7rem' }}>Shop saved</Banner> : null}
      </div>
      <div style={styles.row}>
        <label style={styles.field}>
          Pickup
          <input style={styles.narrow} inputMode="decimal" value={pickupCharge} placeholder="0" onChange={(e) => setPickupCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={styles.field}>
          Drop
          <input style={styles.narrow} inputMode="decimal" value={dropCharge} placeholder="0" onChange={(e) => setDropCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={styles.field}>
          Pickup & drop
          <input style={styles.narrow} inputMode="decimal" value={bothCharge} placeholder="0" onChange={(e) => setBothCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
      </div>
      <p style={styles.muted}>
        ₹ added once for the trip the customer chooses. {adminFeeText(shops.find((shop) => shop.vendorId === vendorId))}{' '}
        <Link to="/vendor-billing" style={styles.feeLink}>Edit on Billing</Link>
      </p>
      <div style={styles.table}>
        <span />
        {LAUNDRY_SERVICES.map((service) => (
          <span key={service.id} style={styles.colHead}>{service.label}</span>
        ))}
        {LAUNDRY_ITEMS.map((item) => (
          <Fragment key={item.id}>
            <span style={styles.item}>
              {item.image ? <img src={item.image} alt="" style={styles.itemThumb} /> : null}
              {item.label}
            </span>
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
      <p style={styles.muted}>₹ per piece. Leave a cell empty when the shop does not offer that service.</p>
      <h2 style={styles.h2}>Requests in this town</h2>
      {orders.length === 0 ? <p style={styles.muted}>No requests yet.</p> : null}
      {orders.map((order) => (
        <div key={order.id} style={styles.order}>
          <strong>{order.orderNumber}</strong>
          <span>{order.shopName}</span>
          <span>{order.statusLabel}</span>
          <span>{order.pieceCount} pcs</span>
          <span>₹{(Number(order.goodsAmount) + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0)).toFixed(0)}</span>
          {Number(order.platformFeeAmount) > 0 ? <span>Platform fee ₹{Number(order.platformFeeAmount).toFixed(0)}</span> : null}
          {Number(order.codFee) > 0 ? <span>COD ₹{Number(order.codFee).toFixed(0)}</span> : null}
          <span>{order.paymentStatus}</span>
        </div>
      ))}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'end', marginBottom: '0.4rem' },
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700 },
  dayLabel: { fontSize: '0.72rem', fontWeight: 800, alignSelf: 'center' },
  input: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0 0.45rem', minWidth: '9rem', background: 'var(--bg-elevated, #fff)', color: 'inherit' },
  narrow: { minHeight: 40, width: '4.6rem', border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0 0.45rem', background: 'var(--bg-elevated, #fff)', color: 'inherit' },
  chip: { minHeight: 40, borderRadius: 999, border: '1px solid var(--border, #ddd)', background: 'transparent', padding: '0 0.7rem', fontWeight: 700 },
  chipOn: { minHeight: 40, borderRadius: 999, border: '1px solid #166534', background: '#dcfce7', padding: '0 0.7rem', fontWeight: 800 },
  chipOff: { minHeight: 40, borderRadius: 999, border: '1px solid #b91c1c', background: '#fee2e2', padding: '0 0.7rem', fontWeight: 800, color: '#991b1b' },
  dayOn: { minHeight: 40, minWidth: 44, borderRadius: 999, border: '1px solid #166534', background: '#dcfce7', padding: '0 0.55rem', fontWeight: 800 },
  dayOff: { minHeight: 40, minWidth: 44, borderRadius: 999, border: '1px solid var(--border, #ddd)', background: 'transparent', padding: '0 0.55rem', fontWeight: 700, color: '#888' },
  primary: { minHeight: 40, border: 0, borderRadius: 8, background: '#166534', color: '#fff', fontWeight: 800, padding: '0 0.85rem' },
  table: {
    display: 'grid',
    gridTemplateColumns: 'minmax(9.4rem, 12rem) repeat(3, minmax(5.4rem, 7.2rem))',
    gap: '0.28rem 0.45rem',
    alignItems: 'center',
    maxWidth: 640,
    marginTop: '0.2rem',
  },
  colHead: { fontSize: '0.72rem', fontWeight: 800 },
  item: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, minHeight: 40 },
  itemThumb: { width: 32, height: 32, objectFit: 'contain', flex: '0 0 auto' },
  price: {
    minHeight: 40,
    width: '100%',
    border: '1px solid var(--border, #ddd)',
    borderRadius: 8,
    padding: '0 0.45rem',
    background: 'var(--bg-elevated, #fff)',
    color: 'inherit',
  },
  order: { display: 'flex', flexWrap: 'wrap', gap: '0.55rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border, #eee)', fontSize: '0.82rem' },
  h2: { fontSize: '0.95rem', margin: '0.7rem 0 0.25rem' },
  muted: { color: 'var(--text-muted, #666)', fontSize: '0.75rem', margin: '0.15rem 0 0.35rem' },
  feeLink: { color: 'var(--accent, #166534)', fontWeight: 800 },
  error: { color: '#b91c1c', fontWeight: 700, margin: '0 0 0.35rem' },
  notice: { color: '#166534', fontWeight: 700, margin: '0 0 0.35rem' },
};
