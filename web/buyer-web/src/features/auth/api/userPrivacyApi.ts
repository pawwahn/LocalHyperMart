import { apiRequest } from '@/shared/api/http';

export type UserProfileVm = {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  marketingConsent?: boolean;
  marketingConsentAt?: string;
};

export async function fetchMyProfile(token: string): Promise<UserProfileVm> {
  return apiRequest<UserProfileVm>('/api/v1/users/me', { token });
}

export async function updateMarketingConsent(token: string, marketingConsent: boolean): Promise<UserProfileVm> {
  return apiRequest<UserProfileVm>('/api/v1/users/me/privacy', {
    method: 'PATCH',
    token,
    body: { marketingConsent },
  });
}

export async function deleteMyAccount(token: string, password: string): Promise<void> {
  await apiRequest<unknown>('/api/v1/users/me/delete-account', {
    method: 'POST',
    token,
    body: { password },
  });
}
