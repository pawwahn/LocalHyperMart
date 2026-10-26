import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Toast } from '@/shared/ui';
import {
  getTownConfig,
  listTowns,
  saveTownBeautyPaymentRules,
  setTownBeautyEnabled,
  type TownVm,
} from '@/features/towns/api/townsApi';
import {
  BEAUTY_SERVICES,
  buildBeautySlots,
  fetchAdminBeautyOrders,
  fetchTownBeautyArtists,
  parseBlockedBeautySlotIds,
  scheduleFromArtist,
  saveTownBeautyArtist,
  slugCustomTreatmentCode,
  type BeautyAdminOrder,
  type BeautyArtist,
} from '../api/beautyApi';

type CustomTreatmentRow = {
  key: string;
  code: string;
  label: string;
  price: string;
  minutes: string;
  paused: boolean;
};

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const DEFAULT_RATES: Record<string, { price: number; minutes: number }> = {
  NATURAL_GLOW: { price: 799, minutes: 45 },
  PARTY_GLAM: { price: 1499, minutes: 75 },
  HD_CAMERA: { price: 1999, minutes: 90 },
  BRIDAL_FULL: { price: 4999, minutes: 120 },
  HAIR_STYLING: { price: 699, minutes: 60 },
  SAREE_DRAPE: { price: 399, minutes: 30 },
  MEHENDI: { price: 1299, minutes: 90 },
};

function openDaysFromStored(raw?: string | null): string[] {
  const closed = (raw ?? '').split(',').map((day) => day.trim()).filter(Boolean);
  if (closed.length === 0 || closed.length >= WEEKDAYS.length) return [...WEEKDAYS];
  return WEEKDAYS.filter((day) => !closed.includes(day));
}

function priceText(value: number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : '';
}

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function blockedToday(artist: BeautyArtist | null): string[] {
  if (!artist?.blockedSlotDate || artist.blockedSlotDate !== istToday()) return [];
  const slots = buildBeautySlots(scheduleFromArtist(artist));
  return parseBlockedBeautySlotIds(artist.blockedSlotIds, slots);
}

function customMetaFromRates(rates: BeautyArtist['rates']) {
  return (rates ?? [])
    .filter((row) => row.serviceType.startsWith('CUS_'))
    .map((row) => ({
      serviceCode: row.serviceType,
      label: row.label?.trim() || row.serviceType,
      hint: row.hint ?? undefined,
      emoji: row.emoji ?? undefined,
    }));
}

function payloadFromArtist(artist: BeautyArtist, artistEnabled: boolean) {
  return {
    enabled: artistEnabled,
    tagline: artist.tagline ?? undefined,
    yearsExperience: artist.yearsExperience ?? undefined,
    ratingScore: artist.ratingScore ?? undefined,
    ratingCount: artist.ratingCount ?? undefined,
    homeVisitCharge: Number(artist.homeVisitCharge ?? 0),
    studioAddress: artist.studioAddress ?? undefined,
    closedWeekdays: artist.closedWeekdays ?? '',
    blockedSlotDate: artist.blockedSlotDate ?? '',
    blockedSlotIds: artist.blockedSlotIds ?? '',
    rates: artist.rates ?? [],
    customTreatments: customMetaFromRates(artist.rates),
  };
}

