import { apiRequest, type PageData } from '@/shared/api/http';

export type VendorRegistrationVm = {
  id: string;
  townId: string;
  businessName: string;
  ownerName?: string | null;
  phone: string;
  shopName: string;
  address?: string | null;
  gstNumber?: string | null;
  fssaiNumber?: string | null;
  status: string;
  rejectReason?: string | null;
  vendorId?: string | null;
  createdAt?: string | null;
  /** Present only on approve — share with vendor once. */
  temporaryPassword?: string | null;
};

export type VendorVm = {
  id: string;
  townId: string;
  businessName: string;
  ownerName?: string | null;
  phone: string;
  gstNumber?: string | null;
  fssaiNumber?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  status: string;
  shopName?: string | null;
  address?: string | null;
  disabledReason?: string | null;
};

export type UpdateVendorProfileInput = {
  businessName: string;
  ownerName?: string;
  shopName: string;
  address?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  bankAccount?: string;
  ifsc?: string;
};

type RegistrationDto = VendorRegistrationVm;
type VendorDto = VendorVm;

export type CreateRegistrationInput = {
  townId: string;
  businessName: string;
  ownerName?: string;
  phone: string;
  shopName: string;
  address?: string;
  gstNumber?: string;
  fssaiNumber?: string;
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

export async function updateVendorStatus(
  token: string,
  vendorId: string,
  status: 'ACTIVE' | 'DISABLED',
  reason?: string,
): Promise<VendorVm> {
  return apiRequest<VendorVm>(`/api/v1/vendors/${vendorId}/status`, {
    method: 'PATCH',
    token,
    body: reason ? { status, reason } : { status },
  });
}

export async function updateVendorProfile(
  token: string,
  vendorId: string,
  input: UpdateVendorProfileInput,
): Promise<VendorVm> {
  return apiRequest<VendorVm>(`/api/v1/vendors/${vendorId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}
