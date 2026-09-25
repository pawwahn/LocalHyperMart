import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import type { TownVm } from '@/features/towns/api/townsApi';
import {
  bookingPhaseLabel,
  fetchAdOccupancy,
  monthBounds,
  statusLabel,
  type AdOccupancyBooking,
} from '../api/adsBillingApi';
import { AdsSlotCalendar } from './AdsSlotCalendar';

type Props = {
  token: string;
  towns: TownVm[];
  townId: string;
  onTownChange?: (id: string) => void;
  refreshTick?: number;
};

export function AdsSlotsPanel({ token, towns, townId, onTownChange, refreshTick = 0 }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState<AdOccupancyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<AdOccupancyBooking | null>(null);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!token || !townId) return;
    let cancelled = false;
    setLoading(true);
    void fetchAdOccupancy(token, { from: bounds.from, to: bounds.to, townId })
      .then((data) => {
        if (cancelled) return;
        setBookings(data.bookings);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load slots');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, bounds.from, bounds.to, refreshTick]);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setPicked(null);
  }

  const live = bookings.filter((b) => b.bookingPhase === 'LIVE').length;
  const pre = bookings.filter((b) => b.bookingPhase === 'PREORDER').length;

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card padding="sm" style={styles.card}>
        <div style={styles.head}>
          <div>
            <h2 style={styles.h2}>Slot board</h2>
            <p style={styles.hint}>
              One advertiser per slot per town per day. Red = live, yellow = future pre-order. Click a day to see who
              holds it.
            </p>
          </div>
          <div style={styles.stats}>
            <span style={styles.stat}>{loading ? '…' : live} live</span>
            <span style={styles.stat}>{loading ? '…' : pre} pre-order</span>
          </div>
        </div>
        <div style={styles.toolbar}>
          <label style={styles.field}>
            Town
            <select
              style={styles.input}
              value={townId}
              onChange={(e) => {
                onTownChange?.(e.target.value);
                setPicked(null);
              }}
            >
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <div style={styles.monthNav}>
            <Button size="sm" variant="ghost" onClick={() => shift(-1)}>
              Prev
            </Button>
            <strong style={styles.month}>{monthLabel}</strong>
            <Button size="sm" variant="ghost" onClick={() => shift(1)}>
              Next
            </Button>
          </div>
        </div>
        <AdsSlotCalendar
          year={year}
          month={month}
          bookings={bookings}
          onPickDate={(_iso, booking) => setPicked(booking)}
        />
        {picked ? (
          <div style={styles.detail}>
            <strong>{picked.slotLabel}</strong> · {picked.invoiceNumber} · {picked.advertiserName}
            <span style={styles.muted}>
              {picked.fromDate} – {picked.toDate} · {bookingPhaseLabel(picked.bookingPhase)} · {statusLabel(picked.status)}
              {picked.allTowns ? ' · all towns' : picked.towns?.length ? ` · ${picked.towns.map((t) => t.name).join(', ')}` : ''}
            </span>
          </div>
        ) : (
          <p style={styles.muted}>Green days are free to sell, including future pre-orders.</p>
        )}
      </Card>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  card: { display: 'grid', gap: '0.5rem' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
  hint: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: 560, lineHeight: 1.35 },
  stats: { display: 'flex', gap: '0.4rem' },
  stat: {
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: 'var(--bg-muted)',
  },
  toolbar: { display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between' },
  field: { display: 'grid', gap: '0.18rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.4rem 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    minWidth: 180,
  },
  monthNav: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  month: { fontSize: '0.88rem', minWidth: 140, textAlign: 'center' },
  detail: { display: 'grid', gap: '0.1rem', fontSize: '0.82rem', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, margin: 0 },
};
