import { apiRequest } from '@/shared/api/http';

export type AdminHubVm = {
  hubId: string;
  townId: string;
  name: string;
  address?: string | null;
  phone: string;
  status: string;
  adminUserId?: string | null;
  adminPhone?: string | null;
  temporaryPassword?: string | null;
};

export type CreateHubInput = {
  townId: string;
  name: string;
  address?: string;
  phone: string;
  adminPhone?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
};

export async function listHubs(token: string): Promise<AdminHubVm[]> {
  return apiRequest<AdminHubVm[]>('/api/v1/delivery/admin/hubs', { token });
}

export async function createHub(token: string, input: CreateHubInput): Promise<AdminHubVm> {
  return apiRequest<AdminHubVm>('/api/v1/delivery/admin/hubs', {
    method: 'POST',
    token,
    body: input,
  });
}
