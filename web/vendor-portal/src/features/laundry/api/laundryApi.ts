import { apiRequest } from '@/shared/api/http';

export type LaundryRate = { serviceType: string; itemType: string; unitPrice: number; paused?: boolean };

export type LaundryProfile = {
  vendorId: string;
  businessName: string;
  enabled: boolean;
  priceEditAllowed: boolean;
  dailyPieceCapacity?: number | null;
  closedWeekdays?: string | null;
  pickupCharge?: number | null;
  dropCharge?: number | null;
  pickupAndDropCharge?: number | null;
  feeModel?: string | null;
  perPieceAmount?: number | null;
  perOrderFlatAmount?: number | null;
  rates: LaundryRate[];
};

export type LaundryOrder = {
  id: string;
  orderNumber: string;
  logistics: string;
  status: string;
  statusLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  goodsAmount: number;
  logisticsCharge?: number | null;
  amountCollected: number;
  platformFeeAmount: number;
  codFee?: number | null;
  pieceCount: number;
  specialInstructions?: string | null;
  addressText: string;
  contactName?: string | null;
  contactPhone?: string | null;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  estimatedReadyAt?: string | null;
  buyerComment?: string | null;
  vendorComment?: string | null;
  allowedActions: string[];
  lines: Array<{
    id: string;
    serviceType: string;
    itemType: string;
    otherLabel?: string | null;
    quantity: number;
    confirmedQuantity: number;
    unitPrice: number;
    conditionNote?: string | null;
    photoUrl?: string | null;
  }>;
};

import { LAUNDRY_ITEMS, LAUNDRY_SERVICES } from '@hlm-laundry';

export { LAUNDRY_ITEMS, LAUNDRY_SERVICES };

export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export function laundryItemLabel(itemType: string, otherLabel?: string | null): string {
  if (itemType === 'OTHER' && otherLabel?.trim()) return otherLabel.trim();
  return LAUNDRY_ITEMS.find((item) => item.id === itemType)?.label ?? itemType;
}

export function laundryServiceLabel(serviceType: string): string {
  return LAUNDRY_SERVICES.find((service) => service.id === serviceType)?.label ?? serviceType;
}

export function laundryTripLabel(logistics: string): string {
  if (logistics === 'PICKUP_AND_DROP') return 'Pickup & drop';
  if (logistics === 'PICKUP_ONLY') return 'Pickup only';
  if (logistics === 'DROP_ONLY') return 'Drop only';
  return logistics;
}

export function laundryPayLabel(status: string): string {
  if (status === 'DUE') return 'Due';
  if (status === 'COLLECTED') return 'Collected';
  if (status === 'EXTRA_DUE') return 'Extra due';
  if (status === 'REFUND_DUE') return 'Refund due';
  return status;
}

export async function fetchMyLaundry(token: string): Promise<LaundryProfile> {
  return apiRequest<LaundryProfile>('/api/v1/vendors/me/laundry', { token });
}

export async function saveLaundryRates(
  token: string,
  body: {
    rates: LaundryRate[];
    pickupCharge: number;
    dropCharge: number;
    pickupAndDropCharge: number;
  },
): Promise<LaundryProfile> {
  return apiRequest<LaundryProfile>('/api/v1/vendors/me/laundry/rates', { method: 'PUT', token, body });
}

export async function saveLaundryOps(
  token: string,
  body: { dailyPieceCapacity?: number; clearDailyPieceCapacity?: boolean; closedWeekdays: string },
): Promise<LaundryProfile> {
  return apiRequest<LaundryProfile>('/api/v1/vendors/me/laundry/ops', { method: 'PUT', token, body });
}

export async function fetchVendorLaundryOrders(token: string): Promise<LaundryOrder[]> {
  return apiRequest<LaundryOrder[]>('/api/v1/orders/vendor/laundry', { token });
}

export async function actOnLaundryOrder(
  token: string,
  orderId: string,
  body: {
    action: string;
    note?: string;
    pickupSlotStart?: string;
    pickupSlotEnd?: string;
    estimatedReadyAt?: string;
    lines?: Array<{ lineId: string; confirmedQuantity?: number; unitPrice?: number; conditionNote?: string }>;
  },
): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>(`/api/v1/orders/vendor/laundry/${orderId}/actions`, {
    method: 'POST',
    token,
    body,
  });
}
