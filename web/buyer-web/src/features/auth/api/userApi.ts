import { apiRequest } from '@/shared/api/http';

export type UserProfile = {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  roles: string[];
  defaultTownId?: string | null;
};

export async function fetchMyProfile(token: string): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/v1/users/me', { token });
}
