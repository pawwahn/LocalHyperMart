import { apiRequest, type PageData } from '@/shared/api/http';

export type AdminOrderSummary = {
  orderId: string;
  orderNumber: string;
  townId?: string;
  buyerId: string;
  buyerPhone?: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  placedAt?: string;
  subOrderCount: number;
  readySubOrderCount: number;
};

export type AdminOrderDetail = {
  orderId: string;
  orderNumber: string;
  townId: string;
  buyerId: string;
  buyerPhone?: string | null;
  recipientName?: string | null;
  deliveryAddress?: string | null;
  status: string;
  paymentMethod?: string;
  paymentStatus: string;
  itemsSubtotal?: number;
  deliveryFee?: number;
  storeCreditApplied?: number;
  promoDiscount?: number;
  promoCode?: string | null;
  totalAmount: number;
  placedAt?: string;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  subOrders: Array<{
    subOrderId: string;
    subOrderNumber: string;
    vendorId: string;
    shopId?: string;
    shopName?: string | null;
    status: string;
    subtotal: number;
    itemCount: number;
    readyForPickupAt?: string | null;
    items?: Array<{
      name: string;
      unitCode?: string | null;
      quantity: number;
      lineTotal?: number;
      status?: string;
    }>;
  }>;
  assignments: Array<{
    assignmentId: string;
    assignmentNumber: string;
    orderNumber: string;
    subOrderNumber?: string | null;
    agentId: string;
    agentName?: string | null;
    agentPhone?: string | null;
    legType: string;
    status: string;
    assignedAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    events?: Array<{
      eventId: string;
      eventType: string;
      createdAt: string;
    }>;
  }>;
};

export async function listAdminOrders(
  token: string,
  opts: {
    townId?: string;
    buyerId?: string;
    status?: string;
    q?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<PageData<AdminOrderSummary>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 25;
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (opts.townId) params.set('townId', opts.townId);
  if (opts.buyerId) params.set('buyerId', opts.buyerId);
  if (opts.status) params.set('status', opts.status);
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  return apiRequest<PageData<AdminOrderSummary>>(`/api/v1/orders/admin?${params}`, { token });
}

export async function fetchAdminOrderDetail(
  token: string,
  townId: string,
  orderId: string,
): Promise<AdminOrderDetail> {
  return apiRequest<AdminOrderDetail>(
    `/api/v1/orders/admin/${orderId}?townId=${encodeURIComponent(townId)}`,
    { token },
  );
}

export function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function shortOrderNo(orderNumber: string): string {
  const parts = orderNumber.split('/');
  return parts[parts.length - 1] || orderNumber;
}

export function labelStatus(raw?: string | null): string {
  if (!raw) return '—';
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelLeg(leg?: string | null): string {
  if (leg === 'LAST_MILE') return 'To buyer';
  if (leg === 'PICKUP') return 'Shop → hub';
  return labelStatus(leg);
}

export function labelEvent(eventType?: string | null): string {
  const map: Record<string, string> = {
    PICKUP_ASSIGNED: 'Pickup assigned',
    LAST_MILE_ASSIGNED: 'Last-mile assigned',
    PICKED_FROM_VENDOR: 'Picked from shop',
    PICKED_FROM_HUB: 'Picked from hub',
    AT_HUB: 'Arrived at hub',
    DELIVERED: 'Delivered',
    BUYER_REJECTED: 'Buyer rejected',
    REASSIGNED: 'Reassigned',
  };
  if (!eventType) return '—';
  return map[eventType] ?? labelStatus(eventType);
}
