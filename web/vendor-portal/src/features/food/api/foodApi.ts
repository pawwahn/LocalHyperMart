import { resolveApiBaseUrl } from '@hlm-native';
import { ApiError, apiRequest } from '@/shared/api/http';

const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export type FoodDishImageRef = {
  mediaId: string;
  url: string;
};

export type FoodMenuItemVm = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  buyerNote: string;
  price: number;
  veg: boolean;
  active: boolean;
  sortOrder: number;
  listingId?: string | null;
  photos?: FoodDishImageRef[];
  imageUrls?: string[];
};

export type FoodMenuCategoryVm = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  items: FoodMenuItemVm[];
};

export type VendorFoodMenu = {
  vendorId: string;
  categories: FoodMenuCategoryVm[];
};

export type FoodHotelPhoto = {
  mediaId: string;
  url: string;
};

export type FoodProfileVm = {
  vendorId: string;
  enabled: boolean;
  tagline?: string | null;
  cuisines?: string | null;
  pureVeg: boolean;
  opensAtLabel?: string | null;
  priceForOne?: number | null;
  offerLabel?: string | null;
  ratingScore: number;
  ratingCount: number;
  acceptingOrders: boolean;
  hotelPhotos?: FoodHotelPhoto[];
};

function coerceDishPhoto(raw: unknown): FoodDishImageRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const mediaId = String(row.mediaId ?? row.media_id ?? '').trim();
  const url = String(row.url ?? row.publicUrl ?? row.public_url ?? '').trim();
  if (!mediaId || !url) return null;
  return { mediaId, url };
}

function coerceDishPhotos(raw: unknown): FoodDishImageRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceDishPhoto).filter((p): p is FoodDishImageRef => p != null);
}

/** Keep only entries the UI can render and save (drops blank slots that hid + Add). */
export function sanitizeDishPhotos(photos: FoodDishImageRef[] | undefined): FoodDishImageRef[] {
  return (photos ?? [])
    .map((p) => {
      const mediaId = String(p?.mediaId ?? '').trim();
      const url = String(p?.url ?? '').trim();
      return mediaId && url ? { mediaId, url } : null;
    })
    .filter((p): p is FoodDishImageRef => p != null)
    .slice(0, 3);
}

function normalizeMenuItem(raw: Record<string, unknown>): FoodMenuItemVm {
  let photos = coerceDishPhotos(raw.photos);
  const imageUrlsRaw = raw.imageUrls ?? raw.image_urls;
  const imageUrls = Array.isArray(imageUrlsRaw) ? imageUrlsRaw.map(String) : [];
  if (photos.length === 0 && imageUrls.length > 0) {
    photos = imageUrls
      .map((url) => {
        const trimmed = url.trim();
        const id = trimmed.match(/\/media\/([0-9a-fA-F-]{36})\/content/i)?.[1];
        return id ? { mediaId: id, url: trimmed } : null;
      })
      .filter((p): p is FoodDishImageRef => p != null);
  }
  const priceRaw = raw.price;
  const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw ?? 0);
  return {
    id: String(raw.id ?? ''),
    categoryId: String(raw.categoryId ?? raw.category_id ?? ''),
    name: String(raw.name ?? ''),
    description: raw.description != null ? String(raw.description) : null,
    buyerNote: String(raw.buyerNote ?? raw.buyer_note ?? ''),
    price: Number.isFinite(price) ? price : 0,
    veg: Boolean(raw.veg),
    active: raw.active == null ? true : Boolean(raw.active),
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    listingId: raw.listingId != null || raw.listing_id != null
      ? String(raw.listingId ?? raw.listing_id)
      : null,
    photos,
    imageUrls: imageUrls.length > 0 ? imageUrls : photos.map((p) => p.url),
  };
}

export async function fetchFoodMenu(token: string, vendorId: string): Promise<VendorFoodMenu> {
  const menu = await apiRequest<Record<string, unknown>>('/api/v1/catalog/vendors/me/food/menu', {
    token,
    vendorId,
  });
  const categoriesRaw = menu.categories;
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw.map((cat) => {
        const c = cat as Record<string, unknown>;
        const itemsRaw = c.items;
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((item) => normalizeMenuItem(item as Record<string, unknown>))
          : [];
        return {
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          active: c.active == null ? true : Boolean(c.active),
          sortOrder: Number(c.sortOrder ?? c.sort_order ?? 0),
          items,
        } satisfies FoodMenuCategoryVm;
      })
    : [];
  return {
    vendorId: String(menu.vendorId ?? menu.vendor_id ?? vendorId),
    categories,
  };
}

