import { apiRequest } from '@/shared/api/http';

export type ServiceOffering = {
  id: string;
  name: string;
  hidesListings: boolean;
  sortOrder: number;
};

export async function listServices(token: string): Promise<ServiceOffering[]> {
  const data = await apiRequest<{ items: ServiceOffering[] }>('/api/v1/vendors/services', { token });
  return data.items ?? [];
}

export async function createService(
  token: string,
  name: string,
  hidesListings: boolean,
): Promise<ServiceOffering> {
  return apiRequest<ServiceOffering>('/api/v1/vendors/services', {
    method: 'POST',
    token,
    body: { name, hidesListings },
  });
}

export async function updateService(
  token: string,
  id: string,
  name: string,
  hidesListings: boolean,
): Promise<ServiceOffering> {
  return apiRequest<ServiceOffering>(`/api/v1/vendors/services/${id}`, {
    method: 'PUT',
    token,
    body: { name, hidesListings },
  });
}

export async function deleteService(token: string, id: string): Promise<void> {
  await apiRequest<null>(`/api/v1/vendors/services/${id}`, { method: 'DELETE', token });
}
