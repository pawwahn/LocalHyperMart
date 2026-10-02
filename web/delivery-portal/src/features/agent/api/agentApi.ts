import { apiRequest, type PageData } from '@/shared/api/http';
import type { AssignmentDto } from '@/features/hub/api/hubApi';

export type AssignmentView = {
  id: string;
  assignmentNumber: string;
  orderId: string;
  orderNumber: string;
  vendorSubOrderId: string | null;
  subOrderNumber: string | null;
  legType: string;
  status: string;
  label: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  destinationLabel: string | null;
  destinationName: string | null;
  destinationPhone: string | null;
  destinationAddress: string | null;
  paymentMethod?: string | null;
  collectCashAmount?: number | null;
  events: Array<{
    eventType: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

export function toAssignmentView(dto: AssignmentDto): AssignmentView {
  return {
    id: dto.assignmentId,
    assignmentNumber: dto.assignmentNumber ?? dto.assignmentId ?? '—',
    orderId: dto.orderId,
    orderNumber: dto.orderNumber ?? '—',
    vendorSubOrderId: dto.vendorSubOrderId ?? null,
    subOrderNumber: dto.subOrderNumber ?? null,
    legType: dto.legType,
    status: dto.status,
    label:
      dto.legType === 'PICKUP'
        ? `Vendor → Hub · ${dto.status}`
        : dto.legType === 'VENDOR_DIRECT'
          ? `Shop → Buyer · ${dto.status}`
          : `Hub → Buyer · ${dto.status}`,
    assignedAt: dto.assignedAt ?? null,
    startedAt: dto.startedAt ?? null,
    completedAt: dto.completedAt ?? null,
    destinationLabel: dto.destinationLabel ?? null,
    destinationName: dto.destinationName ?? null,
    destinationPhone: dto.destinationPhone ?? null,
    destinationAddress: dto.destinationAddress ?? null,
    paymentMethod: dto.paymentMethod ?? null,
    collectCashAmount:
      dto.collectCashAmount != null ? Number(dto.collectCashAmount) : null,
    events: (dto.events ?? []).map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      metadata: e.metadata ?? null,
    })),
  };
}

export type AgentShopAlertDto = {
  alertId: string;
  assignmentId: string;
  orderId: string;
  orderNumber?: string | null;
  vendorSubOrderId: string;
  subOrderNumber?: string | null;
  shopName?: string | null;
  status: string;
  createdAt?: string | null;
};

export async function fetchPendingAgentShopAlerts(token: string): Promise<AgentShopAlertDto[]> {
  const data = await apiRequest<AgentShopAlertDto[]>(
    '/api/v1/delivery/agents/me/agent-alerts?status=PENDING',
    { token },
  );
  return data ?? [];
}

export async function acknowledgeAgentShopAlert(
  token: string,
  alertId: string,
): Promise<AgentShopAlertDto> {
  return apiRequest<AgentShopAlertDto>(
    `/api/v1/delivery/agents/me/agent-alerts/${alertId}/acknowledge`,
    { method: 'POST', token },
  );
}

export type AgentPeriodStats = {
  shopPicked: number;
  droppedAtHub: number;
  homeDelivered: number;
  returnsToHub: number;
  cancelledPickups: number;
};

export type AgentStatsDto = {
  agentType?: 'HUB' | 'VENDOR' | string;
  vendorPickupsCollected: number;
  vendorPickupsAtHub: number;
  buyerDeliveriesCompleted: number;
  vendorPickupsCollectedToday: number;
  vendorPickupsAtHubToday: number;
  buyerDeliveriesCompletedToday: number;
  openShopPickups?: number;
  openHomeDeliveries?: number;
  returnsToHub?: number;
  returnsToHubToday?: number;
  today?: AgentPeriodStats;
  week?: AgentPeriodStats;
  month?: AgentPeriodStats;
  allTime?: AgentPeriodStats;
};

export type AgentStatsView = AgentStatsDto & {
  today: AgentPeriodStats;
  week: AgentPeriodStats;
  month: AgentPeriodStats;
  allTime: AgentPeriodStats;
};

function asPeriod(raw: unknown): AgentPeriodStats {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    shopPicked: Number(row.shopPicked ?? 0),
    droppedAtHub: Number(row.droppedAtHub ?? 0),
    homeDelivered: Number(row.homeDelivered ?? 0),
    returnsToHub: Number(row.returnsToHub ?? 0),
    cancelledPickups: Number(row.cancelledPickups ?? 0),
  };
}

