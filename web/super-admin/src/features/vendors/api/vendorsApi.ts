import { apiRequest, type PageData } from '@/shared/api/http';
import { normalizeServiceFor, type VendorServiceFor } from '@hlm-vendor';

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
  serviceId?: string | null;
  serviceName?: string | null;
  serviceFor?: string | null;
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
  serviceId?: string | null;
  serviceName?: string | null;
  serviceFor?: string | null;
  hidesListings?: boolean;
};

export type UpdateVendorProfileInput = {
  businessName: string;
  ownerName?: string;
  shopName: string;
  address?: string;
  serviceId: string;
  serviceFor: 'MALE' | 'FEMALE' | 'UNISEX';
  gstNumber?: string;
  fssaiNumber?: string;
  bankAccount?: string;
  ifsc?: string;
};

type RegistrationDto = VendorRegistrationVm & { service_for?: string | null };
type VendorDto = VendorVm & { service_for?: string | null };

function mapServiceFor(raw: VendorDto | RegistrationDto): VendorServiceFor | null {
  return normalizeServiceFor(raw.serviceFor ?? raw.service_for);
}

function mapVendor(dto: VendorDto): VendorVm {
  const serviceFor = mapServiceFor(dto);
  return {
    ...dto,
    serviceFor: serviceFor ?? null,
  };
}

function mapRegistration(dto: RegistrationDto): VendorRegistrationVm {
  const serviceFor = mapServiceFor(dto);
  return {
    ...dto,
    serviceFor: serviceFor ?? null,
  };
}

export type CreateRegistrationInput = {
  townId: string;
  serviceId: string;
  serviceFor: 'MALE' | 'FEMALE' | 'UNISEX';
  businessName: string;
  ownerName?: string;
  phone: string;
  shopName: string;
  address?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  bankAccount?: string;
  ifsc?: string;
  vendorTermsAcknowledged: boolean;
  acknowledgedLegalVersion: number;
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
  return (data.items ?? []).map(mapRegistration);
}

export async function createRegistrationRequest(
  token: string,
  input: CreateRegistrationInput,
): Promise<VendorRegistrationVm> {
  const created = await apiRequest<RegistrationDto>('/api/v1/vendors/registration-requests', {
    method: 'POST',
    token,
    body: input,
  });
  return mapRegistration(created);
}

export async function approveRegistration(token: string, id: string): Promise<VendorRegistrationVm> {
  const approved = await apiRequest<RegistrationDto>(
    `/api/v1/vendors/registration-requests/${id}/approve`,
    {
      method: 'POST',
      token,
      body: {},
    },
  );
  return mapRegistration(approved);
}

export async function rejectRegistration(
  token: string,
  id: string,
  reason: string,
): Promise<VendorRegistrationVm> {
  const rejected = await apiRequest<RegistrationDto>(
    `/api/v1/vendors/registration-requests/${id}/reject`,
    {
      method: 'POST',
      token,
      body: { reason },
    },
  );
  return mapRegistration(rejected);
}

export async function listVendors(token: string, townId: string): Promise<VendorVm[]> {
  const data = await apiRequest<PageData<VendorDto> | { items: VendorDto[] }>(
    `/api/v1/vendors?townId=${encodeURIComponent(townId)}`,
    { token },
  );
  if ('items' in data) return (data.items ?? []).map(mapVendor);
  return [];
}

export async function updateVendorStatus(
  token: string,
  vendorId: string,
  status: 'ACTIVE' | 'DISABLED',
  reason?: string,
): Promise<VendorVm> {
  const updated = await apiRequest<VendorDto>(`/api/v1/vendors/${vendorId}/status`, {
    method: 'PATCH',
    token,
    body: reason ? { status, reason } : { status },
  });
  return mapVendor(updated);
}

export async function updateVendorProfile(
  token: string,
  vendorId: string,
  input: UpdateVendorProfileInput,
): Promise<VendorVm> {
  const updated = await apiRequest<VendorDto>(`/api/v1/vendors/${vendorId}`, {
    method: 'PUT',
    token,
    body: input,
  });
  return mapVendor(updated);
}