export function BeautyAdminPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [beautyOn, setBeautyOn] = useState(false);
  const [townBusy, setTownBusy] = useState(false);
  const [townMinPrepay, setTownMinPrepay] = useState('');
  const [townParlourFee, setTownParlourFee] = useState('');
  const [townPayRulesBusy, setTownPayRulesBusy] = useState(false);
  const [artists, setArtists] = useState<BeautyArtist[]>([]);
  const [orders, setOrders] = useState<BeautyAdminOrder[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [tagline, setTagline] = useState('');
  const [years, setYears] = useState('');
  const [rating, setRating] = useState('4.8');
  const [ratingCount, setRatingCount] = useState('0');
  const [homeVisit, setHomeVisit] = useState('');
  const [studio, setStudio] = useState('');
  const [openDays, setOpenDays] = useState<string[]>([...WEEKDAYS]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [customRows, setCustomRows] = useState<CustomTreatmentRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [minPrepay, setMinPrepay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    void Promise.all([
      getTownConfig(token, loadForTown),
      fetchTownBeautyArtists(token, loadForTown),
      fetchAdminBeautyOrders(token, loadForTown),
    ])
      .then(([config, artistRows, orderRows]) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setBeautyOn(config.beautyEnabled === true);
        setTownMinPrepay(config.beautyMinPrepayAmount > 0 ? String(config.beautyMinPrepayAmount) : '');
        setTownParlourFee(config.beautyParlourPaymentFee > 0 ? String(config.beautyParlourPaymentFee) : '');
        setArtists(artistRows);
        setOrders(orderRows);
        setVendorId((prev) => (artistRows.some((a) => a.vendorId === prev) ? prev : artistRows[0]?.vendorId ?? ''));
        setError(null);
      })
      .catch((err) => {
        if (cancelled || townIdRef.current !== loadForTown) return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load glam');
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId]);

  useEffect(() => {
    const artist = artists.find((row) => row.vendorId === vendorId);
    if (!artist) return;
    setEnabled(artist.enabled);
    setTagline(artist.tagline ?? '');
    setYears(artist.yearsExperience ? String(artist.yearsExperience) : '');
    setRating(artist.ratingScore != null ? String(artist.ratingScore) : '4.8');
    setRatingCount(artist.ratingCount != null ? String(artist.ratingCount) : '0');
    setHomeVisit(artist.homeVisitCharge ? String(artist.homeVisitCharge) : '');
    setMinPrepay(
      artist.bookingMinPrepayAmount != null && Number(artist.bookingMinPrepayAmount) > 0
        ? String(artist.bookingMinPrepayAmount)
        : '',
    );
    setStudio(artist.studioAddress ?? '');
    setOpenDays(openDaysFromStored(artist.closedWeekdays));
    const nextPrices: Record<string, string> = {};
    const nextMinutes: Record<string, string> = {};
    const nextPaused: Record<string, boolean> = {};
    for (const service of BEAUTY_SERVICES) {
      const found = artist.rates?.find((rate) => rate.serviceType === service.id);
      nextPrices[service.id] = found ? priceText(found.unitPrice) : '';
      nextMinutes[service.id] = found ? String(found.durationMinutes) : String(service.defaultMinutes);
      nextPaused[service.id] = Boolean(found?.paused);
    }
    setPrices(nextPrices);
    setMinutes(nextMinutes);
    setPaused(nextPaused);
    const customs = artist.rates?.filter((row) => row.serviceType.startsWith('CUS_')) ?? [];
    setCustomRows(
      customs.map((row) => ({
        key: row.serviceType,
        code: row.serviceType,
        label: row.label ?? '',
        price: row.unitPrice ? priceText(row.unitPrice) : '',
        minutes: String(row.durationMinutes ?? 60),
        paused: Boolean(row.paused),
      })),
    );
    setBlockedSlots(blockedToday(artist));
  }, [vendorId, artists]);

  async function saveTownPaymentRules() {
    if (!token || !townId || townPayRulesBusy) return;
    setTownPayRulesBusy(true);
    setError(null);
    try {
      const saved = await saveTownBeautyPaymentRules(token, townId, {
        beautyMinPrepayAmount: Number(townMinPrepay || 0),
        beautyParlourPaymentFee: Number(townParlourFee || 0),
      });
      setTownMinPrepay(saved.beautyMinPrepayAmount > 0 ? String(saved.beautyMinPrepayAmount) : '');
      setTownParlourFee(saved.beautyParlourPaymentFee > 0 ? String(saved.beautyParlourPaymentFee) : '');
      setToast('Glam payment rules saved for this town');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save payment rules');
    } finally {
      setTownPayRulesBusy(false);
    }
  }

  async function setTownGlam(next: boolean) {
    if (!token || !townId || townBusy) return;
    const targetTownId = townId;
    setTownBusy(true);
    setError(null);
    try {
      const saved = await setTownBeautyEnabled(token, targetTownId, next);
      if (townIdRef.current === targetTownId) {
        setBeautyOn(saved.beautyEnabled === true);
      }
      setToast(
        saved.beautyEnabled
          ? 'Glam bookings enabled for this town'
          : 'Glam bookings turned off for buyers',
      );
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update town');
    } finally {
      setTownBusy(false);
    }
  }

  function artistPayload(blocked: string[], artistEnabled: boolean) {
    const standardRates = BEAUTY_SERVICES.filter((service) => prices[service.id]?.trim()).map((service) => ({
      serviceType: service.id,
      unitPrice: Number(prices[service.id]),
      durationMinutes: Number(minutes[service.id] || service.defaultMinutes),
      paused: paused[service.id] === true,
    }));
    const customRates = customRows
      .filter((row) => row.label.trim() && row.price.trim())
      .map((row) => {
        const code = row.code.trim() || slugCustomTreatmentCode(row.label);
        return {
          serviceType: code,
          unitPrice: Number(row.price),
          durationMinutes: Number(row.minutes || 60),
          paused: row.paused,
        };
      });
    const customTreatments = customRows
      .filter((row) => row.label.trim() && row.price.trim())
      .map((row) => ({
        serviceCode: row.code.trim() || slugCustomTreatmentCode(row.label),
        label: row.label.trim(),
      }));
    const closedWeekdays = WEEKDAYS.filter((day) => !openDays.includes(day)).join(',');
    const today = istToday();
    return {
      enabled: artistEnabled,
      tagline: tagline.trim() || undefined,
      yearsExperience: years ? Number(years) : undefined,
      ratingScore: rating ? Number(rating) : undefined,
      ratingCount: ratingCount ? Number(ratingCount) : undefined,
      homeVisitCharge: Number(homeVisit || 0),
      studioAddress: studio.trim() || undefined,
      closedWeekdays,
      blockedSlotDate: blocked.length ? today : '',
      blockedSlotIds: blocked.join(','),
      bookingMinPrepayAmount: minPrepay.trim() ? Number(minPrepay) : 0,
      rates: [...standardRates, ...customRates],
      customTreatments,
    };
  }

  function addCustomTreatment() {
    setCustomRows((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, code: '', label: '', price: '', minutes: '60', paused: false },
    ]);
  }

  async function persistArtist(blocked: string[], artistEnabled: boolean, message: string) {
    if (!token || !vendorId) return;
    const saved = await saveTownBeautyArtist(token, vendorId, artistPayload(blocked, artistEnabled));
    setArtists((prev) => prev.map((row) => (row.vendorId === saved.vendorId ? saved : row)));
    setEnabled(saved.enabled);
    setToast(message);
  }

  async function setVendorVisible(targetVendorId: string, next: boolean) {
    if (!token || visibilityBusyId) return;
    const artist = artists.find((row) => row.vendorId === targetVendorId);
    if (!artist) return;
    const body =
      targetVendorId === vendorId
        ? artistPayload(blockedSlots, next)
        : payloadFromArtist(artist, next);
    setVisibilityBusyId(targetVendorId);
    setError(null);
    const previousEnabled = artist.enabled;
    setArtists((prev) =>
      prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: next } : row)),
    );
    if (targetVendorId === vendorId) setEnabled(next);
    try {
      const saved = await saveTownBeautyArtist(token, targetVendorId, body);
      setArtists((prev) => prev.map((row) => (row.vendorId === saved.vendorId ? saved : row)));
      if (targetVendorId === vendorId) setEnabled(saved.enabled);
      setToast(
        `${saved.businessName}: ${saved.enabled ? 'visible to buyers' : 'hidden from buyers'}`,
      );
    } catch (err) {
      setArtists((prev) =>
        prev.map((row) => (row.vendorId === targetVendorId ? { ...row, enabled: previousEnabled } : row)),
      );
      if (targetVendorId === vendorId) setEnabled(previousEnabled);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setVisibilityBusyId(null);
    }
  }

  function fillDefaults() {
    const nextPrices: Record<string, string> = {};
    const nextMinutes: Record<string, string> = {};
    for (const service of BEAUTY_SERVICES) {
      const row = DEFAULT_RATES[service.id];
      nextPrices[service.id] = row ? String(row.price) : '';
      nextMinutes[service.id] = row ? String(row.minutes) : String(service.defaultMinutes);
    }
    setPrices(nextPrices);
    setMinutes(nextMinutes);
    setPaused({});
  }

  async function toggleSlotBlock(slotId: string) {
    if (!token || !vendorId) return;
    const previous = blockedSlots;
    const next = previous.includes(slotId) ? previous.filter((id) => id !== slotId) : [...previous, slotId];
    setBlockedSlots(next);
    setError(null);
    try {
      await persistArtist(next, enabled, 'Today’s slot updated');
    } catch (err) {
      setBlockedSlots(previous);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not block slot');
    }
  }

  async function saveArtist() {
    if (!token || !vendorId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await persistArtist(blockedSlots, enabled, 'Artist profile saved');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save artist');
    } finally {
      setSaving(false);
    }
  }

  const townName = towns.find((town) => town.id === townId)?.displayName ?? 'this town';
  const selectedArtist = artists.find((row) => row.vendorId === vendorId);
  const selectedArtistSlots = useMemo(
    () => buildBeautySlots(scheduleFromArtist(selectedArtist)),
    [selectedArtist],
  );

  return (
    <PortalShell title="Koya Glam — town setup">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Toast open={Boolean(toast)} message={toast ?? ''} tone="success" placement="center" durationMs={3500} onClose={() => setToast(null)} />

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>How glam works</h2>
        <ol style={styles.steps}>
          <li>
            <strong>Vendors</strong> — Register with service <em>Makeup &amp; Beauty</em> (
            <Link to="/vendors" style={styles.link}>
              Vendors
            </Link>
            ).
          </li>
          <li>
            <strong>Artist</strong> — In the vendor portal (Glam), they choose which treatments they offer and manage
            bookings.
          </li>
          <li>
            <strong>You (here)</strong> — Turn glam on for the town and choose which artists buyers can see.
          </li>
        </ol>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>1</span>
          <div>
            <h3 style={styles.cardTitle}>Town</h3>
            <p style={styles.cardSub}>When off, buyers never see the Glam tab or /beauty in {townName}.</p>
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
            <span style={styles.switchLabel}>Allow glam bookings</span>
            <button
              type="button"
              disabled={townBusy}
              style={beautyOn ? styles.switchOn : styles.switchOff}
              aria-pressed={beautyOn}
              onClick={() => void setTownGlam(!beautyOn)}
            >
              <span style={styles.knob} data-on={beautyOn ? '1' : '0'} />
              {townBusy ? 'Saving…' : beautyOn ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        {beautyOn ? (
          <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.35rem' }}>
            <p style={styles.hint}>
              Buyers see two online options: pay full, or pay the minimum now and the rest at the parlour.
            </p>
            <div style={styles.row}>
              <label style={styles.field}>
                Min online prepay ₹
                <input
                  style={styles.narrow}
                  inputMode="decimal"
                  placeholder="e.g. 100"
                  value={townMinPrepay}
                  onChange={(e) => setTownMinPrepay(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              <label style={styles.field}>
                Pay-at-parlour extra ₹
                <input
                  style={styles.narrow}
                  inputMode="decimal"
                  placeholder="e.g. 20"
                  value={townParlourFee}
                  onChange={(e) => setTownParlourFee(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              <button type="button" style={styles.primary} disabled={townPayRulesBusy} onClick={() => void saveTownPaymentRules()}>
                {townPayRulesBusy ? 'Saving…' : 'Save payment rules'}
              </button>
            </div>
            <p style={styles.hint}>
              Min prepay is non-refundable. Extra fee is added to the booking total when the customer chooses pay-at-parlour.
            </p>
          </div>
        ) : null}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>2</span>
          <div>
            <h3 style={styles.cardTitle}>Glam vendor</h3>
            <p style={styles.cardSub}>Only vendors assigned to Makeup &amp; Beauty appear here (not laundry or grocery).</p>
          </div>
        </div>
        {artists.length === 0 ? (
          <p style={styles.muted}>
            No glam vendors in this town yet.{' '}
            <Link to="/vendors" style={styles.link}>
              Add or edit a vendor
            </Link>{' '}
            and set Service to <strong>Makeup &amp; Beauty</strong>.
          </p>
        ) : (
          <div style={styles.fieldGrow}>
            <span>Artist / business ({artists.length}) — tap a name to edit; use Visible on each card for buyers.</span>
            <div style={styles.vendorPickRow} role="tablist" aria-label="Glam vendors">
              {artists.map((artist) => {
                const selected = artist.vendorId === vendorId;
                const busy = visibilityBusyId === artist.vendorId;
                return (
                  <div
                    key={artist.vendorId}
                    role="tab"
                    aria-selected={selected}
                    style={selected ? styles.vendorPickOn : styles.vendorPickOff}
                  >
                    <button
                      type="button"
                      style={styles.vendorPickSelect}
                      onClick={() => setVendorId(artist.vendorId)}
                    >
                      {artist.businessName}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(visibilityBusyId)}
                      style={artist.enabled ? styles.vendorVisOn : styles.vendorVisOff}
                      aria-pressed={artist.enabled}
                      title="Show or hide this artist on buyer Glam"
                      onClick={() => void setVendorVisible(artist.vendorId, !artist.enabled)}
                    >
                      <span style={styles.knob} data-on={artist.enabled ? '1' : '0'} />
                      {busy ? 'Saving…' : artist.enabled ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!beautyOn && artists.length > 0 ? (
          <p style={styles.warn}>Town glam is off — buyers still cannot book even if the artist is visible.</p>
        ) : null}
      </section>

      {vendorId && selectedArtist ? (
        <section style={styles.card}>
          <div style={styles.cardHead}>
            <span style={styles.stepNum}>3</span>
            <div style={{ flex: 1 }}>
              <h3 style={styles.cardTitle}>Treatments &amp; prices (optional)</h3>
              <p style={styles.cardSub}>
                Set starting prices here, or let the artist set them in <strong>Vendor portal → Glam</strong>. Use{' '}
                <strong>Hidden</strong> to hide a treatment from buyers until the artist is ready.
              </p>
            </div>
            <button type="button" style={styles.linkBtn} onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? 'Less detail' : 'Profile & slots'}
            </button>
          </div>

          <div style={styles.rateGrid}>
            <span style={styles.colHead}>Treatment</span>
            <span style={styles.colHead}>Price ₹</span>
            <span style={styles.colHead}>Mins</span>
            <span style={styles.colHead}>Buyers see?</span>
            {BEAUTY_SERVICES.map((service) => (
              <Fragment key={service.id}>
                <span style={styles.serviceLabel}>
                  {service.emoji} {service.label}
                </span>
                <input
                  style={styles.price}
                  inputMode="decimal"
                  placeholder="—"
                  value={prices[service.id] ?? ''}
                  onChange={(e) => setPrices((prev) => ({ ...prev, [service.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                />
                <input
                  style={styles.price}
                  inputMode="numeric"
                  value={minutes[service.id] ?? ''}
                  onChange={(e) => setMinutes((prev) => ({ ...prev, [service.id]: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                />
                <button
                  type="button"
                  style={paused[service.id] ? styles.hiddenBtn : styles.visibleBtn}
                  onClick={() => setPaused((prev) => ({ ...prev, [service.id]: !prev[service.id] }))}
                >
                  {paused[service.id] ? 'Hidden' : 'Visible'}
                </button>
              </Fragment>
            ))}
          </div>

          <div style={styles.customBlock}>
            <p style={styles.customTitle}>Custom treatments</p>
            <p style={styles.customSub}>Add manicure variants, packages, or any service not in the list above.</p>
            {customRows.map((row, index) => (
              <div key={row.key} style={styles.customRow}>
                <input
                  style={styles.customName}
                  placeholder="e.g. Gel pedicure"
                  value={row.label}
                  onChange={(e) =>
                    setCustomRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)),
                    )
                  }
                />
                <input
                  style={styles.price}
                  inputMode="decimal"
                  placeholder="₹"
                  value={row.price}
                  onChange={(e) =>
                    setCustomRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, price: e.target.value.replace(/[^\d.]/g, '') } : item)),
                    )
                  }
                />
                <input
                  style={styles.price}
                  inputMode="numeric"
                  placeholder="min"
                  value={row.minutes}
                  onChange={(e) =>
                    setCustomRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, minutes: e.target.value.replace(/\D/g, '').slice(0, 3) } : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  style={row.paused ? styles.hiddenBtn : styles.visibleBtn}
                  onClick={() =>
                    setCustomRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, paused: !item.paused } : item)),
                    )
                  }
                >
                  {row.paused ? 'Hidden' : 'Visible'}
                </button>
                <button
                  type="button"
                  style={styles.removeBtn}
                  aria-label="Remove treatment"
                  onClick={() => setCustomRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" style={styles.chip} onClick={addCustomTreatment}>
              + Add custom treatment
            </button>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.chip} onClick={() => fillDefaults()}>
              Fill sample prices
            </button>
            <button type="button" style={styles.primary} disabled={saving} onClick={() => void saveArtist()}>
              {saving ? 'Saving…' : 'Save prices & profile'}
            </button>
          </div>

          {showAdvanced ? (
            <div style={styles.advanced}>
              <div style={styles.row}>
                <label style={styles.fieldGrow}>
                  Tagline
                  <input style={styles.text} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Bridal & party specialist" />
                </label>
                <label style={styles.field}>
                  Home visit ₹
                  <input style={styles.narrow} inputMode="decimal" value={homeVisit} onChange={(e) => setHomeVisit(e.target.value.replace(/[^\d.]/g, ''))} />
                </label>
                <label style={styles.field}>
                  Min prepay ₹
                  <input
                    style={styles.narrow}
                    inputMode="decimal"
                    value={minPrepay}
                    onChange={(e) => setMinPrepay(e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="0 = full only"
                    title="Minimum online prepay when buyer chooses partial payment. Admin only — vendors cannot change this."
                  />
                </label>
              </div>
              <p style={styles.hint}>
                Min prepay enables partial payment at booking (UPI). Leave 0 to require full payment. Balance is tracked on the order.
              </p>
              <label style={styles.fieldGrow}>
                Studio address (at-studio bookings)
                <input style={styles.text} value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="Full address" />
              </label>
              <div style={styles.row}>
                <span style={styles.dayLabel}>Working days</span>
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
              </div>
              <div style={styles.row}>
                <span style={styles.dayLabel}>Block slots today</span>
                {selectedArtistSlots.map((slot) => {
                  const off = blockedSlots.includes(slot.id);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      style={off ? styles.slotBlocked : styles.slotOpen}
                      onClick={() => void toggleSlotBlock(slot.id)}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Bookings in {townName}</h3>
        {orders.length === 0 ? <p style={styles.muted}>No glam bookings yet.</p> : null}
        {orders.map((order) => (
          <div key={order.id} style={styles.order}>
            <strong>{order.orderNumber}</strong>
            <span>{order.artistName}</span>
            <span>{order.serviceLabel}</span>
            <span>{order.statusLabel}</span>
            <span>
              ₹
              {(
                Number(order.serviceAmount) +
                Number(order.travelCharge || 0) +
                Number(order.platformFeeAmount || 0) +
                Number(order.codFee || 0)
              ).toFixed(0)}
            </span>
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
    background: 'linear-gradient(135deg, #fdf2f8 0%, #fff 50%, #ecfdf5 100%)',
    border: '1px solid var(--border, #e5e7eb)',
    marginBottom: '0.55rem',
  },
  heroTitle: { margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 900 },
  steps: { margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  link: { color: '#9d174d', fontWeight: 800, textDecoration: 'none' },
  card: {
    padding: '0.75rem 0.85rem',
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-elevated, #fff)',
    marginBottom: '0.55rem',
    display: 'grid',
    gap: '0.55rem',
  },
  cardHead: { display: 'flex', gap: '0.55rem', alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#831843',
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
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700 },
  fieldGrow: { display: 'grid', gap: '0.12rem', fontSize: '0.72rem', fontWeight: 700, flex: '1 1 14rem', minWidth: 180 },
  vendorPickRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  vendorPickOn: {
    flex: '1 1 11rem',
    maxWidth: '100%',
    borderRadius: 10,
    border: '2px solid #9d174d',
    background: 'linear-gradient(135deg, #fce7f3, #fff)',
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
  vendorVisOn: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    border: '1px solid #9d174d',
    background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    fontWeight: 900,
    fontSize: '0.72rem',
    color: '#831843',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0 0.45rem',
    flexShrink: 0,
  },
  vendorVisOff: {
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
  input: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.5rem', background: '#fff' },
  text: { minHeight: 40, border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.5rem', width: '100%' },
  narrow: { minHeight: 40, width: '5rem', border: '1px solid var(--border, #ddd)', borderRadius: 10, padding: '0 0.45rem' },
  switchBlock: { display: 'grid', gap: '0.2rem' },
  switchLabel: { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' },
  switchOn: {
    minHeight: 40,
    minWidth: 88,
    borderRadius: 999,
    border: '1px solid #9d174d',
    background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    fontWeight: 900,
    fontSize: '0.78rem',
    color: '#831843',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.55rem',
  },
  switchOff: {
    minHeight: 40,
    minWidth: 88,
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    fontWeight: 800,
    fontSize: '0.78rem',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.55rem',
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: 'currentColor',
    opacity: 0.35,
  },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  hint: { margin: '0 0 0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 },
  warn: { margin: 0, fontSize: '0.72rem', color: '#b45309', fontWeight: 700 },
  rateGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(10rem, 1fr) 5.5rem 4rem 5.5rem',
    gap: '0.35rem 0.5rem',
    alignItems: 'center',
  },
  customBlock: { display: 'grid', gap: '0.4rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border)' },
  customTitle: { margin: 0, fontSize: '0.82rem', fontWeight: 900 },
  customSub: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  customRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
  },
  customName: {
    flex: '1 1 10rem',
    minHeight: 36,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0 0.45rem',
    fontWeight: 700,
  },
  removeBtn: {
    minHeight: 34,
    minWidth: 34,
    borderRadius: 8,
    border: '1px solid #fca5a5',
    background: '#fef2f2',
    color: '#b91c1c',
    fontWeight: 900,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  colHead: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  serviceLabel: { fontSize: '0.78rem', fontWeight: 700 },
  price: { minHeight: 36, border: '1px solid var(--border)', borderRadius: 8, padding: '0 0.4rem', width: '100%' },
  visibleBtn: { minHeight: 34, borderRadius: 8, border: '1px solid #059669', background: '#ecfdf5', color: '#047857', fontWeight: 800, fontSize: '0.68rem' },
  hiddenBtn: { minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#6b7280', fontWeight: 800, fontSize: '0.68rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  chip: { minHeight: 38, borderRadius: 999, border: '1px solid var(--border)', background: '#fff', padding: '0 0.75rem', fontWeight: 700 },
  primary: { minHeight: 38, border: 0, borderRadius: 10, background: '#9d174d', color: '#fff', fontWeight: 800, padding: '0 0.9rem' },
  linkBtn: { border: 0, background: 'transparent', color: '#9d174d', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  advanced: { display: 'grid', gap: '0.45rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border)' },
  dayLabel: { fontSize: '0.72rem', fontWeight: 800, alignSelf: 'center' },
  dayOn: { minHeight: 36, minWidth: 42, borderRadius: 999, border: '1px solid #9d174d', background: '#fce7f3', fontWeight: 800, fontSize: '0.72rem' },
  dayOff: { minHeight: 36, minWidth: 42, borderRadius: 999, border: '1px solid var(--border)', background: '#fff', color: '#888', fontSize: '0.72rem' },
  slotOpen: { minHeight: 34, borderRadius: 999, border: '1px solid var(--border)', background: '#fff', padding: '0 0.5rem', fontSize: '0.68rem', fontWeight: 700 },
  slotBlocked: { minHeight: 34, borderRadius: 999, border: '1px solid #b91c1c', background: '#fee2e2', padding: '0 0.5rem', fontSize: '0.68rem', fontWeight: 800, color: '#991b1b' },
  order: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' },
};
