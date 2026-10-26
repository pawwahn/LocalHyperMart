import { apiRequest } from '@/shared/api/http';
import {
  normalizeBeautySlotSchedule,
  parseStaffOverrides,
  scheduleFromArtist,
  serializeStaffOverrides,
} from '@hlm-beauty';

export type BeautyOrder = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  serviceType: string;
  serviceLabel?: string | null;
  venue: string;
  venueLabel?: string | null;
  serviceAmount: number;
  travelCharge?: number | null;
  platformFeeAmount: number;
  codFee?: number | null;
  parlourPaymentFee?: number | null;
  amountCollected?: number | null;
  amountDueTotal?: number | null;
  balanceDue?: number | null;
  prepayAmount?: number | null;
  prepayMode?: string | null;
  specialInstructions?: string | null;
  referencePhotoMediaId?: string | null;
  referencePhotoUrl?: string | null;
  addressText?: string | null;
  studioAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  slotStart?: string | null;
  slotEnd?: string | null;
  allowedActions?: string[];
};

const ACTION_LABEL: Record<string, string> = {
  EN_ROUTE: 'On the way',
  START: 'Start session',
  COMPLETE: 'Complete',
  CANCEL: 'Cancel booking',
};

export function beautyActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export async function fetchVendorBeautyOrders(token: string): Promise<BeautyOrder[]> {
  return apiRequest<BeautyOrder[]>(`/api/v1/orders/vendor/beauty`, { token });
}

export async function actOnBeautyOrder(
  token: string,
  orderId: string,
  body: { action: string; note?: string },
): Promise<BeautyOrder> {
  return apiRequest<BeautyOrder>(`/api/v1/orders/vendor/beauty/${orderId}/actions`, {
    method: 'POST',
    token,
    body,
  });
}

export type GlamScheduleCache = {
  dayOpen: string;
  dayClose: string;
  intervalMinutes: number;
  savedAt: number;
};

const GLAM_SCHEDULE_CACHE_PREFIX = 'hlm-glam-schedule:';

