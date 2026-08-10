import { apiRequest } from '@/shared/api/http';

export type TownAdSlot = 'HOME_HERO' | 'HOME_MID_GRID' | 'CART_UPSELL';

export type TownAdImage = {
  url: string;
  mediaId: string | null;
};

export type TownAdVm = {
  id: string;
  townId: string;
  slot: TownAdSlot;
  slotKey: string;
  shopName: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  images: TownAdImage[];
  imageUrl: string | null;
  imageMediaId: string | null;
  enabled: boolean;
};

export type TownAdsVm = {
  townId: string;
  items: TownAdVm[];
};

export type UpsertTownAdInput = {
  slot: TownAdSlot;
  shopName: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  images: TownAdImage[];
  enabled: boolean;
};

export const MAX_AD_IMAGES = 3;

export const ALL_AD_SLOTS: TownAdSlot[] = ['HOME_HERO', 'HOME_MID_GRID', 'CART_UPSELL'];

export const SLOT_LABELS: Record<TownAdSlot, string> = {
  HOME_HERO: 'Home strip (top)',
  HOME_MID_GRID: 'Mid-grid (between products)',
  CART_UPSELL: 'Cart / checkout',
};

export const SLOT_TITLES: Record<TownAdSlot, string> = {
  HOME_HERO: 'Ad 1',
  HOME_MID_GRID: 'Ad 2',
  CART_UPSELL: 'Ad 3',
};

export async function fetchTownAdsEditor(token: string, townId: string): Promise<TownAdsVm> {
  return apiRequest<TownAdsVm>(`/api/v1/towns/${townId}/ads/editor`, { token });
}

export async function saveTownAds(
  token: string,
  townId: string,
  items: UpsertTownAdInput[],
): Promise<TownAdsVm> {
  return apiRequest<TownAdsVm>(`/api/v1/towns/${townId}/ads`, {
    method: 'PUT',
    token,
    body: { items },
  });
}

export type UploadedMedia = {
  mediaId: string;
  url: string;
};

export async function uploadAdImage(token: string, file: File): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'TOWN_AD');
  let response: Response;
  try {
    response = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw new Error('Cannot reach media service. Is it running on port 8091?');
  }
  let payload: { success?: boolean; message?: string; data?: UploadedMedia } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    /* gateway may return non-JSON when media-service is down */
  }
  if (!response.ok || !payload.data?.mediaId || !payload.data?.url) {
    throw new Error(
      payload.message ||
        (response.status === 500 || response.status === 502 || response.status === 503
          ? 'Image upload failed — media service may be down. Restart it, then try again.'
          : `Image upload failed (${response.status})`),
    );
  }
  return payload.data;
}

export function normalizeAdImages(ad: TownAdVm): TownAdImage[] {
  if (ad.images?.length) {
    return ad.images.filter((i) => i?.url).slice(0, MAX_AD_IMAGES);
  }
  if (ad.imageUrl) {
    return [{ url: ad.imageUrl, mediaId: ad.imageMediaId }];
  }
  return [];
}
