import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/shared/api/http';

export type LaundryRate = {
  serviceType: string;
  itemType: string;
  unitPrice: number;
  paused?: boolean;
};

export type LaundryShop = {
  vendorId: string;
  businessName: string;
  phone?: string;
  pickupCharge?: number | null;
  dropCharge?: number | null;
  pickupAndDropCharge?: number | null;
  feeModel?: string | null;
  perPieceAmount?: number | null;
  perOrderFlatAmount?: number | null;
  rates: LaundryRate[];
};

export type LaundryLine = {
  id: string;
  serviceType: string;
  itemType: string;
  otherLabel?: string | null;
  quantity: number;
  confirmedQuantity: number;
  unitPrice: number;
  lineAmount: number;
  conditionNote?: string | null;
  photoUrl?: string | null;
  photoDeleted?: boolean;
};

export type LaundryOrder = {
  id: string;
  orderNumber: string;
  shopName: string;
  logistics: string;
  status: string;
  statusLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  goodsAmount: number;
  logisticsCharge?: number | null;
  platformFeeAmount?: number;
  codFee?: number | null;
  amountCollected: number;
  pieceCount: number;
  specialInstructions?: string | null;
  addressText: string;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  estimatedReadyAt?: string | null;
  buyerComment?: string | null;
  vendorComment?: string | null;
  walletCredited?: number | null;
  complaintOpen: boolean;
  placedAt: string;
  deliveredAt?: string | null;
  slaMessage: string;
  allowedActions: string[];
  lines: LaundryLine[];
  payment?: {
    paymentId?: string;
    checkout?: {
      keyId?: string | null;
      gatewayOrderId: string;
      amountPaise: number;
      currency: string;
      name: string;
      description?: string | null;
      prefillContact?: string | null;
      logoUrl?: string | null;
    } | null;
  } | null;
};

import { LAUNDRY_ITEMS, LAUNDRY_SERVICES } from '@hlm-laundry';

export { LAUNDRY_ITEMS, LAUNDRY_SERVICES };

export const LOGISTICS = [
  { id: 'PICKUP_AND_DROP', label: 'Pickup and drop' },
  { id: 'PICKUP_ONLY', label: 'Pickup only' },
  { id: 'DROP_ONLY', label: 'Drop only' },
] as const;

export function laundryLabel(kind: 'service' | 'item' | 'logistics', id: string): string {
  const list = kind === 'service' ? LAUNDRY_SERVICES : kind === 'item' ? LAUNDRY_ITEMS : LOGISTICS;
  return list.find((row) => row.id === id)?.label ?? id;
}

export async function fetchLaundryShops(token: string, townId: string): Promise<LaundryShop[]> {
  return apiRequest<LaundryShop[]>(`/api/v1/orders/laundry/shops?townId=${townId}`, { token });
}

export async function fetchMyLaundryOrders(token: string, townId: string): Promise<LaundryOrder[]> {
  return apiRequest<LaundryOrder[]>(`/api/v1/orders/laundry?townId=${townId}`, { token });
}

export async function fetchLaundryOrder(token: string, orderId: string): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>(`/api/v1/orders/laundry/${orderId}`, { token });
}

export async function retryLaundryPayment(
  token: string,
  orderId: string,
  gateway?: string,
): Promise<NonNullable<LaundryOrder['payment']>> {
  const query = gateway ? `?gateway=${encodeURIComponent(gateway)}` : '';
  return apiRequest(`/api/v1/orders/laundry/${orderId}/payments/retry${query}`, {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': `laundry-retry-${orderId}-${Date.now()}` },
  });
}

export async function saveLaundryComment(token: string, orderId: string, comment: string): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>(`/api/v1/orders/laundry/${orderId}/comment`, {
    method: 'POST',
    token,
    body: { comment },
  });
}

export async function placeLaundryOrder(
  token: string,
  body: {
    townId: string;
    vendorId: string;
    addressId: string;
    logistics: string;
    paymentMethod: string;
    paymentGateway?: string;
    specialInstructions?: string;
    slaAcknowledged: boolean;
    requestedPickupStart?: string;
    requestedPickupEnd?: string;
    lines: Array<{
      serviceType: string;
      itemType: string;
      quantity: number;
      otherLabel?: string;
      photoMediaId?: string;
    }>;
  },
): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>('/api/v1/orders/laundry', { method: 'POST', token, body });
}

export async function cancelLaundryOrder(token: string, orderId: string): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>(`/api/v1/orders/laundry/${orderId}/cancel`, { method: 'POST', token, body: {} });
}

export async function setLaundryComplaint(token: string, orderId: string, open: boolean, note?: string): Promise<LaundryOrder> {
  return apiRequest<LaundryOrder>(`/api/v1/orders/laundry/${orderId}/complaint`, {
    method: 'POST',
    token,
    body: { open: String(open), note },
  });
}

function apiBase(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Capacitor.isNativePlatform()) return 'http://10.0.2.2:8080';
  return '';
}

export async function uploadLaundryPhoto(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'LAUNDRY_ITEM');
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
