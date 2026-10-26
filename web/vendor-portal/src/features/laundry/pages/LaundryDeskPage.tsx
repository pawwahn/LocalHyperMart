import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { APP_NAME } from '@hlm-brand';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { ApiError } from '@/shared/api/http';
import { Toast } from '@/shared/ui';
import {
  LAUNDRY_ITEMS,
  LAUNDRY_SERVICES,
  PICKUP_SLOTS,
  WEEKDAYS,
  fetchMyLaundry,
  parseBlockedSlotIds,
  saveLaundryOps,
  saveLaundryRates,
  type LaundryProfile,
  type LaundryRate,
} from '../api/laundryApi';

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function blockedToday(shop: LaundryProfile | null): string[] {
  if (!shop || shop.blockedPickupDate !== istToday()) return [];
  return parseBlockedSlotIds(shop.blockedPickupSlots);
}

function feeText(profile: { feeModel?: string | null; perPieceAmount?: number | null; perOrderFlatAmount?: number | null }): string {
  const perPiece = Number(profile.perPieceAmount || 0);
  const perOrder = Number(profile.perOrderFlatAmount || 0);
  if (profile.feeModel === 'PER_PIECE' || profile.feeModel === 'PER_PIECE_WITH_SUBSCRIPTION') {
    return perPiece > 0
      ? `Billing fee ₹${perPiece} per piece is collected from the shop at settlement. It is not the town platform fee on the customer bill.`
      : '';
  }
  if (profile.feeModel === 'PER_ORDER_FLAT' || profile.feeModel === 'PER_ORDER_WITH_SUBSCRIPTION') {
    return perOrder > 0
      ? `Billing fee ₹${perOrder} per order is collected from the shop at settlement. It is not the town platform fee on the customer bill.`
      : '';
  }
  return '';
}

function openDaysFromStored(raw?: string | null): string[] {
  const closed = (raw ?? '').split(',').map((day) => day.trim()).filter(Boolean);
  if (closed.length === 0 || closed.length >= WEEKDAYS.length) return [...WEEKDAYS];
  return WEEKDAYS.filter((day) => !closed.includes(day));
}

function rateKey(service: string, item: string): string {
  return `${service}|${item}`;
}

function rateAt(rates: LaundryRate[], service: string, item: string): string {
  const found = rates.find((rate) => rate.serviceType === service && rate.itemType === item);
  return found ? String(found.unitPrice) : '';
}

function pausedFromRates(rates: LaundryRate[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const rate of rates) next[rateKey(rate.serviceType, rate.itemType)] = Boolean(rate.paused);
  return next;
}