export async function fetchMyStats(token: string): Promise<AgentStatsView> {
  const data = await apiRequest<AgentStatsDto>('/api/v1/delivery/agents/me/stats', { token });
  const allTime = asPeriod(data.allTime ?? {
    shopPicked: data.vendorPickupsCollected,
    droppedAtHub: data.vendorPickupsAtHub,
    homeDelivered: data.buyerDeliveriesCompleted,
    returnsToHub: data.returnsToHub ?? 0,
    cancelledPickups: 0,
  });
  const today = asPeriod(data.today ?? {
    shopPicked: data.vendorPickupsCollectedToday,
    droppedAtHub: data.vendorPickupsAtHubToday,
    homeDelivered: data.buyerDeliveriesCompletedToday,
    returnsToHub: data.returnsToHubToday ?? 0,
    cancelledPickups: 0,
  });
  return {
    ...data,
    vendorPickupsCollected: Number(data.vendorPickupsCollected ?? allTime.shopPicked),
    vendorPickupsAtHub: Number(data.vendorPickupsAtHub ?? allTime.droppedAtHub),
    buyerDeliveriesCompleted: Number(data.buyerDeliveriesCompleted ?? allTime.homeDelivered),
    vendorPickupsCollectedToday: Number(data.vendorPickupsCollectedToday ?? today.shopPicked),
    vendorPickupsAtHubToday: Number(data.vendorPickupsAtHubToday ?? today.droppedAtHub),
    buyerDeliveriesCompletedToday: Number(data.buyerDeliveriesCompletedToday ?? today.homeDelivered),
    openShopPickups: Number(data.openShopPickups ?? 0),
    openHomeDeliveries: Number(data.openHomeDeliveries ?? 0),
    returnsToHub: Number(data.returnsToHub ?? allTime.returnsToHub),
    returnsToHubToday: Number(data.returnsToHubToday ?? today.returnsToHub),
    today,
    week: asPeriod(data.week),
    month: asPeriod(data.month),
    allTime,
  };
}

export type AgentPaySummary = {
  agentId: string;
  agentName: string;
  townId: string;
  from: string;
  to: string;
  payEnabled: boolean;
  payModel?: 'HUB_NETWORK' | 'VENDOR_SHOP' | string;
  pickupRate: number;
  lastMileRate: number;
  completedOrderRate: number;
  vendorDirectOrderRate?: number;
  payableOrders: number;
  yourDeliveries?: number;
  unpaidOrderCount: number;
  earned: number;
  paid: number;
  due: number;
  unpaidOrders: Array<{
    orderId: string;
    orderNumber: string;
    deliveredAt?: string | null;
    amount: number;
    pickupCompleted: boolean;
    lastMileCompleted: boolean;
  }>;
  payouts: Array<{
    settlementId: string;
    status: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    netAmount: number;
    payoutMethod?: string | null;
    transactionReference?: string | null;
    paidAt?: string | null;
    orderCount: number;
  }>;
};

export async function fetchMyPay(
  token: string,
  from?: string,
  to?: string,
): Promise<AgentPaySummary> {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const data = await apiRequest<AgentPaySummary>(`/api/v1/payments/settlements/agent/me${suffix}`, { token });
  return {
    ...data,
    payModel: data.payModel ?? 'HUB_NETWORK',
    pickupRate: Number(data.pickupRate ?? 0),
    lastMileRate: Number(data.lastMileRate ?? 0),
    completedOrderRate: Number(data.completedOrderRate ?? 0),
    vendorDirectOrderRate: Number(data.vendorDirectOrderRate ?? 0),
    payableOrders: Number(data.payableOrders ?? 0),
    unpaidOrderCount: Number(data.unpaidOrderCount ?? 0),
    earned: Number(data.earned ?? 0),
    paid: Number(data.paid ?? 0),
    due: Number(data.due ?? 0),
    unpaidOrders: (data.unpaidOrders ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount ?? 0),
    })),
    payouts: (data.payouts ?? []).map((row) => ({
      ...row,
      netAmount: Number(row.netAmount ?? 0),
      orderCount: Number(row.orderCount ?? 0),
    })),
  };
}

export type PickupManifestLineView = {
  name: string;
  quantity: number;
  unitCode: string | null;
  lineTotal: number;
  shopName?: string | null;
};

export type PickupManifestView = {
  assignmentId: string;
  subOrderId: string;
  subOrderNumber: string;
  orderNumber: string;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  subtotal: number;
  totalItemCount: number;
  items: PickupManifestLineView[];
};

export type DeliveryManifestView = {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  paymentMethod?: 'COD' | 'ONLINE' | string | null;
  collectCashAmount?: number | null;
  subtotal: number;
  totalItemCount: number;
  items: PickupManifestLineView[];
};

