import { apiRequest } from '@/shared/api/http';
import type { AdCreative, AdSlotId } from '../adsInventory';
import { getAdForSlot } from '../adsInventory';

export type TownAdImageDto = {
  url: string;
  mediaId: string | null;
};

export type TownAdDto = {
  id: string;
  townId: string;
  slot: 'HOME_HERO' | 'HOME_MID_GRID' | 'CART_UPSELL';
  slotKey: string;
  shopName: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  images?: TownAdImageDto[];
  imageUrl: string | null;
  imageMediaId: string | null;
  enabled: boolean;
};

type TownAdsDto = {
  townId: string;
  items: TownAdDto[];
};

const SLOT_TINTS: Record<string, string> = {
  home_hero: 'linear-gradient(135deg, #E8F8EC 0%, #D4F0DC 100%)',
  home_mid_grid: 'linear-gradient(135deg, #FFF8E8 0%, #EAF8EF 100%)',
  cart_upsell: 'linear-gradient(135deg, #E7F6EC 0%, #FFF6D6 100%)',
};

export async function fetchTownAds(townId: string): Promise<TownAdDto[]> {
  const data = await apiRequest<TownAdsDto>(`/api/v1/towns/${townId}/ads`, { timeoutMs: 8_000 });
  return data.items ?? [];
}

function imageUrlsFromAd(ad: TownAdDto): string[] {
  const fromList = (ad.images ?? []).map((i) => i.url).filter(Boolean);
  if (fromList.length) return fromList.slice(0, 3);
  return ad.imageUrl ? [ad.imageUrl] : [];
}

export function apiAdToCreative(ad: TownAdDto): AdCreative {
  const slot = (ad.slotKey || 'home_hero') as AdSlotId;
  const imageUrls = imageUrlsFromAd(ad);
  return {
    id: ad.id,
    townId: ad.townId,
    slot,
    sponsor: ad.shopName,
    title: ad.headline,
    subtitle: ad.bodyText || '',
    ctaLabel: ad.ctaLabel || 'Shop now',
    tint: SLOT_TINTS[slot] ?? SLOT_TINTS.home_hero,
    emoji: '🛍️',
    imageUrl: imageUrls[0],
    imageUrls,
  };
}

/** Prefer live town ads; fall back to pilot inventory for empty slots. */
export function resolveCreative(
  slot: AdSlotId,
  townId: string | null | undefined,
  live: TownAdDto[] | null,
): AdCreative | null {
  if (live && townId) {
    const match = live.find((a) => a.slotKey === slot && a.enabled);
    const urls = match ? imageUrlsFromAd(match) : [];
    if (match?.shopName && match.headline && urls.length) {
      return apiAdToCreative(match);
    }
  }
  return getAdForSlot(slot, townId);
}
