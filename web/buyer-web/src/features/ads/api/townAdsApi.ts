import { apiRequest } from '@/shared/api/http';
import type { AdCreative, AdSlotId } from '../adsInventory';

export type TownAdImageDto = {
  url: string;
  mediaId: string | null;
};

export type TownAdDto = {
  id: string;
  townId: string;
  slot: 'HOME_HERO' | 'HOME_MID_GRID' | 'CART_UPSELL';
  slotKey: string;
  slotIndex: number;
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
    ctaLabel: ad.ctaLabel ?? '',
    tint: SLOT_TINTS[slot] ?? SLOT_TINTS.home_hero,
    emoji: '🛍️',
    imageUrl: imageUrls[0],
    imageUrls,
  };
}

/** Prefer live town ads. Do not substitute dummy/pilot ads once the town feed has loaded. */
export function resolveCreative(
  slot: AdSlotId,
  townId: string | null | undefined,
  live: TownAdDto[] | null,
): AdCreative | null {
  const list = resolveCreatives(slot, townId, live);
  return list[0] ?? null;
}

function matchesSlot(ad: TownAdDto, slot: AdSlotId): boolean {
  if (ad.slotKey === slot) return true;
  return (ad.slot ?? '').toLowerCase() === slot;
}

function isLiveRenderable(ad: TownAdDto): boolean {
  return Boolean(ad.enabled && ad.shopName && ad.headline && imageUrlsFromAd(ad).length);
}

/** All enabled creatives for a slot (mid-grid returns up to 5 carousel slides). */
export function resolveCreatives(
  slot: AdSlotId,
  townId: string | null | undefined,
  live: TownAdDto[] | null,
): AdCreative[] {
  if (!townId || live == null) return [];
  return live
    .filter((a) => matchesSlot(a, slot))
    .filter(isLiveRenderable)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
    .map(apiAdToCreative);
}
