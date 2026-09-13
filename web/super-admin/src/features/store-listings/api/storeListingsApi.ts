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
  page?: number;
  size?: number;
};

export type AdminListingPage = {
  items: AdminListingVm[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export async function listStoreListings(
  token: string,
  filters: AdminListingFilters = {},
): Promise<AdminListingPage> {
  const params = new URLSearchParams();
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 40));
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
  const items = data.items ?? [];
  const total = data.totalElements ?? items.length;
  const size = data.size || filters.size || items.length || 40;
  return {
    items,
    page: data.page ?? filters.page ?? 0,
    size,
    total,
    totalPages: data.totalPages ?? Math.max(1, Math.ceil(total / size)),
  };
}