export function LaundryDeskPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  usePortalChrome({ title: 'Laundry' });
  const [profile, setProfile] = useState<LaundryProfile | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [capacity, setCapacity] = useState('');
  const [pickupCharge, setPickupCharge] = useState('');
  const [dropCharge, setDropCharge] = useState('');
  const [bothCharge, setBothCharge] = useState('');
  const [openDays, setOpenDays] = useState<string[]>([...WEEKDAYS]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('Saved');
  const [loading, setLoading] = useState(true);
  const closeSaved = useCallback(() => setSavedOpen(false), []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchMyLaundry(token)
      .then((shop) => {
        setProfile(shop);
        const next: Record<string, string> = {};
        const shopRates = shop.rates ?? [];
        for (const item of LAUNDRY_ITEMS) {
          for (const service of LAUNDRY_SERVICES) next[rateKey(service.id, item.id)] = rateAt(shopRates, service.id, item.id);
        }
        setRates(next);
        setPaused(pausedFromRates(shopRates));
        setCapacity(shop.dailyPieceCapacity ? String(shop.dailyPieceCapacity) : '');
        setPickupCharge(shop.pickupCharge ? String(shop.pickupCharge) : '');
        setDropCharge(shop.dropCharge ? String(shop.dropCharge) : '');
        setBothCharge(shop.pickupAndDropCharge ? String(shop.pickupAndDropCharge) : '');
        setOpenDays(openDaysFromStored(shop.closedWeekdays));
        setBlockedSlots(blockedToday(shop));
      })
      .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load laundry'))
      .finally(() => setLoading(false));
  }, [token]);

  function pricedKeys(serviceId?: string, itemId?: string): string[] {
    return Object.entries(rates)
      .filter(([key, price]) => {
        if (price === '') return false;
        const [serviceType, itemType] = key.split('|');
        return (!serviceId || serviceType === serviceId) && (!itemId || itemType === itemId);
      })
      .map(([key]) => key);
  }

  function allPaused(keys: string[]): boolean {
    return keys.length > 0 && keys.every((key) => paused[key]);
  }

  function ratePayload(nextPaused = paused): LaundryRate[] {
    return Object.entries(rates)
      .filter(([, price]) => price !== '')
      .map(([key, price]) => {
        const [serviceType, itemType] = key.split('|');
        return { serviceType, itemType, unitPrice: Number(price), paused: Boolean(nextPaused[key]) };
      });
  }

  async function persistRates(nextPaused = paused, message = 'Rates saved'): Promise<boolean> {
    if (!token) return false;
    setError(null);
    try {
      const saved = await saveLaundryRates(token, {
        rates: ratePayload(nextPaused),
        pickupCharge: Number(pickupCharge || 0),
        dropCharge: Number(dropCharge || 0),
        pickupAndDropCharge: Number(bothCharge || 0),
      });
      setProfile(saved);
      setPaused(pausedFromRates(saved.rates ?? []));
      setSavedMessage(message);
      setSavedOpen(true);
      return true;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save rates');
      return false;
    }
  }

  async function saveRates() {
    await persistRates(paused, 'Rates saved');
  }

  async function toggleKeys(keys: string[], resumeMessage: string, pauseMessage: string) {
    if (keys.length === 0) return;
    const previous = paused;
    const resume = keys.every((key) => paused[key]);
    const next = { ...paused };
    for (const key of keys) next[key] = !resume;
    setPaused(next);
    const ok = await persistRates(next, resume ? resumeMessage : pauseMessage);
    if (!ok) setPaused(previous);
  }

  async function toggleItemPause(itemId: string) {
    const label = LAUNDRY_ITEMS.find((item) => item.id === itemId)?.label ?? 'Piece';
    await toggleKeys(pricedKeys(undefined, itemId), `${label} visible to customers`, `${label} paused for customers`);
  }

  async function toggleServicePause(serviceId: string) {
    const label = LAUNDRY_SERVICES.find((service) => service.id === serviceId)?.label ?? 'Service';
    await toggleKeys(pricedKeys(serviceId), `${label} visible to customers`, `${label} paused for customers`);
  }

  async function toggleSlotBlock(slotId: string) {
    if (!token) return;
    const previous = blockedSlots;
    const next = previous.includes(slotId) ? previous.filter((id) => id !== slotId) : [...previous, slotId];
    setBlockedSlots(next);
    setError(null);
    try {
      const saved = await saveLaundryOps(token, { blockedPickupSlots: next.join(',') });
      setProfile(saved);
      setBlockedSlots(blockedToday(saved));
      const slot = PICKUP_SLOTS.find((item) => item.id === slotId);
      setSavedMessage(next.includes(slotId) ? `${slot?.label ?? 'Slot'} blocked today` : `${slot?.label ?? 'Slot'} open today`);
      setSavedOpen(true);
    } catch (err) {
      setBlockedSlots(previous);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not block slot');
    }
  }

  async function saveOps() {
    if (!token) return;
    setError(null);
    try {
      const saved = await saveLaundryOps(token, {
        dailyPieceCapacity: capacity ? Number(capacity) : undefined,
        clearDailyPieceCapacity: !capacity,
        closedWeekdays: WEEKDAYS.filter((day) => !openDays.includes(day)).join(','),
      });
      setProfile(saved);
      setSavedMessage('Shop days saved');
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save days');
    }
  }

  if (loading) {
    return <p style={styles.muted}>Loading laundry…</p>;
  }
  if (!profile?.enabled) {
    return <p style={styles.muted}>Laundry is not turned on for this shop. Super admin enables it.</p>;
  }

  return (
    <div>
      {error ? <p style={styles.error}>{error}</p> : null}
      <Toast
        open={savedOpen}
        message={savedMessage}
        brandName={APP_NAME}
        tone="success"
        placement="center"
        durationMs={3500}
        onClose={closeSaved}
      />
      <h2 style={styles.h2}>Rates</h2>
      <div style={styles.row}>
        <label style={styles.field}>
          Pieces / day
          <input style={styles.input} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
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
        <button type="button" style={styles.primary} onClick={() => void saveOps()}>Save days</button>
      </div>
      <div style={styles.row}>
        <span style={styles.dayLabel}>Today’s pickup</span>
        {PICKUP_SLOTS.map((slot) => {
          const off = blockedSlots.includes(slot.id);
          return (
            <button
              key={slot.id}
              type="button"
              style={off ? styles.pauseOn : styles.pauseOff}
              aria-pressed={off}
              title={off ? 'Blocked for customers today' : 'Open for customers today'}
              onClick={() => void toggleSlotBlock(slot.id)}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
      <p style={styles.muted}>
        {profile.priceEditAllowed ? 'You can edit prices.' : 'Prices are locked by super admin.'} Block a pickup slot to hide it from customers today. Pause hides a service or a piece. Green days are open.
      </p>
      <div style={styles.row}>
        <label style={styles.field}>
          Pickup
          <input style={styles.input} inputMode="decimal" disabled={!profile.priceEditAllowed} value={pickupCharge} placeholder="0" onChange={(e) => setPickupCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={styles.field}>
          Drop
          <input style={styles.input} inputMode="decimal" disabled={!profile.priceEditAllowed} value={dropCharge} placeholder="0" onChange={(e) => setDropCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={styles.field}>
          Pickup & drop
          <input style={styles.input} inputMode="decimal" disabled={!profile.priceEditAllowed} value={bothCharge} placeholder="0" onChange={(e) => setBothCharge(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
      </div>
      <p style={styles.muted}>₹ added once for the trip the customer chooses. Saved with rates. {feeText(profile)}</p>
      <div style={styles.table}>
        <span />
        {LAUNDRY_SERVICES.map((service) => {
          const off = allPaused(pricedKeys(service.id));
          const hasPrice = pricedKeys(service.id).length > 0;
          return (
            <div key={service.id} style={styles.colHeadBox}>
              <strong style={styles.colHead}>{service.label}</strong>
              <button
                type="button"
                style={off ? styles.pauseOn : styles.pauseOff}
                disabled={!hasPrice}
                aria-pressed={off}
                onClick={() => void toggleServicePause(service.id)}
              >
                {off ? 'Paused' : 'Pause'}
              </button>
            </div>
          );
        })}
        <strong style={styles.colHead}>Piece</strong>
        {LAUNDRY_ITEMS.map((item) => {
          const itemKeys = pricedKeys(undefined, item.id);
          const off = allPaused(itemKeys);
          return (
            <Fragment key={item.id}>
              <span style={{ ...styles.item, ...(off ? styles.itemOff : null) }}>
                {item.image ? <img src={item.image} alt="" style={styles.itemThumb} /> : null}
                {item.label}
              </span>
              {LAUNDRY_SERVICES.map((service) => {
                const key = rateKey(service.id, item.id);
                const cellOff = Boolean(paused[key]);
                return (
                  <input
                    key={key}
                    style={{ ...styles.price, ...(cellOff ? styles.priceOff : null) }}
                    inputMode="decimal"
                    disabled={!profile.priceEditAllowed}
                    value={rates[key] ?? ''}
                    aria-label={`${item.label} ${service.label}`}
                    placeholder="—"
                    onChange={(e) => setRates((prev) => ({ ...prev, [key]: e.target.value.replace(/[^\d.]/g, '') }))}
                  />
                );
              })}
              <button
                type="button"
                style={off ? styles.pauseOn : styles.pauseOff}
                disabled={itemKeys.length === 0}
                aria-pressed={off}
                onClick={() => void toggleItemPause(item.id)}
              >
                {off ? 'Paused' : 'Pause'}
              </button>
            </Fragment>
          );
        })}
      </div>
      <button type="button" style={styles.primary} onClick={() => void saveRates()}>Save rates</button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'end', margin: '0.35rem 0' },
  field: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 700 },
  dayLabel: { fontSize: '0.72rem', fontWeight: 800, alignSelf: 'center' },
  input: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0 0.45rem', width: '6.5rem', background: '#fff', color: '#111', colorScheme: 'light' },
  dayOn: { minHeight: 40, minWidth: 44, borderRadius: 999, border: '1px solid #166534', background: '#dcfce7', color: '#111', padding: '0 0.55rem', fontWeight: 800 },
  dayOff: { minHeight: 40, minWidth: 44, borderRadius: 999, border: '1px solid var(--border, #ddd)', background: '#fff', color: '#111', colorScheme: 'light', padding: '0 0.55rem', fontWeight: 700 },
  primary: { minHeight: 40, border: 0, borderRadius: 8, background: '#166534', color: '#fff', fontWeight: 800, padding: '0 0.75rem' },
  table: {
    display: 'grid',
    gridTemplateColumns: 'minmax(8.6rem, 11rem) repeat(3, minmax(5.4rem, 7rem)) auto',
    gap: '0.28rem 0.4rem',
    alignItems: 'center',
    maxWidth: 760,
    margin: '0.35rem 0',
  },
  colHeadBox: { display: 'grid', gap: '0.2rem', justifyItems: 'stretch' },
  colHead: { fontSize: '0.72rem' },
  item: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, minHeight: 40 },
  itemOff: { opacity: 0.55 },
  itemThumb: { width: 32, height: 32, objectFit: 'contain', flex: '0 0 auto' },
  price: { minHeight: 40, width: '100%', border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0 0.45rem', background: '#fff', color: '#111', colorScheme: 'light' },
  priceOff: { background: '#f3f4f6' },
  pauseOff: { minHeight: 40, minWidth: 72, borderRadius: 999, border: '1px solid var(--border, #ddd)', background: '#fff', color: '#111', fontWeight: 800, padding: '0 0.7rem' },
  pauseOn: { minHeight: 40, minWidth: 72, borderRadius: 999, border: '1px solid #b91c1c', background: '#fee2e2', color: '#991b1b', fontWeight: 800, padding: '0 0.7rem' },
  h2: { fontSize: '0.95rem', margin: '0.7rem 0 0.2rem' },
  muted: { color: 'var(--text-muted, #666)', fontSize: '0.75rem' },
  error: { color: '#b91c1c', fontWeight: 700 },
};
