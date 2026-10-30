import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { ApiError } from '@/shared/api/http';
import { Toast } from '@/shared/ui';
import { BeautyBookings } from '../components/BeautyBookings';
import { GlamTreatmentsCard } from '../components/GlamTreatmentsCard';
import { GlamWorkPhotosCard } from '../components/GlamWorkPhotosCard';
import { GlamVendorCalendar, type CalView } from '../components/GlamVendorCalendar';
import {
  buildBeautySlots,
  beautySchedulesEqual,
  fetchMyBeautyProfile,
  fetchVendorBeautyOrders,
  glamScheduleForForm,
  mergeBeautyProfileAfterOps,
  normalizeBeautySlotSchedule,
  scheduleFromArtist,
  blockedSlotIdsForDate,
  effectiveStaffForDate,
  parseStaffOverrides,
  serializeStaffOverrides,
  saveBeautyOps,
  trimBeautyTime,
  type BeautyOrder,
  type BeautyProfile,
} from '../api/beautyApi';

const INTERVAL_OPTIONS = [15, 30, 45, 60] as const;

type GlamDeskTab = 'treatments' | 'gallery' | 'setup' | 'calendar' | 'bookings';

const GLAM_DESK_TABS: { id: GlamDeskTab; label: string; emoji: string }[] = [
  { id: 'treatments', label: 'Treatments', emoji: '₹' },
  { id: 'gallery', label: 'Our work', emoji: '📷' },
  { id: 'setup', label: 'Hours & team', emoji: '⚙️' },
  { id: 'calendar', label: 'Calendar', emoji: '📅' },
  { id: 'bookings', label: 'Bookings', emoji: '📋' },
];

function buildStaffOverrideMap(
  base: Record<string, number>,
  date: string,
  value: number,
  defaultStaff: number,
): Record<string, number> {
  const next = { ...base };
  if (value === defaultStaff) delete next[date];
  else next[date] = value;
  return next;
}

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function blockedForDate(profile: BeautyProfile | null, date: string, slots: ReturnType<typeof buildBeautySlots>): string[] {
  return blockedSlotIdsForDate(date, profile, slots);
}