export function readGlamScheduleCache(vendorId: string): GlamScheduleCache | null {
  try {
    const raw = localStorage.getItem(`${GLAM_SCHEDULE_CACHE_PREFIX}${vendorId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GlamScheduleCache;
    if (!parsed?.dayOpen || !parsed?.dayClose || parsed.intervalMinutes == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGlamScheduleCache(vendorId: string, schedule: { dayOpen: string; dayClose: string; intervalMinutes: number }) {
  try {
    const payload: GlamScheduleCache = { ...schedule, savedAt: Date.now() };
    localStorage.setItem(`${GLAM_SCHEDULE_CACHE_PREFIX}${vendorId}`, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export type BeautyRateRow = {
  serviceType: string;
  label?: string | null;
  hint?: string | null;
  emoji?: string | null;
  unitPrice: number;
  durationMinutes: number;
  paused?: boolean;
};

export type BeautyProfile = {
  vendorId?: string;
  enabled?: boolean;
  blockedSlotDate?: string | null;
  blockedSlotIds?: string | null;
  blockedSlotsByDate?: string | null;
  staffCount?: number;
  slotDayOpen?: string | null;
  slotDayClose?: string | null;
  slotIntervalMinutes?: number | null;
  staffOverrides?: string | null | Record<string, unknown>;
  homeVisitCharge?: number | null;
  rates?: BeautyRateRow[];
};

/** Normalize glam profile from API (schedule + staffOverrides field shapes). */
export function normalizeBeautyProfile(row: BeautyProfile): BeautyProfile {
  const ext = row as BeautyProfile & {
    staff_overrides?: unknown;
    blocked_slots_by_date?: string | null;
    home_visit_charge?: number | null;
  };
  const raw = ext.staffOverrides ?? ext.staff_overrides;
  let staffOverrides: string | undefined;
  if (raw == null || raw === '') {
    staffOverrides = undefined;
  } else if (typeof raw === 'string') {
    staffOverrides = raw;
  } else if (typeof raw === 'object') {
    staffOverrides = serializeStaffOverrides(parseStaffOverrides(raw));
  }
  const schedule = scheduleFromArtist(row);
  const homeVisitRaw = row.homeVisitCharge ?? ext.home_visit_charge;
  const rates = (row.rates ?? []).map((rate) => ({
    ...rate,
    unitPrice: Number(rate.unitPrice ?? 0),
    durationMinutes: Number(rate.durationMinutes ?? 60),
    paused: Boolean(rate.paused),
  }));
  const next: BeautyProfile = {
    ...row,
    blockedSlotsByDate: row.blockedSlotsByDate ?? ext.blocked_slots_by_date ?? '{}',
    homeVisitCharge: homeVisitRaw == null ? 0 : Number(homeVisitRaw),
    rates,
    slotDayOpen: schedule.dayOpen,
    slotDayClose: schedule.dayClose,
    slotIntervalMinutes: schedule.intervalMinutes,
  };
  if (staffOverrides !== undefined) {
    next.staffOverrides = staffOverrides;
  }
  return next;
}

export function beautySchedulesEqual(
  a: ReturnType<typeof scheduleFromArtist>,
  b: ReturnType<typeof scheduleFromArtist>,
): boolean {
  return a.dayOpen === b.dayOpen && a.dayClose === b.dayClose && a.intervalMinutes === b.intervalMinutes;
}

/** Merge ops response; preserve staffOverrides when the server omits them. Schedule always comes from the API body. */
export function mergeBeautyProfileAfterOps(previous: BeautyProfile | null, saved: BeautyProfile): BeautyProfile {
  const normalized = normalizeBeautyProfile(saved);
  const schedule = scheduleFromArtist(normalized);
  const staffOverrides =
    normalized.staffOverrides ??
    (previous?.staffOverrides != null ? String(previous.staffOverrides) : undefined);
  return {
    ...normalized,
    slotDayOpen: schedule.dayOpen,
    slotDayClose: schedule.dayClose,
    slotIntervalMinutes: schedule.intervalMinutes,
    ...(staffOverrides !== undefined ? { staffOverrides } : null),
  };
}

/** Saved shop hours for forms — always what the server stored (not browser cache). */
export function glamScheduleForForm(row: BeautyProfile): ReturnType<typeof scheduleFromArtist> {
  return scheduleFromArtist(row);
}

export async function fetchMyBeautyProfile(token: string): Promise<BeautyProfile> {
  const row = await apiRequest<BeautyProfile>(`/api/v1/vendors/me/beauty`, { token });
  return normalizeBeautyProfile(row);
}

export async function saveBeautyRates(
  token: string,
  body: {
    rates: {
      serviceType: string;
      unitPrice: number;
      durationMinutes: number;
      paused?: boolean;
    }[];
    customTreatments?: { serviceCode: string; label: string; hint?: string; emoji?: string }[];
  },
): Promise<BeautyProfile> {
  const row = await apiRequest<BeautyProfile>(`/api/v1/vendors/me/beauty/rates`, { method: 'PUT', token, body });
  return normalizeBeautyProfile(row);
}

export async function saveBeautyOps(
  token: string,
  body: {
    blockedSlotIds?: string;
    blockedSlotDate?: string;
    staffCount?: number;
    slotDayOpen?: string;
    slotDayClose?: string;
    slotIntervalMinutes?: number;
    staffOverrideDate?: string;
    staffCountForDate?: number;
    homeVisitCharge?: number;
  },
): Promise<BeautyProfile> {
  const row = await apiRequest<BeautyProfile>(`/api/v1/vendors/me/beauty/ops`, { method: 'PUT', token, body });
  return normalizeBeautyProfile(row);
}

export {
  BEAUTY_SERVICES,
  BEAUTY_SLOTS,
  beautySlotIdFromIso,
  buildBeautySlots,
  istDateFromIso,
  normalizeBeautySlotSchedule,
  parseBlockedBeautySlotIds,
  blockedSlotIdsForDate,
  slugCustomTreatmentCode,
  trimBeautyTime,
  scheduleFromArtist,
  effectiveStaffForDate,
  parseStaffOverrides,
  serializeStaffOverrides,
  type BeautySlotRow,
} from '@hlm-beauty';
