import { apiRequest } from '@/shared/api/http';

export type NamedCount = { name: string; count: number; amount?: number };
export type DailyRow = { date: string; orders: number; delivered: number; cancelled: number; gmv: number };
export type TownRow = {
  townId: string;
  townName?: string | null;
  orders: number;
  delivered: number;
  cancelled: number;
  placedGmv: number;
  deliveredGmv: number;
  codGmv: number;
};
export type VendorRow = {
  vendorId: string;
  shopName: string;
  bags: number;
  ready: number;
  rejected: number;
  sales: number;
};

export type PlatformReport = {
  from: string;
  to: string;
  townId?: string | null;
  ordersPlaced: number;
  ordersDelivered: number;
  ordersCancelled: number;
  bagsRejected: number;
  uniqueBuyers: number;
  placedGmv: number;
  deliveredGmv: number;
  cancelledGmv: number;
  codGmv: number;
  onlineGmv: number;
  platformFees: number;
  promoDiscounts: number;
  averageOrderValue: number;
  deliveryRate: number;
  cancelRate: number;
  rejectRate: number;
  avgReadyMinutes?: number | null;
  avgDeliveryMinutes?: number | null;
  membershipDeliveriesWaived?: number;
  membershipFeeWaived?: number;
  statusMix: NamedCount[];
  paymentMix: NamedCount[];
  daily: DailyRow[];
  towns: TownRow[];
  vendors: VendorRow[];
  cancelReasons: NamedCount[];
};

export async function fetchPlatformReport(
  token: string,
  opts: { townId?: string; from?: string; to?: string },
): Promise<PlatformReport> {
  const params = new URLSearchParams();
  if (opts.townId) params.set('townId', opts.townId);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const q = params.toString();
  return apiRequest<PlatformReport>(`/api/v1/orders/admin/reports/platform${q ? `?${q}` : ''}`, { token });
}
