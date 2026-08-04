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
  events: Array<{
    eventType: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

export function toAssignmentView(dto: AssignmentDto): AssignmentView {
  return {
    id: dto.assignmentId,
    assignmentNumber: dto.assignmentNumber,
    orderId: dto.orderId,
    orderNumber: dto.orderNumber,
    vendorSubOrderId: dto.vendorSubOrderId ?? null,
    subOrderNumber: dto.subOrderNumber ?? null,
    legType: dto.legType,
    status: dto.status,
    label:
      dto.legType === 'PICKUP'
        ? `Vendor → Hub · ${dto.status}`
        : `Hub → Buyer · ${dto.status}`,
    assignedAt: dto.assignedAt ?? null,
    startedAt: dto.startedAt ?? null,
    completedAt: dto.completedAt ?? null,
    destinationLabel: dto.destinationLabel ?? null,
    destinationName: dto.destinationName ?? null,
    destinationPhone: dto.destinationPhone ?? null,
    destinationAddress: dto.destinationAddress ?? null,
    events: (dto.events ?? []).map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      metadata: e.metadata ?? null,
    })),
  };
}

export type AgentStatsDto = {
  vendorPickupsCollected: number;
  vendorPickupsAtHub: number;
  buyerDeliveriesCompleted: number;
  vendorPickupsCollectedToday: number;
  vendorPickupsAtHubToday: number;
  buyerDeliveriesCompletedToday: number;
};

export type AgentStatsView = {
  vendorPickupsCollected: number;
  vendorPickupsAtHub: number;
  buyerDeliveriesCompleted: number;
  vendorPickupsCollectedToday: number;
  vendorPickupsAtHubToday: number;
  buyerDeliveriesCompletedToday: number;
};

export type PickupManifestLineView = {
  name: string;
  quantity: number;
  unitCode: string | null;
  lineTotal: number;
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

export async function fetchMyStats(token: string): Promise<AgentStatsView> {
  return apiRequest<AgentStatsDto>('/api/v1/delivery/agents/me/stats', { token });
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