function toPickupManifestView(dto: {
  assignmentId: string;
  subOrderId: string;
  subOrderNumber: string;
  orderNumber: string;
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  subtotal: number;
  totalItemCount: number;
  items: Array<{ name: string; quantity: number; unitCode?: string | null; lineTotal: number }>;
}): PickupManifestView {
  return {
    assignmentId: dto.assignmentId,
    subOrderId: dto.subOrderId,
    subOrderNumber: dto.subOrderNumber,
    orderNumber: dto.orderNumber,
    shopName: dto.shopName,
    shopAddress: dto.shopAddress ?? null,
    shopPhone: dto.shopPhone ?? null,
    subtotal: Number(dto.subtotal ?? 0),
    totalItemCount: dto.totalItemCount,
    items: (dto.items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitCode: item.unitCode ?? (item as { unit?: string | null }).unit ?? null,
      lineTotal: Number(item.lineTotal ?? 0),
    })),
  };
}

function isActiveStatus(status: string): boolean {
  return status === 'ASSIGNED' || status === 'IN_PROGRESS';
}

/** Supports paginated PageResponse and legacy flat array from older delivery-service builds. */
function normalizeAssignmentsPage(
  data: PageData<AssignmentDto> | AssignmentDto[],
  scope: 'active' | 'completed' | 'all',
  page: number,
  size: number,
): PageData<AssignmentDto> {
  if (!Array.isArray(data)) {
    return data;
  }

  const filtered =
    scope === 'completed'
      ? data.filter((row) => row.status === 'COMPLETED')
      : scope === 'active'
        ? data.filter((row) => isActiveStatus(row.status))
        : data;

  const start = page * size;
  const items = filtered.slice(start, start + size);
  const totalElements = filtered.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);

  return { items, page, size, totalElements, totalPages };
}

export async function fetchMyAssignments(
  token: string,
  options?: { scope?: 'active' | 'completed' | 'all'; page?: number; size?: number },
): Promise<PageData<AssignmentDto>> {
  const scope = options?.scope ?? 'active';
  const page = options?.page ?? 0;
  const size = options?.size ?? 20;
  const data = await apiRequest<PageData<AssignmentDto> | AssignmentDto[]>(
    `/api/v1/delivery/agents/me/assignments?scope=${scope}&page=${page}&size=${size}`,
    { token },
  );
  return normalizeAssignmentsPage(data, scope, page, size);
}

export async function fetchPickupManifest(token: string, assignmentId: string): Promise<PickupManifestView> {
  const data = await apiRequest<{
    assignmentId: string;
    subOrderId: string;
    subOrderNumber: string;
    orderNumber: string;
    shopName: string;
    subtotal: number;
    totalItemCount: number;
    items: Array<{ name: string; quantity: number; unitCode?: string | null; lineTotal: number }>;
  }>(`/api/v1/delivery/agents/me/assignments/${assignmentId}/pickup-manifest`, { token });
  return toPickupManifestView(data);
}

export async function fetchDeliveryManifest(token: string, assignmentId: string): Promise<DeliveryManifestView> {
  const data = await apiRequest<{
    assignmentId: string;
    orderId: string;
    orderNumber: string;
    paymentMethod?: string | null;
    collectCashAmount?: number | null;
    subtotal: number;
    totalItemCount: number;
    items: Array<{
      shopName?: string | null;
      name: string;
      quantity: number;
      unitCode?: string | null;
      lineTotal: number;
    }>;
  }>(`/api/v1/delivery/agents/me/assignments/${assignmentId}/delivery-manifest`, { token });
  return {
    assignmentId: data.assignmentId,
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    paymentMethod: data.paymentMethod ?? null,
    collectCashAmount: data.collectCashAmount != null ? Number(data.collectCashAmount) : null,
    subtotal: Number(data.subtotal ?? 0),
    totalItemCount: data.totalItemCount,
    items: (data.items ?? []).map((item) => ({
      shopName: item.shopName ?? null,
      name: item.name,
      quantity: item.quantity,
      unitCode: item.unitCode ?? null,
      lineTotal: Number(item.lineTotal ?? 0),
    })),
  };
}

export async function pickFromVendor(token: string, assignmentId: string, note?: string): Promise<AssignmentView> {
  const data = await apiRequest<AssignmentDto>(
    `/api/v1/delivery/assignments/${assignmentId}/picked-from-vendor`,
    { method: 'POST', token, body: { note: note || 'Picked' } },
  );
  return toAssignmentView(data);
}

export async function pickFromHub(token: string, assignmentId: string): Promise<AssignmentView> {
  const data = await apiRequest<AssignmentDto>(
    `/api/v1/delivery/assignments/${assignmentId}/picked-from-hub`,
    { method: 'POST', token },
  );
  return toAssignmentView(data);
}

export async function deliverOrder(
  token: string,
  assignmentId: string,
  otp: string,
  recipientName: string,
): Promise<AssignmentView> {
  const data = await apiRequest<AssignmentDto>(`/api/v1/delivery/assignments/${assignmentId}/deliver`, {
    method: 'POST',
    token,
    body: { otp, recipientName },
  });
  return toAssignmentView(data);
}
