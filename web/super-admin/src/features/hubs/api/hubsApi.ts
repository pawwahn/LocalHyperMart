import { apiRequest } from '@/shared/api/http';

export type GovtIdType = 'AADHAAR' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'PAN' | 'OTHER';

export type AdminHubVm = {
  hubId: string;
  townId: string;
  name: string;
  address?: string | null;
  phone: string;
  status: string;
  adminUserId?: string | null;
  adminPhone?: string | null;
  govtIdType?: string | null;
  govtIdNumber?: string | null;
  reference1Name?: string | null;
  reference1Phone?: string | null;
  reference2Name?: string | null;
  reference2Phone?: string | null;
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
  govtIdType: GovtIdType;
  govtIdNumber: string;
  reference1Name: string;
  reference1Phone: string;
  reference2Name: string;
  reference2Phone: string;
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
