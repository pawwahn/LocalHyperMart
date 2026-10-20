import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import type { TownVm } from '@/features/towns/api/townsApi';
import type { TownAdSlot } from '../api/adsApi';
import {
  AD_SLOT_ROWS,
  createAdInvoice,
  fetchAdOccupancy,
  monthBounds,
  money,
  quoteAdBill,
  updateAdInvoiceDates,
  type AdBillPeriod,
  type AdOccupancyBooking,
  type AdTownScope,
} from '../api/adsBillingApi';
import { AdsSlotCalendar, type AdRoom } from './AdsSlotCalendar';

type Props = {
  token: string;
  towns: TownVm[];
  townId: string;
  onTownChange?: (id: string) => void;
  refreshTick?: number;
  /** Closed until the operator opens it. Slots and Bills keep it open. */
  startOpen?: boolean;
  /** Issues a numbered bill for the selected room and dates. */
  canBook?: boolean;
  onPickStay?: (stay: {
    slot: TownAdSlot;
    slotIndex: number;
    from: string;
    booking: AdOccupancyBooking | null;
  }) => void;
  onBooked?: () => void;
  /** Disabled rooms (`SLOT:index`). The row is red and cannot be booked. */
  offRooms?: string[];
};

export function AdsDateBoard({
  token,
  towns,
  townId,
  onTownChange,
  refreshTick = 0,
  startOpen = true,
  canBook = true,
  onPickStay,
  onBooked,
  offRooms,
}: Props) {
  const now = new Date();
  const [open, setOpen] = useState(startOpen);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState<AdOccupancyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<AdRoom>(AD_SLOT_ROWS[0]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [allTowns, setAllTowns] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<AdOccupancyBooking | null>(null);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const held = bookings.length;

  useEffect(() => {
    if (!token || !open) return;
    let cancelled = false;
    setLoading(true);
    void fetchAdOccupancy(token, { from: bounds.from, to: bounds.to, townId: allTowns ? undefined : townId || undefined })
      .then((data) => {
        if (cancelled) return;
        setBookings(data.bookings);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load dates');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, open, bounds.from, bounds.to, townId, allTowns, refreshTick]);

  const editing = picked && picked.status !== 'VOID' ? picked : null;
  const quoteScope: AdTownScope = editing
    ? editing.townScope || (editing.allTowns ? 'ALL_TOWNS' : editing.towns.length > 1 ? 'MULTI_TOWN' : 'ONE_TOWN')
    : allTowns
      ? 'ALL_TOWNS'
      : 'ONE_TOWN';
  const quoteTownIds = editing
    ? editing.allTowns
      ? []
      : editing.towns.map((t) => t.id)
    : allTowns
      ? []
      : townId
        ? [townId]
        : [];
  const quotePeriod: AdBillPeriod = editing?.period || 'DAY';

  useEffect(() => {
    if ((!canBook && !editing) || !fromDate || !toDate || (!townId && !editing)) {
      setQuoteText('');
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void quoteAdBill(token, {
        slot: room.slot,
        slotIndex: room.slotIndex,
        period: quotePeriod,
        townScope: quoteScope,
        townIds: quoteTownIds,
        fromDate,
        toDate,
        ignoreInvoiceId: editing?.invoiceId,
      })
        .then((quote) => {
          if (cancelled) return;
          setQuoteText(
            quote.available
              ? `${quote.calendarDays} days · ${money(quote.total)}`
              : `Taken · ${quote.conflicts?.[0]?.advertiserName ?? 'another company'}`,
          );
        })
        .catch(() => {
          if (!cancelled) setQuoteText('');
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [canBook, editing, token, room, fromDate, toDate, townId, quotePeriod, quoteScope, quoteTownIds.join(',')]);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function clearPick() {
    setFromDate('');
    setToDate('');
    setQuoteText('');
    setPicked(null);
  }

  function openStay(booking: AdOccupancyBooking, pickedRoom: AdRoom) {
    const next = AD_SLOT_ROWS.find((r) => r.slot === pickedRoom.slot && r.slotIndex === pickedRoom.slotIndex) ?? pickedRoom;
    setRoom(next);
    setPicked(booking);
    setCompany(booking.advertiserName);
    setAllTowns(booking.allTowns);
    setFromDate(booking.fromDate);
    setToDate(booking.toDate);
    const start = new Date(`${booking.fromDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      setYear(start.getFullYear());
      setMonth(start.getMonth());
    }
    onPickStay?.({
      slot: next.slot,
      slotIndex: next.slotIndex,
      from: booking.fromDate,
      booking,
    });
  }

  function onCell(iso: string, booking: AdOccupancyBooking | null, pickedRoom: AdRoom) {
    setNotice(null);
    const sameStay = Boolean(editing && booking && booking.invoiceId === editing.invoiceId);
    const sameRoom = editing && pickedRoom.slot === room.slot && pickedRoom.slotIndex === room.slotIndex;
    if (booking && booking.status !== 'VOID' && !sameStay) {
      openStay(booking, pickedRoom);
      return;
    }
    if (sameRoom && (!booking || sameStay)) {
      setFromDate((prev) => {
        if (prev && iso >= prev) {
          setToDate(iso);
          return prev;
        }
        setToDate((till) => (till && iso <= till ? till : iso));
        return iso;
      });
      return;
    }
    if (offRooms?.includes(`${pickedRoom.slot}:${pickedRoom.slotIndex}`) && !booking) return;
    setRoom(pickedRoom);
    setPicked(null);
    setFromDate((prev) => {
      if (prev && iso >= prev && pickedRoom.slot === room.slot && pickedRoom.slotIndex === room.slotIndex) {
        setToDate(iso);
        return prev;
      }
      setToDate(iso);
      return iso;
    });
    onPickStay?.({
      slot: pickedRoom.slot,
      slotIndex: pickedRoom.slotIndex,
      from: iso,
      booking: null,
    });
  }

  async function blockDates() {
    if (!townId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const bill = await createAdInvoice(token, {
        advertiserName: company.trim(),
        advertiserPhone: phone,
        slot: room.slot,
        slotIndex: room.slotIndex,
        period: 'DAY',
        townScope: allTowns ? 'ALL_TOWNS' : 'ONE_TOWN',
        townIds: allTowns ? [] : [townId],
        fromDate,
        toDate,
        notes: `${room.label} stay`,
      });
      setNotice(`${bill.invoiceNumber} · ${room.label} · ${company.trim()} · ${money(bill.total)}`);
      setCompany('');
      setFromDate('');
      setToDate('');
      setQuoteText('');
      onBooked?.();
      const data = await fetchAdOccupancy(token, {
        from: bounds.from,
        to: bounds.to,
        townId: allTowns ? undefined : townId,
      });
      setBookings(data.bookings);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not block these dates');
    } finally {
      setBusy(false);
    }
  }

  async function saveDates() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const bill = await updateAdInvoiceDates(token, editing.invoiceId, { fromDate, toDate });
      setNotice(`${bill.invoiceNumber} · ${editing.advertiserName} · ${fromDate} – ${toDate} · ${money(bill.total)}`);
      clearPick();
      onBooked?.();
      const data = await fetchAdOccupancy(token, {
        from: bounds.from,
        to: bounds.to,
        townId: allTowns ? undefined : townId,
      });
      setBookings(data.bookings);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update these dates');
    } finally {
      setBusy(false);
    }
  }

  const roomOff = offRooms?.includes(`${room.slot}:${room.slotIndex}`) ?? false;
  const datesMoved = Boolean(editing && (fromDate !== editing.fromDate || toDate !== editing.toDate));
  const quoteBlocked = quoteText.startsWith('Taken');
  const ready =
    !roomOff && company.trim().length >= 2 && phone.length >= 10 && Boolean(fromDate && toDate && townId);
  const canUpdate = Boolean(editing && datesMoved && fromDate && toDate && !quoteBlocked);

  return (
    <Card padding="sm" style={styles.card}>
      <button type="button" style={styles.headBtn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span style={styles.caret}>{open ? '▾' : '▸'}</span>
        <strong style={styles.title}>Date board</strong>
        <span style={styles.hint}>
          {held || loading ? `${loading && !held ? '…' : held} stays` : 'Main, Mid 1–5, Cat 1–4'} · one company per room per day
        </span>
      </button>
      {open ? (
        <div style={styles.body}>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          <div style={styles.toolbar}>
            <label style={styles.field}>
              Town
              <select
                style={styles.input}
                value={townId}
                onChange={(e) => onTownChange?.(e.target.value)}
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
            highlightFrom={fromDate}
            highlightTo={toDate}
            highlightSlot={fromDate ? room.slot : undefined}
            highlightIndex={fromDate ? room.slotIndex : undefined}
            blockedRooms={offRooms}
            editingInvoiceId={editing?.invoiceId}
            onPickDate={onCell}
            onClearPick={clearPick}
          />
          {editing ? (
            <p style={styles.note}>
              {editing.slotLabel} · {editing.advertiserName} · {editing.invoiceNumber}. Click a later day on this row, or change From and Till. Update dates keeps this bill.
            </p>
          ) : (
            <p style={styles.note}>
              Click one room, then a later day on that same row. Click a booked company to change its dates. Double-click the blue block to clear it.
            </p>
          )}
          {editing ? (
            <div style={styles.book}>
              <label style={styles.field}>
                From
                <input style={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label style={styles.field}>
                Till
                <input
                  style={styles.input}
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
              <Button disabled={!canUpdate || busy} onClick={() => void saveDates()}>
                {busy ? 'Saving…' : quoteText ? `Update dates · ${quoteText}` : 'Update dates'}
              </Button>
            </div>
          ) : null}
          {canBook && !editing ? (
            <div style={styles.book}>
              <label style={styles.field}>
                Room
                <select
                  style={styles.input}
                  value={`${room.slot}:${room.slotIndex}`}
                  onChange={(e) => {
                    const next = AD_SLOT_ROWS.find((r) => `${r.slot}:${r.slotIndex}` === e.target.value);
                    if (next) setRoom(next);
                  }}
                >
                  {AD_SLOT_ROWS.map((r) => {
                    const off = offRooms?.includes(`${r.slot}:${r.slotIndex}`);
                    return (
                      <option key={`${r.slot}:${r.slotIndex}`} value={`${r.slot}:${r.slotIndex}`} disabled={off}>
                        {off ? `${r.label} · disabled` : r.label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label style={styles.field}>
                Company
                <input style={styles.input} value={company} maxLength={160} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label style={styles.field}>
                Phone
                <input
                  style={styles.input}
                  inputMode="numeric"
                  value={phone}
                  maxLength={12}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
                />
              </label>
              <label style={styles.field}>
                From
                <input style={styles.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label style={styles.field}>
                Till
                <input
                  style={styles.input}
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
              <label style={styles.check}>
                <input type="checkbox" checked={allTowns} onChange={(e) => setAllTowns(e.target.checked)} />
                All towns
              </label>
              <Button disabled={!ready || busy} onClick={() => void blockDates()}>
                {busy ? 'Blocking…' : quoteText ? `Block dates · ${quoteText}` : 'Block dates'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.4rem' },
  headBtn: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    flexWrap: 'wrap',
    width: '100%',
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  caret: { width: '0.7rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' },
  title: { fontSize: '0.92rem' },
  hint: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  body: { display: 'grid', gap: '0.4rem' },
  toolbar: { display: 'flex', justifyContent: 'space-between', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'end' },
  field: { display: 'grid', gap: '0.15rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', minWidth: 0 },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.32rem 0.45rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    minWidth: 0,
  },
  monthNav: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  month: { fontSize: '0.82rem', minWidth: 128, textAlign: 'center' },
  note: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  book: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    minHeight: 36,
  },
};
