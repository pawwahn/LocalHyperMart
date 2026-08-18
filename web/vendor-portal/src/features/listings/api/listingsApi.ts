import { apiRequest, type PageData } from '@/shared/api/http';

export type ListingDto = {
  listingId: string;
  masterItemId: string;
  categoryId?: string;
  category?: string;
  name: string;
  unit: string;
  townId: string;
  vendorId: string;
  shopId: string;
  shopName?: string;
  masterMrp?: number | null;
  vendorMrp?: number | null;
  mrp?: number | null;
  price: number;
  discountPrice?: number | null;
  specialDiscountPrice?: number | null;
  effectivePrice?: number;
  vendorNote?: string | null;
  active: boolean;
  imageUrls?: string[] | null;
  listingImageUrls?: string[] | null;
  masterImageUrls?: string[] | null;
  customImages?: boolean;
};

export type MasterItemDto = {
  masterItemId: string;
  categoryId?: string;
  name: string;
  unit: string;
  category?: string;
  mrp?: number | null;
  imageUrls?: string[] | null;
};

export type CategoryDto = {
  id: string;
  name: string;
  description?: string | null;
};

export type ListingView = {
  id: string;
  masterItemId: string;
  categoryId: string;
  category: string;
  name: string;
  unit: string;
  mrpLabel: string | null;
  priceLabel: string;
  discountLabel: string | null;
  effectiveLabel: string;
  note: string;
  active: boolean;
  vendorMrp: string;
  price: string;
  discountPrice: string;
  imageUrls: string[];
  listingImageUrls: string[];
  masterImageUrls: string[];
  customImages: boolean;
};

export type MasterItemView = {
  id: string;
  categoryId: string;
  category: string;
  name: string;
  unit: string;
  mrp: number | null;
  mrpLabel: string | null;
  imageUrl: string | null;
};

export type CategoryView = {
  id: string;
  name: string;
};

export type DraftPricing = {
  vendorMrp: string;
  price: string;
  discountPrice: string;
  vendorNote: string;
};

function money(value: number | null | undefined): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export function emptyDraft(mrp?: number | null): DraftPricing {
  return {
    vendorMrp: mrp != null ? String(mrp) : '',
    price: mrp != null ? String(mrp) : '',
    discountPrice: '',
    vendorNote: '',
  };
}

export function toListingView(dto: ListingDto): ListingView {
  const vendorMrp =
    dto.vendorMrp != null ? dto.vendorMrp : dto.masterMrp != null ? dto.masterMrp : null;
  const mrp = dto.mrp != null ? dto.mrp : vendorMrp;
  const listingImageUrls = Array.isArray(dto.listingImageUrls) ? dto.listingImageUrls : [];
  const masterImageUrls = Array.isArray(dto.masterImageUrls) ? dto.masterImageUrls : [];
  const imageUrls = Array.isArray(dto.imageUrls) && dto.imageUrls.length > 0
      ? dto.imageUrls
      : listingImageUrls.length > 0
        ? listingImageUrls
        : masterImageUrls;
  return {
    id: dto.listingId,
    masterItemId: dto.masterItemId,
    categoryId: dto.categoryId ?? '',
    category: dto.category ?? '',
    name: dto.name,
    unit: dto.unit,
    mrpLabel: mrp != null ? money(mrp) : null,
    priceLabel: money(dto.price),
    discountLabel: dto.discountPrice != null ? money(dto.discountPrice) : null,
    // Prefer regular sell price for vendor list; effective may be an old discount.
    effectiveLabel: money(dto.price),
    note: dto.vendorNote?.trim() || '',
    active: dto.active,
    vendorMrp: vendorMrp != null ? String(vendorMrp) : '',
    price: String(dto.price ?? ''),
    discountPrice: dto.discountPrice != null ? String(dto.discountPrice) : '',
    imageUrls,
    listingImageUrls,
    masterImageUrls,
    customImages: Boolean(dto.customImages) || listingImageUrls.length > 0,
  };
}

/** Fill category from master catalog when listing API omits it (older backend). */
export function enrichListingsWithCategory(
  listings: ListingView[],
  masters: MasterItemView[],
): ListingView[] {
  const byMaster = new Map(masters.map((m) => [m.id, m]));
  return listings.map((listing) => {
    if (listing.category) return listing;
    const master = byMaster.get(listing.masterItemId);
    if (!master) return listing;
    return { ...listing, categoryId: master.categoryId, category: master.category };
  });
}

export function toMasterItemView(dto: MasterItemDto): MasterItemView {
  return {
    id: dto.masterItemId,
    categoryId: dto.categoryId ?? '',
    category: dto.category ?? 'Other',
    name: dto.name,
    unit: dto.unit,
    mrp: dto.mrp ?? null,
    mrpLabel: dto.mrp != null ? money(dto.mrp) : null,
    imageUrl: dto.imageUrls?.[0] ?? null,
  };
}

