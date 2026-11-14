import { apiRequest } from '@/shared/api/http';

export type AppAdminRole = 'APP_ADMIN_READ' | 'APP_ADMIN_WRITE';

export type AppAdminUserVm = {
  userId: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
  platformRole: string;
  manageable: boolean;
  lastLoginAt?: string | null;
};

export async function listAppAdmins(token: string): Promise<AppAdminUserVm[]> {
  const data = await apiRequest<{ items: AppAdminUserVm[] }>('/api/v1/users/admin/app-admins', { token });
  return data.items ?? [];
}

export async function inviteAppAdmin(
  token: string,
  body: {
    phone: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role: AppAdminRole;
  },
): Promise<AppAdminUserVm> {
  return apiRequest<AppAdminUserVm>('/api/v1/users/admin/app-admins', {
    method: 'POST',
    token,
    body,
  });
}

export async function patchAppAdminRole(
  token: string,
  userId: string,
  role: AppAdminRole,
): Promise<AppAdminUserVm> {
  return apiRequest<AppAdminUserVm>(`/api/v1/users/admin/app-admins/${userId}/role`, {
    method: 'PATCH',
    token,
    body: { role },
  });
}

export async function revokeAppAdminAccess(token: string, userId: string): Promise<void> {
  await apiRequest(`/api/v1/users/admin/app-admins/${userId}`, {
    method: 'DELETE',
    token,
  });
}

export async function resetAppAdminPassword(token: string, userId: string, password: string): Promise<void> {
  await apiRequest(`/api/v1/users/admin/app-admins/${userId}/password`, {
    method: 'PUT',
    token,
    body: { password },
  });
}
