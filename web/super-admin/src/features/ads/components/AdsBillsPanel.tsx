import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import type { TownVm } from '@/features/towns/api/townsApi';
import { formatIsoDateRange } from '@/shared/dates/formatDateRange';
import type { TownAdSlot } from '../api/adsApi';
import {
  AD_PAY_METHODS,
  adInvoiceHtml,
  bookingPhaseLabel,
  createAdInvoice,
  fetchAdOccupancy,
  listAdInvoices,
  money,
  monthBounds,
  payAdInvoice,
  periodLabel,
  printAdInvoice,
  quoteAdBill,
  statusLabel,
  voidAdInvoice,
  type AdBillPeriod,
  type AdInvoice,
  type AdInvoiceStatus,
  type AdOccupancyBooking,
  type AdQuote,
  type AdTownScope,
} from '../api/adsBillingApi';
import { AdsSlotCalendar } from './AdsSlotCalendar';

type Props = {
  token: string;
  towns: TownVm[];
  slotActive?: { homeHero?: boolean; homeMidGrid?: boolean; cartUpsell?: boolean };
  onChanged?: () => void;
};

const PAGE_SIZE = 25;

function isoToday(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdsBillsPanel({ token, towns, slotActive, onChanged }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [slot, setSlot] = useState<TownAdSlot>('HOME_HERO');
  const [slotIndex, setSlotIndex] = useState(1);
  const [period, setPeriod] = useState<AdBillPeriod>('DAY');
  const [scope, setScope] = useState<AdTownScope>('ONE_TOWN');
  const [townIds, setTownIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(isoToday);
  const [toDate, setToDate] = useState(isoToday);
  const [townQuery, setTownQuery] = useState('');

  const [quote, setQuote] = useState<AdQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const [status, setStatus] = useState<AdInvoiceStatus | ''>('');
  const [slotFilter, setSlotFilter] = useState<TownAdSlot | ''>('');
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [payRow, setPayRow] = useState<AdInvoice | null>(null);
  const [payMethod, setPayMethod] = useState<string>('UPI');
  const [payRef, setPayRef] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [voidRow, setVoidRow] = useState<AdInvoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [viewRow, setViewRow] = useState<AdInvoice | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [slotBookings, setSlotBookings] = useState<AdOccupancyBooking[]>([]);
  const [pickedBooking, setPickedBooking] = useState<AdOccupancyBooking | null>(null);
  const [occTick, setOccTick] = useState(0);

  const enabledTowns = useMemo(() => towns.filter((t) => t.status === 'ENABLED'), [towns]);
  const townChoices = useMemo(() => {
    const needle = townQuery.trim().toLowerCase();
    return towns
      .filter(
        (t) =>
          !needle ||
          t.displayName.toLowerCase().includes(needle) ||
          t.townCode.toLowerCase().includes(needle),
      )
      .slice(0, 80);
  }, [towns, townQuery]);

  useEffect(() => {
    if (towns.length && townIds.length === 0) setTownIds([towns[0].id]);
  }, [towns, townIds.length]);

  useEffect(() => {
    if (!slotActive) return;
    const currentOn =
      (slot === 'HOME_HERO' && slotActive.homeHero !== false) ||
      (slot === 'HOME_MID_GRID' && slotActive.homeMidGrid !== false) ||
      (slot === 'CART_UPSELL' && slotActive.cartUpsell !== false);
    if (currentOn) return;
    if (slotActive.homeHero !== false) setSlot('HOME_HERO');
    else if (slotActive.homeMidGrid !== false) setSlot('HOME_MID_GRID');
    else if (slotActive.cartUpsell !== false) setSlot('CART_UPSELL');
  }, [slot, slotActive]);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qDraft.trim()), 280);
    return () => window.clearTimeout(t);
  }, [qDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdInvoices(token, {
        status,
        slot: slotFilter,
        q,
        page,
        size: PAGE_SIZE,
      });
      setRows(data.items);
      setTotal(data.totalElements);
      setTotalPages(Math.max(data.totalPages, 1));
      setError(null);
      setOccTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load bills');
    } finally {
      setLoading(false);
    }
  }, [token, status, slotFilter, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const quoteBody = useMemo(
    () => ({
      slot,
      slotIndex: slot === 'HOME_MID_GRID' ? slotIndex : 0,
      period,
      townScope: scope,
      townIds: scope === 'ALL_TOWNS' ? [] : townIds,
      fromDate,
      toDate,
    }),
    [slot, slotIndex, period, scope, townIds, fromDate, toDate],
  );

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setQuoting(true);
      void quoteAdBill(token, quoteBody)
        .then((data) => {
          if (cancelled) return;
          setQuote(data);
          setQuoteError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not quote');
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [token, quoteBody]);

  const calBounds = useMemo(() => monthBounds(calYear, calMonth), [calYear, calMonth]);
  const occupancyTownId = scope === 'ONE_TOWN' ? townIds[0] : undefined;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchAdOccupancy(token, {
      from: calBounds.from,
      to: calBounds.to,
      slot,
      townId: occupancyTownId,
    })
      .then((data) => {
        if (cancelled) return;
        const rows = data.bookings.filter((b) => b.slotIndex === (slot === 'HOME_MID_GRID' ? slotIndex : 0));
        setSlotBookings(
          scope === 'MULTI_TOWN'
            ? rows.filter(
                (b) => b.allTowns || b.towns?.some((t) => townIds.includes(t.id)),
              )
            : rows,
        );
      })
      .catch(() => {
        if (!cancelled) setSlotBookings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, calBounds.from, calBounds.to, slot, slotIndex, occupancyTownId, scope, townIds, occTick]);

  function toggleTown(id: string) {
    setTownIds((prev) => {
      if (scope === 'ONE_TOWN') return [id];
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return [...next];
    });
  }

  async function onIssue() {
    if (issuing) return;
    setIssuing(true);
    setError(null);
    setOk(null);
    try {
      const created = await createAdInvoice(token, {
        ...quoteBody,
        advertiserName: name.trim(),
        advertiserPhone: phone.trim(),
        advertiserGstin: gstin.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setOk(`${created.invoiceNumber} issued · ${money(created.total)} unpaid`);
      setName('');
      setPhone('');
      setGstin('');
      setNotes('');
      setPage(0);
      await load();
      onChanged?.();
      setViewRow(created);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not issue bill');
    } finally {
      setIssuing(false);
    }
  }

  async function onPay() {
    if (!payRow) return;
    setPayBusy(true);
    try {
      const paid = await payAdInvoice(token, payRow.id, { method: payMethod, reference: payRef.trim() });
      setOk(`${paid.invoiceNumber} marked paid · ${paid.paidMethod} · ${paid.paidReference}`);
      setPayRow(null);
      setPayRef('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Pay failed');
    } finally {
      setPayBusy(false);
    }
  }

  async function onVoid() {
    if (!voidRow) return;
    setVoidBusy(true);
    try {
      const voided = await voidAdInvoice(token, voidRow.id, voidReason.trim());
      setOk(`${voided.invoiceNumber} voided`);
      setVoidRow(null);
      setVoidReason('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Void failed');
    } finally {
      setVoidBusy(false);
    }
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const selectedTowns = towns.filter((t) => townIds.includes(t.id));
  const canIssue =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, '').length >= 10 &&
    Boolean(quote) &&
    !(quote?.conflicts?.length) &&
    !quoteError &&
    !issuing;

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {ok ? <Banner tone="success">{ok}</Banner> : null}

      <Card padding="sm" style={styles.card}>
        <h2 style={styles.h2}>New bill</h2>
        <div style={styles.row}>
          <label style={styles.field}>
            Advertiser
            <input style={styles.input} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={styles.field}>
            Phone
            <input
              style={styles.input}
              inputMode="numeric"
              value={phone}
              maxLength={13}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
            />
          </label>
          <label style={styles.field}>
            GSTIN
            <input
              style={styles.input}
              value={gstin}
              maxLength={15}
              placeholder="Optional"
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />
          </label>
        </div>
        <div style={styles.row}>
          <label style={styles.field}>
            Placement
            <select
              style={styles.input}
              value={slot}
              onChange={(e) => setSlot(e.target.value as TownAdSlot)}
            >
              <option value="HOME_HERO" disabled={slotActive?.homeHero === false}>
                Main ad (home strip){slotActive?.homeHero === false ? ' · hidden' : ''}
              </option>
              <option value="HOME_MID_GRID" disabled={slotActive?.homeMidGrid === false}>
                Mid-grid ad{slotActive?.homeMidGrid === false ? ' · hidden' : ''}
              </option>
              <option value="CART_UPSELL" disabled={slotActive?.cartUpsell === false}>
                Cart ad{slotActive?.cartUpsell === false ? ' · hidden' : ''}
              </option>
            </select>
          </label>
          {slot === 'HOME_MID_GRID' ? (
            <label style={styles.field}>
              Slide
              <select
                style={styles.input}
                value={slotIndex}
                onChange={(e) => setSlotIndex(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    Slide {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={styles.field}>
            Price as
            <select style={styles.input} value={period} onChange={(e) => setPeriod(e.target.value as AdBillPeriod)}>
              <option value="DAY">Per day</option>
              <option value="WEEK">Per week</option>
              <option value="MONTH">Per month</option>
              <option value="YEAR">Per year</option>
            </select>
          </label>
          <label style={styles.field}>
            Towns
            <select
              style={styles.input}
              value={scope}
              onChange={(e) => {
                const next = e.target.value as AdTownScope;
                setScope(next);
                if (next === 'ONE_TOWN' && townIds.length > 1) setTownIds(townIds.slice(0, 1));
              }}
            >
              <option value="ONE_TOWN">One town</option>
              <option value="MULTI_TOWN">Multiple towns</option>
              <option value="ALL_TOWNS">All towns</option>
            </select>
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
        </div>
        <div style={styles.quick}>
          <button type="button" style={styles.link} onClick={() => setToDate(fromDate)}>
            Same day
          </button>
          <button type="button" style={styles.link} onClick={() => setToDate(addDays(fromDate, 6))}>
            7 days
          </button>
          <button type="button" style={styles.link} onClick={() => setToDate(addDays(fromDate, 29))}>
            30 days
          </button>
          <button type="button" style={styles.link} onClick={() => setToDate(addDays(fromDate, 364))}>
            1 year
          </button>
        </div>
        <div style={styles.slotBoard}>
          <div style={styles.slotBoardHead}>
            <strong style={styles.slotBoardTitle}>Slot calendar</strong>
            <div style={styles.monthNav}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(calYear, calMonth - 1, 1);
                  setCalYear(d.getFullYear());
                  setCalMonth(d.getMonth());
                }}
              >
                Prev
              </Button>
              <span style={styles.monthLabel}>
                {new Date(calYear, calMonth, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(calYear, calMonth + 1, 1);
                  setCalYear(d.getFullYear());
                  setCalMonth(d.getMonth());
                }}
              >
                Next
              </Button>
            </div>
          </div>
          <AdsSlotCalendar
            year={calYear}
            month={calMonth}
            bookings={slotBookings}
            highlightFrom={fromDate}
            highlightTo={toDate}
            slot={slot}
            slotIndex={slot === 'HOME_MID_GRID' ? slotIndex : 0}
            onPickDate={(iso, booking) => {
              setPickedBooking(booking);
              if (!booking) {
                setFromDate(iso);
                if (iso > toDate) setToDate(iso);
              }
            }}
          />
          {pickedBooking ? (
            <Banner tone="warning" style={{ padding: '0.4rem 0.55rem' }}>
              {formatIsoDateRange(pickedBooking.fromDate, pickedBooking.toDate)} already held by{' '}
              {pickedBooking.advertiserName} (
              {pickedBooking.invoiceNumber}, {bookingPhaseLabel(pickedBooking.bookingPhase)}). Choose a green day or
              use the next free window.
            </Banner>
          ) : (
            <p style={styles.muted}>Green = free (including future). Click a green day to start the booking there.</p>
          )}
        </div>
        {scope !== 'ALL_TOWNS' ? (
          <div style={styles.townBox}>
            <div style={styles.townHead}>
              <input
                style={styles.townSearch}
                value={townQuery}
                placeholder="Search towns…"
                onChange={(e) => setTownQuery(e.target.value)}
              />
              <span style={styles.muted}>
                {scope === 'ONE_TOWN' ? 'Pick 1' : `Pick 2+ · ${townIds.length} selected`}
              </span>
            </div>
            {selectedTowns.length ? (
              <div style={styles.chips}>
                {selectedTowns.map((t) => (
                  <button key={t.id} type="button" style={styles.chip} onClick={() => toggleTown(t.id)}>
                    {t.displayName} ×
                  </button>
                ))}
              </div>
            ) : null}
            <div style={styles.townList}>
              {townChoices.map((t) => (
                <label key={t.id} style={styles.townRow}>
                  <input
                    type={scope === 'ONE_TOWN' ? 'radio' : 'checkbox'}
                    name="ad-bill-town"
                    checked={townIds.includes(t.id)}
                    onChange={() => toggleTown(t.id)}
                  />
                  <span>
                    {t.displayName}
                    {t.status !== 'ENABLED' ? ' · paused' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p style={styles.muted}>
            Flat all-towns rate covers {enabledTowns.length || towns.length} enabled town
            {(enabledTowns.length || towns.length) === 1 ? '' : 's'}.
          </p>
        )}
        <label style={styles.field}>
          Notes
          <input
            style={styles.input}
            value={notes}
            maxLength={500}
            placeholder="Optional"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div style={styles.quote}>
          {quoting && !quote ? <span>Quoting…</span> : null}
          {quoteError ? <span style={{ color: 'var(--danger)' }}>{quoteError}</span> : null}
          {quote ? (
            <>
              <strong>
                {money(quote.total)}
                {quote.taxAmount > 0 ? ` incl. GST` : ''}
              </strong>
              <span style={styles.muted}>{quote.breakdown}</span>
              {quote.conflicts?.length ? (
                <Banner tone="danger" style={{ padding: '0.45rem 0.65rem', flex: '1 1 100%' }}>
                  Slot taken
                  {quote.conflicts.map((c) => (
                    <span key={c.invoiceId}>
                      {' '}
                      · {c.invoiceNumber} {c.advertiserName} {fmtDate(c.fromDate)} → {fmtDate(c.toDate)} (
                      {bookingPhaseLabel(c.bookingPhase)})
                    </span>
                  ))}
                  {quote.nextFreeFrom && quote.nextFreeTo ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        style={styles.link}
                        onClick={() => {
                          setFromDate(quote.nextFreeFrom!);
                          setToDate(quote.nextFreeTo!);
                          const d = new Date(`${quote.nextFreeFrom}T00:00:00`);
                          setCalYear(d.getFullYear());
                          setCalMonth(d.getMonth());
                          setPickedBooking(null);
                        }}
                      >
                        Use next free {fmtDate(quote.nextFreeFrom)}–{fmtDate(quote.nextFreeTo)}
                      </button>
                    </>
                  ) : null}
                </Banner>
              ) : fromDate > isoToday() ? (
                <Banner tone="info" style={{ padding: '0.45rem 0.65rem', flex: '1 1 100%' }}>
                  Pre-order — slot is held from {fmtDate(fromDate)} to {fmtDate(toDate)}. Creative can go live on that
                  start date.
                </Banner>
              ) : null}
            </>
          ) : null}
          <Button disabled={!canIssue} onClick={() => void onIssue()}>
            {issuing ? 'Issuing…' : fromDate > isoToday() ? 'Pre-order bill & invoice' : 'Issue bill & invoice'}
          </Button>
        </div>
      </Card>

      <Card padding="sm" style={styles.card}>
        <div style={styles.listHead}>
          <h2 style={styles.h2}>
            Bills <span style={styles.count}>{loading ? '…' : total.toLocaleString('en-IN')}</span>
          </h2>
          <div style={styles.filters}>
            <input
              style={styles.filterInput}
              value={qDraft}
              placeholder="Search invoice, advertiser, phone, UTR…"
              onChange={(e) => {
                setQDraft(e.target.value);
                setPage(0);
              }}
            />
            <select
              style={styles.filterInput}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AdInvoiceStatus | '');
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              <option value="ISSUED">Unpaid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
            <select
              style={styles.filterInput}
              value={slotFilter}
              onChange={(e) => {
                setSlotFilter(e.target.value as TownAdSlot | '');
                setPage(0);
              }}
            >
              <option value="">All placements</option>
              <option value="HOME_HERO">Main ad</option>
              <option value="HOME_MID_GRID">Mid-grid</option>
              <option value="CART_UPSELL">Cart ad</option>
            </select>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Advertiser</th>
                <th style={styles.th}>Placement</th>
                <th style={styles.th}>Towns</th>
                <th style={styles.th}>Run</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} style={styles.empty}>
                    No bills yet
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>
                    <button type="button" style={styles.invBtn} onClick={() => setViewRow(row)}>
                      {row.invoiceNumber}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <div>{row.advertiserName}</div>
                    <div style={styles.muted}>{row.advertiserPhone}</div>
                  </td>
                  <td style={styles.td}>
                    {row.slotLabel}
                    <div style={styles.muted}>{periodLabel(row.period)}</div>
                  </td>
                  <td style={styles.td}>
                    {row.allTowns ? 'All towns' : row.towns?.map((t) => t.name).join(', ') || '—'}
                  </td>
                  <td style={styles.td}>
                    {fmtDate(row.fromDate)} → {fmtDate(row.toDate)}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>{money(row.total)}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(row.status === 'PAID'
                          ? styles.badgePaid
                          : row.status === 'VOID'
                            ? styles.badgeVoid
                            : styles.badgeUnpaid),
                      }}
                    >
                      {statusLabel(row.status)}
                    </span>
                    {row.status !== 'VOID' ? (
                      <span
                        style={{
                          ...styles.badge,
                          marginLeft: 4,
                          ...(row.bookingPhase === 'PREORDER'
                            ? styles.badgePre
                            : row.bookingPhase === 'ENDED'
                              ? styles.badgeEnded
                              : styles.badgeLive),
                        }}
                      >
                        {bookingPhaseLabel(row.bookingPhase)}
                      </span>
                    ) : null}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <Button size="sm" variant="ghost" onClick={() => setViewRow(row)}>
                        Invoice
                      </Button>
                      {row.status === 'ISSUED' ? (
                        <>
                          <Button size="sm" onClick={() => setPayRow(row)}>
                            Pay
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setVoidRow(row)}>
                            Void
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={styles.pager}>
          <span style={styles.muted}>
            {loading ? '…' : `${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}
          </span>
          {totalPages > 1 ? (
            <div style={styles.actions}>
              <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => setPage(0)}>
                First
              </Button>
              <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage(totalPages - 1)}
              >
                Last
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {viewRow
        ? createPortal(
            <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setViewRow(null)}>
              <div style={styles.invoiceDialog} role="dialog" aria-modal="true" aria-labelledby="ad-invoice-title">
                <div style={styles.invoiceBar}>
                  <h2 id="ad-invoice-title" style={styles.h2}>
                    {viewRow.invoiceNumber}
                  </h2>
                  <div style={styles.actions}>
                    <Button variant="ghost" onClick={() => setViewRow(null)}>
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        const frame = document.getElementById('ad-invoice-frame') as HTMLIFrameElement | null;
                        if (frame?.contentWindow) {
                          frame.contentWindow.focus();
                          frame.contentWindow.print();
                          return;
                        }
                        printAdInvoice(viewRow);
                      }}
                    >
                      Print / Save PDF
                    </Button>
                  </div>
                </div>
                <iframe
                  id="ad-invoice-frame"
                  title={viewRow.invoiceNumber}
                  srcDoc={adInvoiceHtml(viewRow)}
                  style={styles.invoiceFrame}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      {payRow
        ? createPortal(
            <div style={styles.overlay} onMouseDown={(e) => !payBusy && e.target === e.currentTarget && setPayRow(null)}>
              <div style={styles.dialog} role="dialog" aria-modal="true">
                <h2 style={styles.h2}>Mark {payRow.invoiceNumber} paid</h2>
                <p style={styles.muted}>
                  {payRow.advertiserName} · {money(payRow.total)}
                </p>
                <div style={styles.row}>
                  <label style={styles.field}>
                    Method
                    <select style={styles.input} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {AD_PAY_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...styles.field, flex: 1 }}>
                    Txn ref
                    <input
                      style={styles.input}
                      value={payRef}
                      placeholder="UTR / UPI / cheque"
                      onChange={(e) => setPayRef(e.target.value)}
                    />
                  </label>
                </div>
                <div style={styles.actions}>
                  <Button variant="ghost" disabled={payBusy} onClick={() => setPayRow(null)}>
                    Cancel
                  </Button>
                  <Button disabled={payBusy || payRef.trim().length < 3} onClick={() => void onPay()}>
                    {payBusy ? 'Saving…' : 'Mark paid'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {voidRow
        ? createPortal(
            <div
              style={styles.overlay}
              onMouseDown={(e) => !voidBusy && e.target === e.currentTarget && setVoidRow(null)}
            >
              <div style={styles.dialog} role="dialog" aria-modal="true">
                <h2 style={styles.h2}>Void {voidRow.invoiceNumber}?</h2>
                <p style={styles.muted}>
                  Unpaid bills only. The slot dates become free again. Paid invoices cannot be voided.
                </p>
                <label style={styles.field}>
                  Reason
                  <input
                    style={styles.input}
                    value={voidReason}
                    placeholder="Why is this bill cancelled?"
                    onChange={(e) => setVoidReason(e.target.value)}
                  />
                </label>
                <div style={styles.actions}>
                  <Button
                    variant="ghost"
                    disabled={voidBusy}
                    onClick={() => {
                      setVoidRow(null);
                      setVoidReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    disabled={voidBusy || voidReason.trim().length < 3}
                    onClick={() => void onVoid()}
                  >
                    {voidBusy ? 'Voiding…' : 'Void bill'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.65rem' },
  card: { display: 'grid', gap: '0.5rem' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
  count: { color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 },
  row: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'end' },
  field: {
    display: 'grid',
    gap: '0.18rem',
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    minWidth: 120,
    flex: '1 1 140px',
  },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.42rem 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    minWidth: 0,
  },
  quick: { display: 'flex', gap: '0.55rem', flexWrap: 'wrap' },
  slotBoard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem',
    display: 'grid',
    gap: '0.35rem',
  },
  slotBoardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  slotBoardTitle: { fontSize: '0.78rem', fontWeight: 800 },
  monthNav: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  monthLabel: { fontSize: '0.78rem', fontWeight: 800, minWidth: 88, textAlign: 'center' },
  link: {
    border: 'none',
    background: 'none',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: 0,
  },
  townBox: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem',
    display: 'grid',
    gap: '0.35rem',
  },
  townHead: { display: 'flex', gap: '0.45rem', alignItems: 'center' },
  townSearch: {
    flex: 1,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.12rem 0.45rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  townList: { maxHeight: 140, overflow: 'auto', display: 'grid', gap: '0.1rem' },
  townRow: { display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 },
  quote: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.55rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid var(--border)',
    paddingTop: '0.45rem',
  },
  muted: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 },
  listHead: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' },
  filters: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  filterInput: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.38rem 0.5rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 650,
    minWidth: 140,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 860 },
  th: {
    textAlign: 'left',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    padding: '0.3rem 0.35rem',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', verticalAlign: 'top' },
  empty: { padding: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' },
  invBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  },
  badge: { fontSize: '0.68rem', fontWeight: 800, padding: '0.12rem 0.4rem', borderRadius: 999 },
  badgePaid: { background: 'var(--success-soft)', color: '#047857' },
  badgeUnpaid: { background: 'var(--warning-soft)', color: '#92400e' },
  badgeLive: { background: 'var(--success-soft)', color: '#047857' },
  badgePre: { background: 'var(--warning-soft)', color: '#92400e' },
  badgeEnded: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  badgeVoid: { background: 'var(--danger-soft)', color: '#b91c1c' },
  actions: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(15,23,20,0.45)',
    padding: '1rem',
  },
  dialog: {
    width: 'min(32rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    display: 'grid',
    gap: '0.55rem',
  },
  invoiceDialog: {
    width: 'min(52rem, 100%)',
    height: 'min(46rem, 92vh)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.7rem 0.7rem 0.55rem',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: '0.45rem',
  },
  invoiceBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  invoiceFrame: {
    width: '100%',
    height: '100%',
    minHeight: 0,
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: '#fff',
  },
};
