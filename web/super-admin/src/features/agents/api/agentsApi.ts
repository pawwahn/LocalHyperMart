import { apiRequest } from '@/shared/api/http';

export type AdminAgentVm = {
  agentId: string;
  userId?: string;
  hubId?: string | null;
  hubName?: string | null;
  name: string;
  phone: string;
  status: string;
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
