import { apiRequest, type PageData } from '@/shared/api/http';

export type VendorRegistrationVm = {
  id: string;
  townId: string;
  businessName: string;
  ownerName?: string | null;
  phone: string;
  shopName: string;
  address?: string | null;
  status: string;
  rejectReason?: string | null;
  vendorId?: string | null;
  createdAt?: string | null;
};

export type VendorVm = {
  id: string;
  townId: string;
  businessName: string;
  ownerName?: string | null;
  phone: string;
  status: string;
  shopName?: string | null;
};

type RegistrationDto = VendorRegistrationVm;
type VendorDto = {
  id: string;
  townId: string;
  businessName: string;
  ownerName?: string | null;
  phone: string;
  status: string;
  shopName?: string | null;
};

export type CreateRegistrationInput = {
  townId: string;
  businessName: string;
  ownerName?: string;
  phone: string;
  shopName: string;
  address?: string;
  gstNumber?: string;
  bankAccount?: string;
  ifsc?: string;
};

export async function listRegistrationRequests(
  token: string,
  status?: string,
): Promise<VendorRegistrationVm[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiRequest<{ items: RegistrationDto[] }>(
    `/api/v1/vendors/registration-requests${q}`,
    { token },
  );
  return data.items ?? [];
}

export async function createRegistrationRequest(
  token: string,
  input: CreateRegistrationInput,
): Promise<VendorRegistrationVm> {
  return apiRequest<VendorRegistrationVm>('/api/v1/vendors/registration-requests', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function approveRegistration(token: string, id: string): Promise<VendorRegistrationVm> {
  return apiRequest<VendorRegistrationVm>(`/api/v1/vendors/registration-requests/${id}/approve`, {
    method: 'POST',
    token,
    body: {},
  });
}

export async function rejectRegistration(
  token: string,
  id: string,
  reason: string,
): Promise<VendorRegistrationVm> {
  return apiRequest<VendorRegistrationVm>(`/api/v1/vendors/registration-requests/${id}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function listVendors(token: string, townId: string): Promise<VendorVm[]> {
  const data = await apiRequest<PageData<VendorDto> | { items: VendorDto[] }>(
    `/api/v1/vendors?townId=${encodeURIComponent(townId)}`,
    { token },
  );
  if ('items' in data) return data.items ?? [];
  return [];
}
