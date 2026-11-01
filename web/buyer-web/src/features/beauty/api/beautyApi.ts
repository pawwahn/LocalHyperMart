import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/shared/api/http';
import { scheduleFromArtist } from '@hlm-beauty';
import { normalizeServiceFor, type VendorServiceFor } from '@hlm-vendor';

export type BeautyWorkPhoto = {
  mediaId: string;
  url: string;
};

export type BeautyCustomerReview = {
  stars: number;
  comment: string;
  createdAt?: string | null;
};

export type BeautyRate = {
  serviceType: string;
  label?: string | null;
  hint?: string | null;
  emoji?: string | null;
  unitPrice: number;
  durationMinutes: number;
  paused?: boolean;
};

export type BeautyArtist = {
  vendorId: string;
  businessName: string;
  serviceFor?: 'MALE' | 'FEMALE' | 'UNISEX' | string | null;
  phone?: string | null;
  tagline?: string | null;
  yearsExperience?: number | null;
  ratingScore?: number | null;
  ratingCount?: number | null;
  homeVisitCharge?: number | null;
  studioAddress?: string | null;
  closedWeekdays?: string | null;
  blockedSlotDate?: string | null;
  blockedSlotIds?: string | null;
  blockedSlotsByDate?: string | null;
  staffCount?: number;
  slotDayOpen?: string | null;
  slotDayClose?: string | null;
  slotIntervalMinutes?: number | null;
  bookingMinPrepayAmount?: number | null;
  workPhotos?: BeautyWorkPhoto[];
  customerReviews?: BeautyCustomerReview[];
  rates: BeautyRate[];
};

export type BeautySlotAvailability = {
  slotId: string;
  booked: number;
  capacity: number;
  manuallyBlocked: boolean;
};

export type BeautyAvailability = {
  vendorId: string;
  date: string;
  staffCount: number;
  slotDayOpen?: string;
  slotDayClose?: string;
  slotIntervalMinutes?: number;
  slots: BeautySlotAvailability[];
};

export type BeautyOrder = {
  id: string;
  orderNumber: string;
  artistName: string;
  occasion?: string | null;
  serviceType: string;
  serviceTypes?: string | null;
  serviceLabel?: string | null;
  bookedServiceLabels?: string[];
  venue: string;
  venueLabel?: string | null;
  status: string;
  statusLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  serviceAmount: number;
  travelCharge?: number | null;
  platformFeeAmount: number;
  codFee?: number | null;
  parlourPaymentFee?: number | null;
  amountCollected: number;
  amountDueTotal?: number;
  balanceDue?: number;
  prepayAmount?: number | null;
  durationMinutes: number;
  specialInstructions?: string | null;
  referencePhotoMediaId?: string | null;
  referencePhotoUrl?: string | null;
  addressText?: string | null;
  studioAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  slotStart?: string | null;
  slotEnd?: string | null;
  placedAt?: string | null;
  completedAt?: string | null;
  prepayMode?: string | null;
  myRatingStars?: number | null;
  myRatingComment?: string | null;
  canRateBooking?: boolean;
  allowedActions?: string[];
  payment?: {
    paymentId?: string;
    checkout?: {
      gatewayOrderId?: string | null;
      keyId?: string | null;
      gatewayKey?: string | null;
      paymentSessionId?: string | null;
      redirectUrl?: string | null;
      amountPaise?: number | null;
      currency?: string | null;
      gateway?: string | null;
      name?: string | null;
      description?: string | null;
    } | null;
  } | null;
};

export {
  BEAUTY_OCCASIONS,
  BEAUTY_SERVICES,
  BEAUTY_VENUES,
  BEAUTY_LEAD_MS,
  BEAUTY_SLOTS,
  buildBeautySlots,
  beautyOccasionLabel,
  scheduleFromArtist,
  beautyServiceLabel,
  type BeautySlotRow,
  beautyVenueLabel,
  parseBlockedBeautySlotIds,
  blockedSlotIdsForDate,
  type BeautySlotId,
} from '@hlm-beauty';

export function normalizeBeautyArtist(row: BeautyArtist): BeautyArtist {
  const ext = row as BeautyArtist & {
    blocked_slots_by_date?: string | null;
    service_for?: string | null;
  };
  const sch = scheduleFromArtist(row);
  const serviceFor =
    normalizeServiceFor(row.serviceFor ?? ext.service_for) ?? ('UNISEX' as VendorServiceFor);
  const workPhotos = (row.workPhotos ?? []).map((photo) => ({
    mediaId: String(photo.mediaId),
    url: photo.url,
  }));
  const extReviews = (row as BeautyArtist & { customer_reviews?: BeautyCustomerReview[] }).customer_reviews;
  return {
    ...row,
    serviceFor,
    blockedSlotsByDate: row.blockedSlotsByDate ?? ext.blocked_slots_by_date ?? '{}',
    slotDayOpen: sch.dayOpen,
    slotDayClose: sch.dayClose,
    slotIntervalMinutes: sch.intervalMinutes,
    workPhotos,
    customerReviews: row.customerReviews ?? extReviews ?? [],
  };
}

