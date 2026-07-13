import { apiRequest, type PageData } from '@/shared/api/http';

export type ListingDto = {
  listingId: string;
  masterItemId: string;
  name: string;
  unit: string;
  townId: string;
  vendorId: string;
  shopId: string;
  shopName?: string;
  price: number;
  discountPrice?: number | null;
  vendorNote?: string | null;
  active: boolean;
};

export type MasterItemDto = {
  masterItemId: string;
  name: string;
  unit: string;
  category?: string;
  mrp?: number | null;
};

export type ListingView = {
  id: string;
  masterItemId: string;
  name: string;
  unit: string;
  priceLabel: string;
  discountLabel: string | null;
  note: string;
  active: boolean;
};

export type MasterItemView = {
  id: string;
  label: string;
  mrpLabel: string | null;
};

function money(value: number | null | undefined): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export function toListingView(dto: ListingDto): ListingView {
  return {
    id: dto.listingId,
    masterItemId: dto.masterItemId,
    name: dto.name,
    unit: dto.unit,
    priceLabel: money(dto.price),
    discountLabel: dto.discountPrice != null ? money(dto.discountPrice) : null,
    note: dto.vendorNote?.trim() || '',
    active: dto.active,
  };
}

export function toMasterItemView(dto: MasterItemDto): MasterItemView {
  return {
    id: dto.masterItemId,
    label: `${dto.name} (${dto.unit})${dto.category ? ` · ${dto.category}` : ''}`,
    mrpLabel: dto.mrp != null ? money(dto.mrp) : null,
  };
}

export async function fetchMyListings(token: string, vendorId: string): Promise<ListingView[]> {
  const data = await apiRequest<PageData<ListingDto>>(
    '/api/v1/catalog/vendors/me/listings?page=0&size=100',
    { token, vendorId },
  );
  return (data.items ?? []).map(toListingView);
}

export async function fetchMasterItems(token: string): Promise<MasterItemView[]> {
  const data = await apiRequest<PageData<MasterItemDto>>('/api/v1/catalog/master-items?page=0&size=100', {
    token,
  });
  return (data.items ?? []).map(toMasterItemView);
}

export async function createListing(
  token: string,
  vendorId: string,
  input: {
    masterItemId: string;
    price: number;
    discountPrice?: number | null;
    vendorNote?: string;
    active?: boolean;
  },
): Promise<ListingView> {
  const data = await apiRequest<ListingDto>('/api/v1/catalog/vendors/me/listings', {
    method: 'POST',
    token,
    vendorId,
    body: {
      masterItemId: input.masterItemId,
      price: input.price,
      discountPrice: input.discountPrice ?? null,
      vendorNote: input.vendorNote || null,
      active: input.active ?? true,
    },
  });
  return toListingView(data);
}

export async function updateListing(
  token: string,
  vendorId: string,
  listingId: string,
  patch: {
    price?: number;
    discountPrice?: number | null;
    vendorNote?: string | null;
    active?: boolean;
  },
): Promise<ListingView> {
  const data = await apiRequest<ListingDto>(`/api/v1/catalog/vendors/me/listings/${listingId}`, {
    method: 'PATCH',
    token,
    vendorId,
    body: patch,
  });
  return toListingView(data);
}