export async function fetchFoodItemPhotos(
  token: string,
  vendorId: string,
  itemId: string,
): Promise<FoodDishImageRef[]> {
  const data = await apiRequest<unknown>(`/api/v1/catalog/vendors/me/food/items/${itemId}/photos`, {
    token,
    vendorId,
  });
  if (Array.isArray(data)) {
    return coerceDishPhotos(data);
  }
  if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    return coerceDishPhotos(row.photos ?? row.items ?? row.images);
  }
  return [];
}

export async function fetchFoodProfile(token: string, vendorId: string): Promise<FoodProfileVm> {
  return apiRequest<FoodProfileVm>('/api/v1/vendors/me/food/profile', { token, vendorId });
}

export async function saveFoodProfile(
  token: string,
  vendorId: string,
  body: Partial<FoodProfileVm>,
): Promise<FoodProfileVm> {
  return apiRequest<FoodProfileVm>('/api/v1/vendors/me/food/profile', { method: 'PUT', token, vendorId, body });
}

export async function createFoodCategory(token: string, vendorId: string, name: string): Promise<FoodMenuCategoryVm> {
  return apiRequest<FoodMenuCategoryVm>('/api/v1/catalog/vendors/me/food/categories', {
    method: 'POST',
    token,
    vendorId,
    body: { name },
  });
}

export async function createFoodItem(
  token: string,
  vendorId: string,
  body: {
    categoryId: string;
    name: string;
    buyerNote: string;
    price: number;
    veg: boolean;
    description?: string;
    active?: boolean;
    images?: FoodDishImageRef[];
  },
): Promise<FoodMenuItemVm> {
  return apiRequest<FoodMenuItemVm>('/api/v1/catalog/vendors/me/food/items', {
    method: 'POST',
    token,
    vendorId,
    body,
  });
}

export async function updateFoodItem(
  token: string,
  vendorId: string,
  itemId: string,
  body: {
    categoryId: string;
    name: string;
    buyerNote: string;
    price: number;
    veg: boolean;
    description?: string;
    active?: boolean;
    images?: FoodDishImageRef[];
  },
): Promise<FoodMenuItemVm> {
  return apiRequest<FoodMenuItemVm>(`/api/v1/catalog/vendors/me/food/items/${itemId}`, {
    method: 'PUT',
    token,
    vendorId,
    body,
  });
}

export async function deleteFoodItem(token: string, vendorId: string, itemId: string): Promise<void> {
  await apiRequest(`/api/v1/catalog/vendors/me/food/items/${itemId}`, { method: 'DELETE', token, vendorId });
}

export async function saveFoodHotelPhotos(
  token: string,
  vendorId: string,
  body: { mediaIds: string[] },
): Promise<FoodProfileVm> {
  try {
    return await apiRequest<FoodProfileVm>('/api/v1/vendors/me/food/profile', {
      method: 'PUT',
      token,
      vendorId,
      body: { hotelPhotoMediaIds: body.mediaIds },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 404 || status >= 500) {
      return apiRequest<FoodProfileVm>('/api/v1/vendors/me/food/hotel-photos', {
        method: 'PUT',
        token,
        vendorId,
        body: { mediaIds: body.mediaIds },
      });
    }
    throw err;
  }
}

export async function uploadFoodHotelPhoto(token: string, file: File): Promise<FoodHotelPhoto> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'FOOD_HOTEL');
  const response = await fetch(`${API_BASE}/api/v1/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const payload = (await response.json()) as {
    message?: string;
    data?: { mediaId?: string; url?: string };
  };
  if (!response.ok || !payload.data?.mediaId || !payload.data?.url) {
    throw new Error(payload.message || 'Image upload failed');
  }
  return { mediaId: payload.data.mediaId, url: payload.data.url };
}