import { apiRequest } from '@/shared/api/http';

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
  townId: string;
  businessName: string;
  phone: string;
  vendorStatus: string;
  serviceName?: string | null;
  enabled: boolean;
  tagline?: string | null;
  yearsExperience?: number | null;
  ratingScore?: number | null;
  ratingCount?: number | null;
  homeVisitCharge?: number | null;
  studioAddress?: string | null;
  closedWeekdays?: string | null;
  blockedSlotDate?: string | null;
  blockedSlotIds?: string | null;
  slotDayOpen?: string | null;
  slotDayClose?: string | null;
  slotIntervalMinutes?: number | null;
  bookingMinPrepayAmount?: number | null;
  rates: BeautyRate[];
};

export type BeautyAdminOrder = {
  id: string;
  orderNumber: string;
  artistName: string;
  statusLabel: string;
  serviceLabel?: string | null;
  serviceAmount: number;
  travelCharge?: number | null;
  platformFeeAmount: number;
  codFee?: number | null;
  paymentStatus: string;
  venueLabel?: string | null;
};

export {
  BEAUTY_SERVICES,
  BEAUTY_SLOTS,
  buildBeautySlots,
  parseBlockedBeautySlotIds,
  scheduleFromArtist,
  slugCustomTreatmentCode,
  beautyServiceLabel,
} from '@hlm-beauty';

export async function fetchTownBeautyArtists(token: string, townId: string): Promise<BeautyArtist[]> {
  return apiRequest<BeautyArtist[]>(`/api/v1/vendors/beauty?townId=${townId}`, { token });
}

export async function saveTownBeautyArtist(
  token: string,
  vendorId: string,
  body: {
    enabled: boolean;
    tagline?: string;
    yearsExperience?: number;
    ratingScore?: number;
    ratingCount?: number;
    homeVisitCharge: number;
    studioAddress?: string;
    closedWeekdays: string;
    blockedSlotDate?: string;
    blockedSlotIds?: string;
    bookingMinPrepayAmount?: number;
    rates: BeautyRate[];
    customTreatments?: { serviceCode: string; label: string; hint?: string; emoji?: string }[];
  },
): Promise<BeautyArtist> {
  return apiRequest<BeautyArtist>(`/api/v1/vendors/beauty/${vendorId}`, { method: 'PUT', token, body });
}

export async function fetchAdminBeautyOrders(token: string, townId: string): Promise<BeautyAdminOrder[]> {
  return apiRequest<BeautyAdminOrder[]>(`/api/v1/orders/admin/beauty?townId=${townId}`, { token });
}