function parseOptionalPrice(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseDraftPricing(draft: DraftPricing, productName = 'This product'): {
  vendorMrp: number | null;
  price: number;
  discountPrice: number | null;
  vendorNote: string | null;
} {
  const price = Number(draft.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${productName}: enter a valid selling price`);
  }
  const vendorMrp = parseOptionalPrice(draft.vendorMrp);
  if (draft.vendorMrp.trim() && vendorMrp == null) {
    throw new Error(`${productName}: enter a valid MRP or leave blank`);
  }
  if (vendorMrp != null && vendorMrp < price) {
    throw new Error(
      `${productName}: MRP (₹${vendorMrp}) cannot be less than selling price (₹${price}). Set MRP ≥ ₹${price}.`,
    );
  }
  const discountPrice = parseOptionalPrice(draft.discountPrice);
  if (draft.discountPrice.trim() && discountPrice == null) {
    throw new Error(`${productName}: enter a valid discount price or leave blank`);
  }
  if (discountPrice != null && discountPrice > price) {
    throw new Error(
      `${productName}: discount price (₹${discountPrice}) cannot exceed selling price (₹${price}).`,
    );
  }
  return {
    vendorMrp,
    price,
    discountPrice,
    vendorNote: draft.vendorNote.trim() || null,
  };
}

export async function fetchCategories(token: string): Promise<CategoryView[]> {
  const data = await apiRequest<{ items: CategoryDto[] }>('/api/v1/catalog/categories', { token });
  return (data.items ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export async function fetchMasterItems(token: string, categoryId?: string): Promise<MasterItemView[]> {
  const q = categoryId
    ? `?categoryId=${encodeURIComponent(categoryId)}&page=0&size=200`
    : '?page=0&size=200';
  const data = await apiRequest<PageData<MasterItemDto>>(`/api/v1/catalog/master-items${q}`, { token });
  return (data.items ?? []).map(toMasterItemView);
}

export async function fetchMyListings(token: string, vendorId: string): Promise<ListingView[]> {
  const data = await apiRequest<PageData<ListingDto>>(
    '/api/v1/catalog/vendors/me/listings?page=0&size=100',
    { token, vendorId },
  );
  return (data.items ?? []).map(toListingView);
}

export async function bulkPublishListings(
  token: string,
  vendorId: string,
  items: Array<{
    masterItemId: string;
    vendorMrp?: number | null;
    price: number;
    discountPrice?: number | null;
    vendorNote?: string | null;
  }>,
): Promise<ListingView[]> {
  const data = await apiRequest<ListingDto[]>('/api/v1/catalog/vendors/me/listings/bulk', {
    method: 'POST',
    token,
    vendorId,
    body: {
      items: items.map((item) => ({
        masterItemId: item.masterItemId,
        vendorMrp: item.vendorMrp ?? null,
        price: item.price,
        discountPrice: item.discountPrice ?? null,
        vendorNote: item.vendorNote ?? null,
        active: true,
      })),
    },
  });
  return (data ?? []).map(toListingView);
}

export async function updateListingActive(
  token: string,
  vendorId: string,
  listingId: string,
  active: boolean,
): Promise<ListingView> {
  const data = await apiRequest<ListingDto>(`/api/v1/catalog/vendors/me/listings/${listingId}`, {
    method: 'PATCH',
    token,
    vendorId,
    body: { active },
  });
  return toListingView(data);
}

export async function updateListingPricing(
  token: string,
  vendorId: string,
  listingId: string,
  pricing: {
    vendorMrp: number | null;
    price: number;
    discountPrice: number | null;
    vendorNote: string | null;
  },
): Promise<ListingView> {
  const data = await apiRequest<ListingDto>(`/api/v1/catalog/vendors/me/listings/${listingId}`, {
    method: 'PATCH',
    token,
    vendorId,
    body: {
      vendorMrp: pricing.vendorMrp,
      price: pricing.price,
      // Simple edit form has no discount field — clear any stale discount so Sell
      // (effective price) matches the price the vendor just saved.
      discountPrice: pricing.discountPrice,
      vendorNote: pricing.vendorNote,
      replacePricing: true,
    },
  });
  return toListingView(data);
}

export type UploadedMedia = {
  mediaId: string;
  url: string;
};

export async function uploadListingImage(token: string, file: File): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'VENDOR_LISTING');
  const response = await fetch('/api/v1/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: UploadedMedia;
  };
  if (!response.ok || !payload.data?.mediaId || !payload.data?.url) {
    throw new Error(payload.message || 'Image upload failed');
  }
  return payload.data;
}

export async function setListingImages(
  token: string,
  vendorId: string,
  listingId: string,
  images: Array<{ mediaId: string; url: string }>,
): Promise<string[]> {
  const data = await apiRequest<{ items: string[] }>(
    `/api/v1/catalog/vendors/me/listings/${listingId}/images`,
    {
      method: 'PUT',
      token,
      vendorId,
      body: {
        images: images
          .filter((m) => Boolean(m.mediaId && m.url))
          .map((m) => ({ mediaId: m.mediaId, url: m.url })),
      },
    },
  );
  return data.items ?? [];
}