export function GlamDeskPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const today = istToday();
  const [tick, setTick] = useState(0);
  const [profile, setProfile] = useState<BeautyProfile | null>(null);
  const [orders, setOrders] = useState<BeautyOrder[]>([]);
  const [calView, setCalView] = useState<CalView>('today');
  const [anchorDate, setAnchorDate] = useState(() => today);
  const [staffCount, setStaffCount] = useState(1);
  const [staffBusy, setStaffBusy] = useState(false);
  const [dayStaffBusy, setDayStaffBusy] = useState(false);
  const [dayStaffOverrides, setDayStaffOverrides] = useState<Record<string, number>>({});
  const [dayOpen, setDayOpen] = useState('08:00');
  const [dayClose, setDayClose] = useState('20:00');
  const [intervalMin, setIntervalMin] = useState(45);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [homeVisitInput, setHomeVisitInput] = useState('0');
  const [homeVisitBusy, setHomeVisitBusy] = useState(false);
  const [studioAddressInput, setStudioAddressInput] = useState('');
  const [studioBusy, setStudioBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [deskTab, setDeskTab] = useState<GlamDeskTab>('treatments');

  usePortalChrome({
    title: 'Koya Glam',
    onRefresh: () => setTick((n) => n + 1),
  });

  const schedule = useMemo(
    () => scheduleFromArtist({ slotDayOpen: dayOpen, slotDayClose: dayClose, slotIntervalMinutes: intervalMin }),
    [dayOpen, dayClose, intervalMin],
  );
  const savedSchedule = useMemo(
    () => (profile ? glamScheduleForForm(profile) : null),
    [profile],
  );
  const scheduleDirty = useMemo(() => {
    if (!savedSchedule) return false;
    return !beautySchedulesEqual(schedule, savedSchedule);
  }, [schedule, savedSchedule]);

  const savedHomeVisit = Number(profile?.homeVisitCharge ?? 0);
  const homeVisitDraft = Math.max(0, Number(homeVisitInput || 0) || 0);
  const homeVisitDirty = profile != null && savedHomeVisit !== homeVisitDraft;

  function applyScheduleToForm(row: BeautyProfile) {
    const sch = glamScheduleForForm(row);
    setDayOpen(sch.dayOpen);
    setDayClose(sch.dayClose);
    setIntervalMin(sch.intervalMinutes);
  }

  function applyHomeVisitToForm(row: BeautyProfile) {
    const value = Math.max(0, Number(row.homeVisitCharge ?? 0));
    setHomeVisitInput(Number.isFinite(value) ? String(value) : '0');
  }

  function applyStudioToForm(row: BeautyProfile) {
    setStudioAddressInput(String(row.studioAddress ?? '').trim());
  }

  const savedStudio = String(profile?.studioAddress ?? '').trim();
  const studioDirty = profile != null && savedStudio !== studioAddressInput.trim();
  const slots = useMemo(() => buildBeautySlots(schedule), [schedule]);
  const staffForDate = useCallback(
    (date: string) => effectiveStaffForDate(staffCount, dayStaffOverrides, date),
    [staffCount, dayStaffOverrides],
  );
  const calendarFocusDate = calView === 'today' || calView === 'daily' ? anchorDate : today;
  const staffOnFocusDay = staffForDate(calendarFocusDate);
  const hasDayOverride = dayStaffOverrides[calendarFocusDate] != null;

  const loadProfile = useCallback(() => {
    if (!token) return;
    void fetchMyBeautyProfile(token)
      .then((normalized) => {
        setProfile(normalized);
        setDayStaffOverrides(parseStaffOverrides(normalized.staffOverrides));
        setStaffCount(Math.max(1, normalized.staffCount ?? 1));
        applyScheduleToForm(normalized);
        applyHomeVisitToForm(normalized);
        applyStudioToForm(normalized);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load glam profile'));
  }, [token]);

  const loadOrders = useCallback(() => {
    if (!token) return;
    void fetchVendorBeautyOrders(token)
      .then((rows) => setOrders(Array.isArray(rows) ? rows : []))
      .catch(() => setOrders([]));
  }, [token]);

  useEffect(() => {
    loadProfile();
    loadOrders();
  }, [loadProfile, loadOrders, tick]);

  useEffect(() => {
    if (calView === 'today') setAnchorDate(today);
  }, [calView, today]);

  async function persistBlocks(date: string, next: string[], message: string) {
    if (!token) return;
    const saved = await saveBeautyOps(token, {
      blockedSlotIds: next.join(','),
      blockedSlotDate: date,
    });
    setProfile((prev) => {
      const merged = mergeBeautyProfileAfterOps(prev, saved);
      applyScheduleToForm(merged);
      return merged;
    });
    setSavedMessage(message);
    setSavedOpen(true);
  }

  async function toggleManualBlock(date: string, slotId: string) {
    if (!token) return;
    const previous = blockedForDate(profile, date, slots);
    const next = previous.includes(slotId) ? previous.filter((id) => id !== slotId) : [...previous, slotId];
    setError(null);
    try {
      const slot = slots.find((item) => item.id === slotId);
      await persistBlocks(
        date,
        next,
        next.includes(slotId) ? `${slot?.label ?? 'Slot'} blocked` : `${slot?.label ?? 'Slot'} open`,
      );
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update slot');
    }
  }

  function applyStaffOverrideLocal(date: string, value: number, defaultStaff = staffCount) {
    setDayStaffOverrides((prev) => {
      const nextMap = buildStaffOverrideMap(prev, date, value, defaultStaff);
      setProfile((p) => (p ? { ...p, staffOverrides: serializeStaffOverrides(nextMap) } : p));
      return nextMap;
    });
  }

  async function changeStaffForDate(date: string, next: number) {
    if (!token || dayStaffBusy) return;
    const value = Math.max(1, Math.min(50, next));
    applyStaffOverrideLocal(date, value);
    setDayStaffBusy(true);
    setError(null);
    try {
      const saved = await saveBeautyOps(token, { staffOverrideDate: date, staffCountForDate: value });
      const defaultStaff = Math.max(1, saved.staffCount ?? staffCount);
      const fromServer = parseStaffOverrides(saved.staffOverrides);
      let merged = buildStaffOverrideMap(fromServer, date, value, defaultStaff);
      if (value !== defaultStaff && merged[date] !== value) {
        merged = { ...merged, [date]: value };
      }
      setDayStaffOverrides(merged);
      setProfile((prev) =>
        mergeBeautyProfileAfterOps(prev, { ...saved, staffOverrides: serializeStaffOverrides(merged) }),
      );
      setSavedMessage(
        value === staffCount
          ? `Using default ${staffCount} professional${staffCount === 1 ? '' : 's'} on that day`
          : `${date}: ${value} professional${value === 1 ? '' : 's'} (bookings already made stay)`,
      );
      setSavedOpen(true);
    } catch (err) {
      loadProfile();
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save staff for that day');
    } finally {
      setDayStaffBusy(false);
    }
  }

  async function changeStaff(next: number) {
    if (!token || staffBusy) return;
    const value = Math.max(1, Math.min(50, next));
    setStaffCount(value);
    setStaffBusy(true);
    setError(null);
    try {
      const saved = await saveBeautyOps(token, { staffCount: value });
      setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved));
      setStaffCount(Math.max(1, saved.staffCount ?? value));
      setSavedMessage(`Team size set to ${value} professional${value === 1 ? '' : 's'}`);
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save team size');
      setStaffCount(Math.max(1, profile?.staffCount ?? 1));
    } finally {
      setStaffBusy(false);
    }
  }

  async function saveStudioAddress() {
    if (!token || studioBusy) return;
    const address = studioAddressInput.trim();
    setStudioBusy(true);
    setError(null);
    try {
      const saved = await saveBeautyOps(token, { studioAddress: address });
      setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved));
      applyStudioToForm(saved);
      setSavedMessage(address ? 'Studio address saved for customers' : 'Studio address cleared');
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save studio address');
      if (profile) applyStudioToForm(profile);
    } finally {
      setStudioBusy(false);
    }
  }

  async function saveHomeVisitCharge() {
    if (!token || homeVisitBusy) return;
    const amount = Math.max(0, Math.round(homeVisitDraft));
    setHomeVisitBusy(true);
    setError(null);
    try {
      const saved = await saveBeautyOps(token, { homeVisitCharge: amount });
      setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved));
      applyHomeVisitToForm(saved);
      setSavedMessage(
        amount > 0 ? `At my home charge set to ₹${amount}` : 'At my home visits are free for customers',
      );
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save home visit charge');
      if (profile) applyHomeVisitToForm(profile);
    } finally {
      setHomeVisitBusy(false);
    }
  }

  async function saveSchedule() {
    if (!token || scheduleBusy) return;
    const open = trimBeautyTime(dayOpen);
    const close = trimBeautyTime(dayClose);
    const interval = intervalMin;
    const requested = normalizeBeautySlotSchedule({
      dayOpen: open,
      dayClose: close,
      intervalMinutes: interval,
    });
    setScheduleBusy(true);
    setError(null);
    try {
      const saved = await saveBeautyOps(token, {
        slotDayOpen: requested.dayOpen,
        slotDayClose: requested.dayClose,
        slotIntervalMinutes: requested.intervalMinutes,
      });
      const savedSch = scheduleFromArtist(saved);
      if (!beautySchedulesEqual(requested, savedSch)) {
        setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved));
        applyScheduleToForm(saved);
        throw new ApiError(
          `Hours did not stick on the server (still ${savedSch.dayOpen}–${savedSch.dayClose}, ${savedSch.intervalMinutes} min). Refresh and try Save hours again.`,
          409,
        );
      }
      const merged = mergeBeautyProfileAfterOps(profile, saved);
      setProfile(merged);
      applyScheduleToForm(merged);
      setSavedMessage(
        `Hours saved · ${savedSch.dayOpen}–${savedSch.dayClose} · ${savedSch.intervalMinutes} min slots`,
      );
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save hours');
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <div style={styles.wrap}>
      {error ? (
        <div style={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}
      <Toast open={savedOpen} message={savedMessage} tone="success" placement="center" durationMs={3500} onClose={() => setSavedOpen(false)} />
      {profile?.enabled ? (
        <>
          <div style={styles.deskTabs} role="tablist" aria-label="Glam sections">
            {GLAM_DESK_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={deskTab === tab.id}
                style={deskTab === tab.id ? styles.deskTabOn : styles.deskTab}
                onClick={() => setDeskTab(tab.id)}
              >
                <span aria-hidden>{tab.emoji}</span> {tab.label}
              </button>
            ))}
          </div>

          {deskTab === 'treatments' ? (
            <GlamTreatmentsCard
              token={token}
              profile={profile}
              onSaved={(saved) => setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved))}
              onError={(message) => setError(message)}
              onToast={(message) => {
                setSavedMessage(message);
                setSavedOpen(true);
              }}
            />
          ) : null}

          {deskTab === 'gallery' ? (
            <GlamWorkPhotosCard
              token={token}
              profile={profile}
              onSaved={(saved) => setProfile((prev) => mergeBeautyProfileAfterOps(prev, saved))}
              onError={(message) => setError(message)}
              onToast={(message) => {
                setSavedMessage(message);
                setSavedOpen(true);
              }}
            />
          ) : null}

          {deskTab === 'setup' ? (
            <>
          <div style={styles.teamCard}>
            <div style={styles.teamIcon} aria-hidden>
              💄
            </div>
            <div style={styles.teamBody}>
              <p style={styles.teamTitle}>Default professionals</p>
              <p style={styles.teamSub}>Usual team size — used on days unless you set a different count on the calendar.</p>
            </div>
            <div style={styles.stepper}>
              <button type="button" style={styles.stepBtn} disabled={staffBusy || staffCount <= 1} aria-label="Fewer professionals" onClick={() => void changeStaff(staffCount - 1)}>
                −
              </button>
              <span style={styles.staffNum}>{staffCount}</span>
              <button type="button" style={styles.stepBtn} disabled={staffBusy || staffCount >= 50} aria-label="More professionals" onClick={() => void changeStaff(staffCount + 1)}>
                +
              </button>
            </div>
          </div>

          <div style={styles.scheduleCard}>
            <p style={styles.scheduleTitle}>Booking hours & slot length</p>
            <div style={styles.scheduleRow}>
              <label style={styles.field}>
                Opens
                <input type="time" value={dayOpen} style={styles.timeInput} onChange={(e) => setDayOpen(e.target.value || '08:00')} />
              </label>
              <label style={styles.field}>
                Closes by
                <input type="time" value={dayClose} style={styles.timeInput} onChange={(e) => setDayClose(e.target.value || '20:00')} />
              </label>
              <label style={styles.field}>
                Slot size
                <select value={intervalMin} style={styles.select} onChange={(e) => setIntervalMin(Number(e.target.value))}>
                  {INTERVAL_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} min
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" style={styles.saveBtn} disabled={scheduleBusy || !scheduleDirty} onClick={() => void saveSchedule()}>
                {scheduleBusy ? 'Saving…' : scheduleDirty ? 'Save hours' : 'Hours saved'}
              </button>
            </div>
            <p style={styles.scheduleHint}>
              {scheduleDirty ? (
                <>
                  <strong style={{ color: '#b45309' }}>Not saved yet</strong> — customers still see{' '}
                  {savedSchedule
                    ? `${savedSchedule.dayOpen}–${savedSchedule.dayClose} every ${savedSchedule.intervalMinutes} min`
                    : 'your last saved hours'}
                  . Tap Save hours to update the app.
                </>
              ) : (
                <>
                  Customers see slots from {schedule.dayOpen} to {schedule.dayClose} every {schedule.intervalMinutes} minutes (
                  {slots.length} slots per day).
                </>
              )}
            </p>
          </div>

          <div style={styles.scheduleCard}>
            <p style={styles.scheduleTitle}>At studio address</p>
            <div style={styles.scheduleRow}>
              <label style={{ ...styles.field, flex: 1 }}>
                Where customers meet you
                <input
                  type="text"
                  maxLength={300}
                  value={studioAddressInput}
                  style={styles.studioInput}
                  placeholder="e.g. Main Road, near Ganesh Temple"
                  onChange={(e) => setStudioAddressInput(e.target.value)}
                  aria-label="Studio address for at-studio bookings"
                />
              </label>
              <button
                type="button"
                style={styles.saveBtn}
                disabled={studioBusy || !studioDirty}
                onClick={() => void saveStudioAddress()}
              >
                {studioBusy ? 'Saving…' : studioDirty ? 'Save address' : 'Saved'}
              </button>
            </div>
            <p style={styles.scheduleHint}>
              {studioDirty ? (
                <>
                  <strong style={{ color: '#b45309' }}>Not saved yet</strong> — customers who pick <strong>At studio</strong>{' '}
                  need this before they can pay.
                </>
              ) : savedStudio ? (
                <>Customers see: {savedStudio}</>
              ) : (
                <>If empty, your shop address from registration is used when available.</>
              )}
            </p>
          </div>

          <div style={styles.scheduleCard}>
            <p style={styles.scheduleTitle}>At my home visit charge</p>
            <div style={styles.scheduleRow}>
              <label style={styles.field}>
                Extra fee (₹)
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={homeVisitInput}
                  style={styles.chargeInput}
                  onChange={(e) => setHomeVisitInput(e.target.value.replace(/[^\d]/g, ''))}
                  aria-label="Home visit charge in rupees"
                />
              </label>
              <button
                type="button"
                style={styles.saveBtn}
                disabled={homeVisitBusy || !homeVisitDirty}
                onClick={() => void saveHomeVisitCharge()}
              >
                {homeVisitBusy ? 'Saving…' : homeVisitDirty ? 'Save charge' : 'Saved'}
              </button>
            </div>
            <p style={styles.scheduleHint}>
              {homeVisitDirty ? (
                <>
                  <strong style={{ color: '#b45309' }}>Not saved yet</strong> — customers still see{' '}
                  {savedHomeVisit > 0 ? `₹${savedHomeVisit} added when they pick At my home` : 'no extra home visit fee'}.
                </>
              ) : savedHomeVisit > 0 ? (
                <>Customers who choose <strong>At my home</strong> pay ₹{savedHomeVisit} on top of service + platform fee.</>
              ) : (
                <>Set to ₹0 for free home visits. Studio bookings are never charged this fee.</>
              )}
            </p>
          </div>
            </>
          ) : null}

          {deskTab === 'calendar' ? (
            <>
          {(calView === 'today' || calView === 'daily') && (
            <div style={styles.dayStaffCard}>
              <div style={styles.teamBody}>
                <p style={styles.teamTitle}>Staff on {calendarFocusDate}</p>
                <p style={styles.teamSub}>
                  {hasDayOverride ? `Override (default ${staffCount}).` : `Same as default (${staffCount}).`} Lowering staff does not cancel existing bookings; new ones use this limit.
                </p>
              </div>
              <div style={styles.stepper}>
                <button
                  type="button"
                  style={styles.stepBtn}
                  disabled={dayStaffBusy || staffOnFocusDay <= 1}
                  onClick={() => void changeStaffForDate(calendarFocusDate, staffOnFocusDay - 1)}
                >
                  −
                </button>
                <span style={styles.staffNum}>{staffOnFocusDay}</span>
                <button
                  type="button"
                  style={styles.stepBtn}
                  disabled={dayStaffBusy || staffOnFocusDay >= 50}
                  onClick={() => void changeStaffForDate(calendarFocusDate, staffOnFocusDay + 1)}
                >
                  +
                </button>
                {hasDayOverride ? (
                  <button type="button" style={styles.resetBtn} disabled={dayStaffBusy} onClick={() => void changeStaffForDate(calendarFocusDate, staffCount)}>
                    Use default
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <GlamVendorCalendar
            view={calView}
            onViewChange={setCalView}
            anchorDate={anchorDate}
            onAnchorDateChange={setAnchorDate}
            today={today}
            defaultStaffCount={staffCount}
            staffForDate={staffForDate}
            slots={slots}
            slotIntervalMinutes={schedule.intervalMinutes}
            profile={profile}
            orders={orders}
            onToggleManualBlock={(date, slotId) => void toggleManualBlock(date, slotId)}
          />
            </>
          ) : null}

          {deskTab === 'bookings' ? <BeautyBookings active reloadToken={tick} /> : null}
        </>
      ) : (
        <p style={styles.muted}>Glam is not turned on for this shop. Super admin enables the artist profile.</p>
      )}
      {!profile?.enabled ? <BeautyBookings active reloadToken={tick} /> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  deskTabs: {
    display: 'flex',
    gap: '0.3rem',
    overflowX: 'auto',
    padding: '0.3rem',
    borderRadius: 14,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--bg-muted, #f8fafc)',
    WebkitOverflowScrolling: 'touch',
  },
  deskTab: {
    flex: '0 0 auto',
    minHeight: 38,
    padding: '0.35rem 0.65rem',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted, #6b7280)',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  deskTabOn: {
    flex: '0 0 auto',
    minHeight: 38,
    padding: '0.35rem 0.65rem',
    borderRadius: 10,
    border: '1px solid #f9a8d4',
    background: '#fff',
    color: '#831843',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(190, 24, 93, 0.1)',
  },
  errorBanner: {
    padding: '0.45rem 0.6rem',
    borderRadius: 10,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  teamCard: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    border: '1px solid #f9a8d4',
    background: 'linear-gradient(135deg, #fff 0%, #fdf2f8 100%)',
    boxShadow: '0 4px 14px rgba(190, 24, 93, 0.06)',
  },
  teamIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.25rem',
    background: '#fce7f3',
    flexShrink: 0,
  },
  teamBody: { flex: '1 1 10rem', minWidth: 0 },
  teamTitle: { margin: 0, fontSize: '0.82rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#831843' },
  teamSub: { margin: '0.15rem 0 0', fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', lineHeight: 1.35 },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.2rem 0.35rem',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid #fce7f3',
  },
  stepBtn: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontWeight: 800,
    fontSize: '1.05rem',
    color: '#9d174d',
  },
  staffNum: { minWidth: 32, textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', color: '#111827' },
  scheduleCard: {
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    background: '#fff',
    boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
    display: 'grid',
    gap: '0.4rem',
  },
  scheduleTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#374151' },
  scheduleRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'flex-end' },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.62rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  timeInput: { minHeight: 38, borderRadius: 10, border: '1px solid #e5e7eb', padding: '0 0.45rem', fontSize: '0.78rem', fontWeight: 600 },
  select: { minHeight: 38, borderRadius: 10, border: '1px solid #e5e7eb', padding: '0 0.45rem', fontSize: '0.78rem', fontWeight: 600, minWidth: 88 },
  studioInput: {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid var(--border, #e5e7eb)',
    padding: '0 0.55rem',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  chargeInput: {
    minHeight: 38,
    minWidth: 100,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    padding: '0 0.45rem',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  saveBtn: {
    minHeight: 38,
    padding: '0 0.85rem',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.72rem',
    boxShadow: '0 4px 12px rgba(190, 24, 93, 0.25)',
  },
  scheduleHint: { margin: 0, fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, lineHeight: 1.35 },
  dayStaffCard: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
  },
  resetBtn: {
    minHeight: 38,
    padding: '0 0.65rem',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, margin: 0 },
};
