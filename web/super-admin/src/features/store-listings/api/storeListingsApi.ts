import { apiRequest, type PageData } from '@/shared/api/http';

export type AdminListingVm = {
  listingId: string;
  townId: string;
  vendorId: string;
  shopId: string;
  shopName: string;
  masterItemId: string;
  itemName: string;
  category: string;
  unit: string;
  mrp?: number | null;
  price: number;
  discountPrice?: number | null;
  effectivePrice?: number | null;
  vendorNote?: string | null;
  active: boolean;
};

export type AdminListingFilters = {
  townId?: string;
  vendorId?: string;
  shopName?: string;
  active?: boolean | '';
};

export async function listStoreListings(
  token: string,
  filters: AdminListingFilters = {},
): Promise<AdminListingVm[]> {
  const params = new URLSearchParams();
  params.set('page', '0');
  params.set('size', '100');
  if (filters.townId) params.set('townId', filters.townId);
  if (filters.vendorId) params.set('vendorId', filters.vendorId);
  if (filters.shopName?.trim()) params.set('shopName', filters.shopName.trim());
  if (filters.active === true || filters.active === false) {
    params.set('active', String(filters.active));
  }

  const data = await apiRequest<PageData<AdminListingVm>>(
    `/api/v1/catalog/admin/listings?${params.toString()}`,
    { token },
  );
  return data.items ?? [];
}
