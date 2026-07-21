import { apiRequest, type PageData } from '@/shared/api/http';

export type SubOrderStatus =
  | 'PLACED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'AT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'VENDOR_REJECTED'
  | 'CANCELLED'
  | string;

export type SubOrderItemDto = {
  orderItemId?: string;
  name?: string;
  shopName?: string;
  unitCode?: string;
  quantity?: number;
  lineTotal?: number;
  status?: string;
  cancelReason?: string;
  storeCreditAmount?: number;
};

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
  items?: SubOrderItemDto[];
};

export type DashboardDto = {
  orderCountToday: number;
  orderCountWeek: number;
  earningsGross: number;
  earningsToday?: number;
  pendingActionCount?: number;
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

export type SubOrderItemView = {
  orderItemId: string;
  name: string;
  quantity: number;
  unitCode?: string;
  lineTotalLabel: string;
  status: string;
  cancelled: boolean;
  storeCreditAmount?: number;
  /** True when vendor may offer Restore (before pickup). */
  canRestore: boolean;
};

export type SubOrderView = {
  id: string;
  subOrderNumber: string;
  orderId: string;
  orderNumber: string;
  status: SubOrderStatus;
  subtotalLabel: string;
  itemSummary: string;
  items: SubOrderItemView[];
};

export type DashboardView = {
  ordersToday: number;
  ordersWeek: number;
  earningsLabel: string;
  earningsTodayLabel: string;
  earningsToday: number;
  pendingActionCount: number;
  statusCounts: Array<{ status: string; count: number }>;
  recent: SubOrderView[];
  recentSubOrderIds: string[];
};

function money(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  return `₹${n.toFixed(2)}`;
}

function toItemView(item: SubOrderItemDto, subOrderStatus: SubOrderStatus): SubOrderItemView | null {
  if (!item.orderItemId) return null;
  const status = (item.status ?? 'ACTIVE').toUpperCase();
  const cancelled = status === 'CANCELLED';
  const restorableParent =
    subOrderStatus === 'PLACED' ||
    subOrderStatus === 'READY_FOR_PICKUP' ||
    subOrderStatus === 'VENDOR_REJECTED';
  return {
    orderItemId: item.orderItemId,
    name: item.name ?? 'Item',
    quantity: item.quantity ?? 1,
    unitCode: item.unitCode || undefined,
    lineTotalLabel: money(item.lineTotal),
    status,
    cancelled,
    storeCreditAmount: item.storeCreditAmount,
    canRestore: cancelled && restorableParent,
  };
}

export function toSubOrderView(dto: SubOrderDto): SubOrderView {
  const items = (dto.items ?? [])
    .map((item) => toItemView(item, dto.status))
    .filter((i): i is SubOrderItemView => i != null);
  const itemSummary =
    items.length > 0
      ? items
          .map((i) => {
            const unit = i.unitCode ? ` ${i.unitCode.toLowerCase()}` : '';
            const mark = i.cancelled ? ' (cancelled)' : '';
            return `${i.quantity}${unit}× ${i.name}${mark}`;
          })
          .join(', ')
      : dto.items && dto.items.length > 0
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
    items,
  };
}

export function toDashboardView(dto: DashboardDto): DashboardView {
  const statusCounts = Object.entries(dto.statusCounts ?? {}).map(([status, count]) => ({
    status,
    count,
  }));
  const recentOrders = dto.recentOrders ?? [];
  const recent = recentOrders.map((r) => ({
    id: r.subOrderId,
    subOrderNumber: r.subOrderNumber,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    status: r.status,
    subtotalLabel: money(r.subtotal),
    itemSummary: `${r.itemCount ?? 0} item(s)`,
    items: [] as SubOrderItemView[],
  }));
  return {
    ordersToday: dto.orderCountToday ?? 0,
    ordersWeek: dto.orderCountWeek ?? 0,
    earningsLabel: money(dto.earningsGross),
    earningsTodayLabel: money(dto.earningsToday),
    earningsToday: Number(dto.earningsToday ?? 0),
    pendingActionCount: Number(dto.pendingActionCount ?? dto.statusCounts?.PLACED ?? 0),
    statusCounts,
    recent,
    recentSubOrderIds: recentOrders.map((r) => r.subOrderId),
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

export async function cancelSubOrderItem(
  token: string,
  vendorId: string,
  subOrderId: string,
  itemId: string,
  reason: string,
): Promise<SubOrderView> {
  const data = await apiRequest<SubOrderDto>(
    `/api/v1/orders/vendor/sub-orders/${subOrderId}/items/${itemId}/cancel`,
    {
      method: 'POST',
      token,
      vendorId,
      body: { reason },
    },
  );
  return toSubOrderView(data);
}

export async function restoreSubOrderItem(
  token: string,
  vendorId: string,
  subOrderId: string,
  itemId: string,
): Promise<SubOrderView> {
  const data = await apiRequest<SubOrderDto>(
    `/api/v1/orders/vendor/sub-orders/${subOrderId}/items/${itemId}/restore`,
    {
      method: 'POST',
      token,
      vendorId,
    },
  );
  return toSubOrderView(data);
}
