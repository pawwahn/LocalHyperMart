import { apiRequest } from '@/shared/api/http';

export type AdminAgentVm = {
  agentId: string;
  userId?: string;
  hubId?: string | null;
  hubName?: string | null;
  townId?: string | null;
  name: string;
  phone: string;
  status: string;
  govtIdType?: string | null;
  govtIdNumber?: string | null;
  reference1Name?: string | null;
  reference1Phone?: string | null;
  reference2Name?: string | null;
  reference2Phone?: string | null;
};

export type AgentAssignmentVm = {
  assignmentId: string;
  assignmentNumber?: string | null;
  orderNumber?: string | null;
  subOrderNumber?: string | null;
  legType: 'PICKUP' | 'LAST_MILE' | string;
  status: string;
  assignedAt?: string | null;
  completedAt?: string | null;
};

export type AgentAssignmentPage = {
  items: AgentAssignmentVm[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  completedPickups: number;
  completedHomeDeliveries: number;
};

export async function listAllAgents(token: string): Promise<AdminAgentVm[]> {
  const data = await apiRequest<AdminAgentVm[]>('/api/v1/delivery/admin/agents', { token });
  return data ?? [];
}

export async function permanentlyDisableAgent(token: string, agentId: string): Promise<AdminAgentVm> {
  return apiRequest<AdminAgentVm>(`/api/v1/delivery/agents/${agentId}`, {
    method: 'DELETE',
    token,
  });
}

export async function restoreAgent(token: string, agentId: string): Promise<AdminAgentVm> {
  return apiRequest<AdminAgentVm>(`/api/v1/delivery/agents/${agentId}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'ACTIVE' },
  });
}

export async function listAgentAssignments(
  token: string,
  agentId: string,
  params: { from?: string; to?: string; page?: number; size?: number; signal?: AbortSignal },
): Promise<AgentAssignmentPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 25));
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const data = await apiRequest<AgentAssignmentPage>(
    `/api/v1/delivery/admin/agents/${agentId}/assignments?${q.toString()}`,
    { token, signal: params.signal },
  );
  const items = data.items ?? [];
  const fromRows = items.filter((r) => r.status === 'COMPLETED');
  return {
    items,
    page: data.page ?? 0,
    size: data.size ?? items.length,
    totalElements: data.totalElements ?? items.length,
    totalPages: Math.max(data.totalPages ?? 1, 1),
    completedPickups: data.completedPickups ?? fromRows.filter((r) => r.legType === 'PICKUP').length,
    completedHomeDeliveries:
      data.completedHomeDeliveries ?? fromRows.filter((r) => r.legType === 'LAST_MILE').length,
  };
}

export type AgentRatingVm = {
  ratingId: string;
  orderId: string;
  orderNumber?: string | null;
  stars: number;
  comment?: string | null;
  createdAt?: string | null;
};

export type AgentRatingListVm = {
  averageStars: number;
  ratingCount: number;
  visibleToHub: boolean;
  items: AgentRatingVm[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function listAgentRatings(
  token: string,
  agentId: string,
  page = 0,
): Promise<AgentRatingListVm> {
  const data = await apiRequest<AgentRatingListVm>(
    `/api/v1/orders/admin/delivery-agent-ratings?agentId=${agentId}&page=${page}&size=20`,
    { token },
  );
  return {
    averageStars: Number(data.averageStars ?? 0),
    ratingCount: Number(data.ratingCount ?? 0),
    visibleToHub: Boolean(data.visibleToHub),
    items: data.items ?? [],
    page: data.page ?? 0,
    size: data.size ?? 20,
    totalElements: data.totalElements ?? 0,
    totalPages: Math.max(data.totalPages ?? 1, 1),
  };
}
