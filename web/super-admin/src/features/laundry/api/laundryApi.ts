import { apiRequest } from '@/shared/api/http';

export type LaundryRate = { serviceType: string; itemType: string; unitPrice: number; paused?: boolean };

export type LaundryShop = {
  vendorId: string;
  townId: string;
  businessName: string;
  phone: string;
  vendorStatus: string;
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

export type LaundryAdminOrder = {
  id: string;
  orderNumber: string;
  shopName: string;
  statusLabel: string;
  goodsAmount: number;
  platformFeeAmount: number;
  codFee?: number | null;
  paymentStatus: string;
  pieceCount: number;
};

export { LAUNDRY_ITEMS, LAUNDRY_SERVICES } from '@hlm-laundry';

export async function fetchTownLaundryShops(token: string, townId: string): Promise<LaundryShop[]> {
  return apiRequest<LaundryShop[]>(`/api/v1/vendors/laundry?townId=${townId}`, { token });
}

export async function saveTownLaundryShop(
  token: string,
  vendorId: string,
  body: {
    enabled: boolean;
    priceEditAllowed: boolean;
    dailyPieceCapacity?: number;
    clearDailyPieceCapacity?: boolean;
    closedWeekdays: string;
    pickupCharge: number;
    dropCharge: number;
    pickupAndDropCharge: number;
    rates: LaundryRate[];
  },
): Promise<LaundryShop> {
  return apiRequest<LaundryShop>(`/api/v1/vendors/laundry/${vendorId}`, { method: 'PUT', token, body });
}

export async function fetchAdminLaundryOrders(token: string, townId: string): Promise<LaundryAdminOrder[]> {
  return apiRequest<LaundryAdminOrder[]>(`/api/v1/orders/admin/laundry?townId=${townId}`, { token });
}
