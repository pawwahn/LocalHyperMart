import { apiRequest, type PageData } from '@/shared/api/http';

export type SubOrderStatus =
  | 'PLACED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'AT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | string;

export type SubOrderDto = {
  subOrderId: string;
  subOrderNumber: string;
  orderId: string;
  orderNumber: string;
  vendorId: string;
  shopId: string;
  status: SubOrderStatus;
  subtotal: number;
  readyForPickupAt?: string | null;
  items?: Array<{
    name?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
};

export type DashboardDto = {
  orderCountToday: number;
  orderCountWeek: number;
  earningsGross: number;
  from?: string;
  to?: string;
  statusCounts?: Record<string, number>;
  recentOrders?: Array<{
    subOrderId: string;
    subOrderNumber: string;
    orderId: string;
    orderNumber: string;
    subtotal: number;
    status: SubOrderStatus;
    paymentMethod?: string;
    paymentStatus?: string;
    placedAt?: string;
    itemCount?: number;
  }>;
};

export type SubOrderView = {
  id: string;
  subOrderNumber: string;
  orderId: string;
  orderNumber: string;
  status: SubOrderStatus;
  subtotalLabel: string;
  itemSummary: string;
};

export type DashboardView = {
  ordersToday: number;
  ordersWeek: number;
  earningsLabel: string;
  statusCounts: Array<{ status: string; count: number }>;
  recent: SubOrderView[];
};

function money(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  return `₹${n.toFixed(2)}`;
}

export function toSubOrderView(dto: SubOrderDto): SubOrderView {
  const itemSummary =
    dto.items && dto.items.length > 0
      ? dto.items.map((i) => `${i.quantity ?? 1}× ${i.name ?? 'Item'}`).join(', ')
      : 'Items in order';
  return {
    id: dto.subOrderId,
    subOrderNumber: dto.subOrderNumber,
    orderId: dto.orderId,
    orderNumber: dto.orderNumber,
    status: dto.status,
    subtotalLabel: money(dto.subtotal),
    itemSummary,
  };
}

export function toDashboardView(dto: DashboardDto): DashboardView {
  const statusCounts = Object.entries(dto.statusCounts ?? {}).map(([status, count]) => ({
    status,
    count,
  }));
  const recent = (dto.recentOrders ?? []).map((r) => ({
    id: r.subOrderId,
    subOrderNumber: r.subOrderNumber,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    status: r.status,
    subtotalLabel: money(r.subtotal),
    itemSummary: `${r.itemCount ?? 0} item(s)`,
  }));
  return {
    ordersToday: dto.orderCountToday ?? 0,
    ordersWeek: dto.orderCountWeek ?? 0,
    earningsLabel: money(dto.earningsGross),
    statusCounts,
    recent,
  };
}

export async function fetchDashboard(token: string, vendorId: string): Promise<DashboardView> {
  const data = await apiRequest<DashboardDto>('/api/v1/orders/vendor/dashboard', {
    token,
    vendorId,
  });
  return toDashboardView(data);
}

export async function fetchSubOrders(
  token: string,
  vendorId: string,
  status?: string,
): Promise<SubOrderView[]> {
  const query = status ? `?status=${encodeURIComponent(status)}&page=0&size=50` : '?page=0&size=50';
  const data = await apiRequest<PageData<SubOrderDto>>(`/api/v1/orders/vendor/sub-orders${query}`, {
    token,
    vendorId,
  });
  return (data.items ?? []).map(toSubOrderView);
}

export async function markSubOrderReady(
  token: string,
  vendorId: string,
  subOrderId: string,
): Promise<SubOrderView> {
  const data = await apiRequest<SubOrderDto>(`/api/v1/orders/vendor/sub-orders/${subOrderId}/ready`, {
    method: 'POST',
    token,
    vendorId,
  });
  return toSubOrderView(data);
}

export async function rejectSubOrder(
  token: string,
  vendorId: string,
  subOrderId: string,
  reason: string,
): Promise<SubOrderView> {
  const data = await apiRequest<SubOrderDto>(`/api/v1/orders/vendor/sub-orders/${subOrderId}/reject`, {
    method: 'POST',
    token,
    vendorId,
    body: { reason },
  });
  return toSubOrderView(data);
}
