import { apiRequest, type PageData } from '@/shared/api/http';

export type HubMeDto = {
  hubId: string;
  townId: string;
  hubName: string;
  address?: string;
  phone?: string;
};

export type HubDashboardDto = {
  hubId: string;
  townId: string;
  hubName: string;
  activeAgents: number;
  orders: { readyForPickup: number; placedAwaitingDelivery: number };
  pickups: { assigned: number; inProgress: number; completedToday: number };
  lastMile: { assigned: number; inProgress: number; completedToday: number };
  activeAssignments: number;
};

export type AdminOrderDto = {
  orderId: string;
  orderNumber: string;
  buyerId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  placedAt?: string;
  subOrderCount: number;
  readySubOrderCount: number;
};

export type AdminOrderDetailDto = {
  orderId: string;
  orderNumber: string;
  townId: string;
  status: string;
  totalAmount: number;
  placedAt?: string;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  subOrders: Array<{
    subOrderId: string;
    subOrderNumber: string;
    vendorId: string;
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
    legType: string;
    status: string;
    assignedAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    events?: Array<{
      eventId: string;
      eventType: string;
      createdAt: string;
      createdBy?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  }>;
};

export type AssignmentDto = {
  assignmentId: string;
  assignmentNumber: string;
  orderId: string;
  orderNumber: string;
  vendorSubOrderId?: string | null;
  subOrderNumber?: string | null;
  townId: string;
  hubId: string;
  agentId: string;
  legType: string;
  status: string;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  events?: Array<{
    eventId: string;
    eventType: string;
    createdAt: string;
    createdBy?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
};

export type HubDashboardView = {
  hubName: string;
  hubId: string;
  townId: string;
  activeAgents: number;
  readyForPickup: number;
  awaitingDelivery: number;
  activeAssignments: number;
  pickupAssigned: number;
  lastMileAssigned: number;
};

export type OrderRowView = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalLabel: string;
  subOrderCount: number;
  readySubOrderCount: number;
  pickupReadiness: 'none' | 'partial' | 'all';
};

export type SubOrderItemView = {
  name: string;
  quantity: number;
  unitCode?: string;
  lineTotalLabel?: string;
};

export type SubOrderRowView = {
  id: string;
  subOrderNumber: string;
  shopName: string;
  status: string;
  subtotalLabel: string;
  itemCount: number;
  vendorId: string;
  items: SubOrderItemView[];
};

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

export function toHubDashboardView(dto: HubDashboardDto): HubDashboardView {
  return {
    hubName: dto.hubName,
    hubId: dto.hubId,
    townId: dto.townId,
    activeAgents: dto.activeAgents ?? 0,
    readyForPickup: dto.orders?.readyForPickup ?? 0,
    awaitingDelivery: dto.orders?.placedAwaitingDelivery ?? 0,
    activeAssignments: dto.activeAssignments ?? 0,
    pickupAssigned: dto.pickups?.assigned ?? 0,
    lastMileAssigned: dto.lastMile?.assigned ?? 0,
  };
}

export function toOrderRow(dto: AdminOrderDto): OrderRowView {
  const ready = dto.readySubOrderCount ?? 0;
  const total = dto.subOrderCount ?? 0;
  const pickupReadiness: OrderRowView['pickupReadiness'] =
    ready <= 0 ? 'none' : ready >= total ? 'all' : 'partial';
  return {
    id: dto.orderId,
    orderNumber: dto.orderNumber,
    status: dto.status,
    paymentStatus: dto.paymentStatus,
    totalLabel: money(dto.totalAmount),
    subOrderCount: total,
    readySubOrderCount: ready,
    pickupReadiness,
  };
}

export async function fetchMyHub(token: string): Promise<HubMeDto> {
  return apiRequest<HubMeDto>('/api/v1/delivery/hubs/me', { token });
}

export async function fetchHubDashboard(token: string, hubId: string): Promise<HubDashboardView> {
  const data = await apiRequest<HubDashboardDto>(`/api/v1/delivery/hubs/${hubId}/dashboard`, { token });
  return toHubDashboardView(data);
}

export type HubReportDto = {
  hubId: string;
  townId: string;
  hubName: string;
  from: string;
  to: string;
  ordersPlaced: number;
  ordersDelivered: number;
  ordersCancelled: number;
  subOrdersPlaced: number;
  bagsMarkedReady: number;
  shopPickupsCompleted: number;
  homeDeliveriesCompleted: number;
  agents: Array<{
    agentId: string;
    name: string;
    phone: string;
    status: string;
    shopPickupsCompleted: number;
    homeDeliveriesCompleted: number;
    totalCompleted: number;
  }>;
};

export async function fetchHubReport(
  token: string,
  hubId: string,
  from: string,
  to: string,
): Promise<HubReportDto> {
  return apiRequest<HubReportDto>(
    `/api/v1/delivery/hubs/${hubId}/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { token },
  );
}

export async function fetchAdminOrders(
  token: string,
  townId: string,
  options?: { page?: number; size?: number; status?: string },
): Promise<PageData<AdminOrderDto>> {
  const page = options?.page ?? 0;
  const size = options?.size ?? 20;
  const statusQ = options?.status ? `&status=${encodeURIComponent(options.status)}` : '';
  return apiRequest<PageData<AdminOrderDto>>(
    `/api/v1/orders/admin?townId=${townId}&page=${page}&size=${size}${statusQ}`,
    { token },
  );
}

export async function fetchAdminOrderDetail(
  token: string,
  townId: string,
  orderId: string,
): Promise<AdminOrderDetailDto> {
  return apiRequest<AdminOrderDetailDto>(`/api/v1/orders/admin/${orderId}?townId=${townId}`, {
    token,
  });
}

export type ClaimDto = {
  claimId: string;
  orderId: string;
  orderNumber?: string | null;
  orderItemId?: string | null;
  itemName?: string | null;
  shopName?: string | null;
  quantity?: number | null;
  unitCode?: string | null;
  suggestedCreditAmount?: number | null;
  buyerId: string;
  townId: string;
  claimType: string;
  status: string;
  reason: string;
  resolution?: string | null;
  resolvedAmount?: number | null;
  resolutionNote?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};

export async function fetchHubClaims(
  token: string,
  townId: string,
  options?: { page?: number; size?: number; status?: string },
): Promise<PageData<ClaimDto>> {
  const page = options?.page ?? 0;
  const size = options?.size ?? 20;
  const statusQ = options?.status ? `&status=${encodeURIComponent(options.status)}` : '';
  return apiRequest<PageData<ClaimDto>>(
    `/api/v1/orders/admin/claims?townId=${townId}&page=${page}&size=${size}${statusQ}`,
    { token },
  );
}

export async function resolveHubClaim(
  token: string,
  townId: string,
  claimId: string,
  body: { resolution: 'WALLET_CREDIT' | 'NONE'; amount?: number; note?: string },
): Promise<ClaimDto> {
  return apiRequest<ClaimDto>(
    `/api/v1/orders/admin/claims/${claimId}/resolve?townId=${townId}`,
    { method: 'POST', token, body },
  );
}

export async function assignPickup(
  token: string,
  vendorSubOrderId: string,
  agentId: string,
): Promise<AssignmentDto> {
  return apiRequest<AssignmentDto>('/api/v1/delivery/assignments/pickup', {
    method: 'POST',
    token,
    body: { vendorSubOrderId, agentId },
  });
}

export async function assignLastMile(token: string, orderId: string, agentId: string): Promise<AssignmentDto> {
  return apiRequest<AssignmentDto>('/api/v1/delivery/assignments/last-mile', {
    method: 'POST',
    token,
    body: { orderId, agentId },
  });
}

export async function reassignAssignment(
  token: string,
  assignmentId: string,
  newAgentId: string,
  reason = 'Changed by hub',
): Promise<AssignmentDto> {
  return apiRequest<AssignmentDto>(`/api/v1/delivery/assignments/${assignmentId}/reassign`, {
    method: 'PATCH',
    token,
    body: { newAgentId, reason },
  });
}

export type AgentDto = {
  agentId: string;
  userId?: string;
  hubId?: string;
  hubName?: string | null;
  name: string;
  phone: string;
  status: string;
};

export async function fetchHubAgents(token: string, hubId: string): Promise<AgentDto[]> {
  const data = await apiRequest<AgentDto[]>(`/api/v1/delivery/agents?hubId=${encodeURIComponent(hubId)}`, {
    token,
  });
  return data ?? [];
}

export async function createHubAgent(
  token: string,
  body: { name: string; phone: string; password: string },
): Promise<AgentDto> {
  return apiRequest<AgentDto>('/api/v1/delivery/agents', {
    method: 'POST',
    token,
    body,
  });
}

export async function updateHubAgentStatus(
  token: string,
  agentId: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<AgentDto> {
  return apiRequest<AgentDto>(`/api/v1/delivery/agents/${agentId}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function markSubOrderAtHub(token: string, vendorSubOrderId: string): Promise<AssignmentDto> {
  return apiRequest<AssignmentDto>(`/api/v1/delivery/sub-orders/${vendorSubOrderId}/at-hub`, {
    method: 'POST',
    token,
  });
}
