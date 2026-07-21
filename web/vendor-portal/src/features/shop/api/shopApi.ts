import { apiRequest } from '@/shared/api/http';

export type VendorShopStatus = {
  vendorId: string;
  townId: string;
  shopId: string;
  shopName: string;
  address?: string | null;
  pincode?: string | null;
  phone?: string | null;
  acceptingOrders: boolean;
  hubName?: string | null;
  hubPhone?: string | null;
  hubHours?: string | null;
};

export type UpdateShopProfileInput = {
  shopName?: string;
  address?: string;
  pincode?: string;
};

export async function fetchMyShop(token: string, vendorId: string): Promise<VendorShopStatus> {
  return apiRequest<VendorShopStatus>('/api/v1/vendors/me/shop', { token, vendorId });
}

export async function updateShopProfile(
  token: string,
  vendorId: string,
  body: UpdateShopProfileInput,
): Promise<VendorShopStatus> {
  return apiRequest<VendorShopStatus>('/api/v1/vendors/me/shop', {
    method: 'PATCH',
    token,
    vendorId,
    body,
  });
}

export async function setShopAcceptingOrders(
  token: string,
  vendorId: string,
  acceptingOrders: boolean,
): Promise<VendorShopStatus> {
  return apiRequest<VendorShopStatus>('/api/v1/vendors/me/shop/accepting-orders', {
    method: 'PATCH',
    token,
    vendorId,
    body: { acceptingOrders },
  });
}
