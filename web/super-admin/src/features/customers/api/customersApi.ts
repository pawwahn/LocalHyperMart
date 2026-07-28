import { apiRequest, type PageData } from '@/shared/api/http';

export type CustomerProfile = {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  roles?: string[];
  defaultTownId?: string | null;
  status?: string | null;
  lastLoginAt?: string | null;
};

export type CustomerAddress = {
  id: string;
  townId: string;
  label?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  line1?: string | null;
  line2?: string | null;
  landmark?: string | null;
  pincode?: string | null;
  isDefault?: boolean;
};

export type CustomerWallet = {
  userId: string;
  balance: number;
  status?: string;
};

export type CustomerWalletTxn = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  orderNumber?: string | null;
  title?: string | null;
  note?: string | null;
  createdAt?: string;
};

export type CustomerWalletTxnPage = {
  items: CustomerWalletTxn[];
  hasMore?: boolean;
};

export async function findCustomerByPhone(token: string, phone: string): Promise<CustomerProfile> {
  const q = encodeURIComponent(phone.trim());
  return apiRequest<CustomerProfile>(`/api/v1/users/admin/by-phone?phone=${q}`, { token });
}

export async function listCustomerAddresses(token: string, userId: string): Promise<CustomerAddress[]> {
  return apiRequest<CustomerAddress[]>(`/api/v1/users/admin/${userId}/addresses`, { token });
}

export async function fetchCustomerWallet(token: string, userId: string): Promise<CustomerWallet> {
  return apiRequest<CustomerWallet>(`/api/v1/payments/admin/wallet/${userId}`, { token });
}

export async function fetchCustomerWalletTxns(
  token: string,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<CustomerWalletTxnPage> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  return apiRequest<CustomerWalletTxnPage>(
    `/api/v1/payments/admin/wallet/${userId}/transactions?limit=${limit}&offset=${offset}`,
    { token },
  );
}

export function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function displayName(c: CustomerProfile): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || 'Customer';
}

export type { PageData };
