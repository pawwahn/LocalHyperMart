import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { APP_NAME } from '@hlm-brand';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { ApiError } from '@/shared/api/http';
import { Toast } from '@/shared/ui';
import { LaundryRequests } from '../components/LaundryRequests';
import {
  LAUNDRY_ITEMS,
  LAUNDRY_SERVICES,
  WEEKDAYS,
  fetchMyLaundry,
  saveLaundryOps,
  saveLaundryRates,
  type LaundryProfile,
  type LaundryRate,
} from '../api/laundryApi';

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

function rateAt(rates: LaundryRate[], service: string, item: string): string {
  const found = rates.find((rate) => rate.serviceType === service && rate.itemType === item);
  return found ? String(found.unitPrice) : '';
}

function itemPaused(rates: LaundryRate[], item: string): boolean {
  return rates.some((rate) => rate.itemType === item && rate.paused);
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
        const nextPaused: Record<string, boolean> = {};
        const shopRates = shop.rates ?? [];
        for (const item of LAUNDRY_ITEMS) {
          nextPaused[item.id] = itemPaused(shopRates, item.id);
          for (const service of LAUNDRY_SERVICES) next[`${service.id}|${item.id}`] = rateAt(shopRates, service.id, item.id);
        }
        setRates(next);
        setPaused(nextPaused);
        setCapacity(shop.dailyPieceCapacity ? String(shop.dailyPieceCapacity) : '');
        setPickupCharge(shop.pickupCharge ? String(shop.pickupCharge) : '');
        setDropCharge(shop.dropCharge ? String(shop.dropCharge) : '');
        setBothCharge(shop.pickupAndDropCharge ? String(shop.pickupAndDropCharge) : '');
        setOpenDays(openDaysFromStored(shop.closedWeekdays));
      })
      .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load laundry'))
      .finally(() => setLoading(false));
  }, [token]);

  function ratePayload(nextPaused = paused): LaundryRate[] {
    return Object.entries(rates)
      .filter(([, price]) => price !== '')
      .map(([key, price]) => {
        const [serviceType, itemType] = key.split('|');
        return { serviceType, itemType, unitPrice: Number(price), paused: Boolean(nextPaused[itemType]) };
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
      setPaused((prev) => {
        const fromShop: Record<string, boolean> = { ...prev };
        for (const item of LAUNDRY_ITEMS) fromShop[item.id] = itemPaused(saved.rates ?? [], item.id);
        return fromShop;
      });
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

  async function togglePause(itemId: string) {
    const previous = paused;
    const next = { ...paused, [itemId]: !paused[itemId] };
    setPaused(next);
    const ok = await persistRates(next, next[itemId] ? 'Paused for customers' : 'Visible to customers');
    if (!ok) setPaused(previous);
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
      <LaundryRequests />
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
      <p style={styles.muted}>
        {profile.priceEditAllowed ? 'You can edit prices.' : 'Prices are locked by super admin.'} Pause hides a piece from customers. Green days are open.
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
        {LAUNDRY_SERVICES.map((service) => <strong key={service.id} style={styles.colHead}>{service.label}</strong>)}
        <strong style={styles.colHead}>Customers</strong>
        {LAUNDRY_ITEMS.map((item) => {
          const off = Boolean(paused[item.id]);
          const hasPrice = LAUNDRY_SERVICES.some((service) => (rates[`${service.id}|${item.id}`] ?? '') !== '');
          return (
            <Fragment key={item.id}>
              <span style={{ ...styles.item, ...(off ? styles.itemOff : null) }}>
                {item.image ? <img src={item.image} alt="" style={styles.itemThumb} /> : null}
                {item.label}
              </span>
              {LAUNDRY_SERVICES.map((service) => {
                const key = `${service.id}|${item.id}`;
                return (
                  <input
                    key={key}
                    style={{ ...styles.price, ...(off ? styles.priceOff : null) }}
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
                disabled={!hasPrice}
                aria-pressed={off}
                onClick={() => void togglePause(item.id)}
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
    gridTemplateColumns: 'minmax(8.6rem, 11rem) repeat(3, minmax(4.8rem, 6.2rem)) auto',
    gap: '0.28rem 0.4rem',
    alignItems: 'center',
    maxWidth: 720,
    margin: '0.35rem 0',
  },
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