export function fetchBeautyArtists(token: string, townId: string): Promise<BeautyArtist[]> {
  return apiRequest<BeautyArtist[]>(`/api/v1/orders/beauty/artists?townId=${townId}`, { token }).then((rows) =>
    (rows ?? []).map((row) => normalizeBeautyArtist(row)),
  );
}

export type BeautyVendorReviewsSummary = {
  avgStars: number;
  totalRatings: number;
  reviewsWithComments: number;
  stars5: number;
  stars4: number;
  stars3: number;
  stars2: number;
  stars1: number;
};

export type BeautyVendorReviewsPage = {
  summary: BeautyVendorReviewsSummary;
  reviews: {
    items: BeautyCustomerReview[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
};

export function fetchVendorBeautyReviews(
  token: string,
  vendorId: string,
  page = 0,
  size = 12,
): Promise<BeautyVendorReviewsPage> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  return apiRequest<BeautyVendorReviewsPage>(`/api/v1/orders/beauty/vendors/${vendorId}/reviews?${q}`, { token });
}

export function normalizeBeautyAvailability(payload: BeautyAvailability): BeautyAvailability {
  const sch = scheduleFromArtist({
    slotDayOpen: payload.slotDayOpen,
    slotDayClose: payload.slotDayClose,
    slotIntervalMinutes: payload.slotIntervalMinutes,
  });
  return {
    ...payload,
    slotDayOpen: sch.dayOpen,
    slotDayClose: sch.dayClose,
    slotIntervalMinutes: sch.intervalMinutes,
    slots: (payload.slots ?? []).map((row) => {
      const ext = row as BeautySlotAvailability & { manually_blocked?: boolean };
      return {
        ...row,
        manuallyBlocked: Boolean(row.manuallyBlocked ?? ext.manually_blocked),
      };
    }),
  };
}

export function fetchBeautyAvailability(
  token: string,
  vendorId: string,
  date: string,
): Promise<BeautyAvailability> {
  const q = new URLSearchParams({ vendorId, date });
  return apiRequest<BeautyAvailability>(`/api/v1/orders/beauty/availability?${q}`, { token }).then((row) =>
    normalizeBeautyAvailability(row),
  );
}

export function fetchMyBeautyOrders(token: string, townId: string): Promise<BeautyOrder[]> {
  return apiRequest<BeautyOrder[]>(`/api/v1/orders/beauty?townId=${townId}`, { token });
}

export function fetchBeautyOrder(token: string, orderId: string): Promise<BeautyOrder> {
  return apiRequest<BeautyOrder>(`/api/v1/orders/beauty/${orderId}`, { token });
}

export function placeBeautyOrder(
  token: string,
  body: {
    townId: string;
    vendorId: string;
    serviceType?: string;
    serviceTypes?: string[];
    occasion?: string;
    venue: string;
    paymentMethod: string;
    prepayMode?: 'FULL' | 'PARTIAL';
    paymentGateway?: string;
    /** 10-digit mobile for Cashfree (studio bookings). */
    contactPhone?: string;
    specialInstructions?: string;
    referencePhotoMediaId?: string;
    addressId?: string;
    slotStart: string;
    slotEnd: string;
  },
): Promise<BeautyOrder> {
  return apiRequest<BeautyOrder>('/api/v1/orders/beauty', { method: 'POST', token, body });
}

function apiBase(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Capacitor.isNativePlatform()) return 'http://10.0.2.2:8080';
  return '';
}

export async function uploadBeautyReferencePhoto(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'BEAUTY_REFERENCE');
  const response = await fetch(`${apiBase()}/api/v1/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const payload = (await response.json()) as { message?: string; data?: { mediaId?: string } };
  if (!response.ok || !payload.data?.mediaId) {
    throw new Error(payload.message || 'Photo upload failed');
  }
  return payload.data.mediaId;
}

export function rateBeautyBooking(
  token: string,
  orderId: string,
  body: { stars: number; comment?: string },
): Promise<BeautyOrder> {
  return apiRequest<BeautyOrder>(`/api/v1/orders/beauty/${orderId}/rating`, { method: 'POST', token, body });
}

export function cancelBeautyOrder(token: string, orderId: string): Promise<BeautyOrder> {
  return apiRequest<BeautyOrder>(`/api/v1/orders/beauty/${orderId}/cancel`, { method: 'POST', token, body: {} });
}

export function retryBeautyPayment(token: string, orderId: string, gateway?: string) {
  const query = gateway ? `?gateway=${encodeURIComponent(gateway)}` : '';
  return apiRequest(`/api/v1/orders/beauty/${orderId}/payments/retry${query}`, {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': `beauty-retry-${orderId}-${Date.now()}` },
  });
}
