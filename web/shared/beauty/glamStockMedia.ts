import type { BeautyOccasionId, BeautyServiceId, BeautyVenueId } from './services';

/** Served from buyer-web `public/glam/` — respects Vite `base` for subpath / Capacitor builds. */
function glamAsset(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}glam/${relativePath}`.replace(/([^:]\/)\/+/g, '$1');
}

const glamUrl = (path: string) => glamAsset(path.replace(/^\//, ''));

export const GLAM_HERO_IMAGE = glamUrl('hero-480.jpg');
export const GLAM_HERO_SRCSET = `${glamUrl('hero-320.jpg')} 320w, ${glamUrl('hero-480.jpg')} 480w`;
export const GLAM_HERO_SIZES = '(max-width: 520px) 44vw, 10.5rem';
export const GLAM_HERO_BANNER_THUMB = glamUrl('hero-thumb.jpg');

export const GLAM_HERO_PEXELS = 30495792;

export const GLAM_SERVICE_FALLBACK_IMAGE = glamUrl('services/natural-glow.jpg');
export const GLAM_ARTIST_COVER_FALLBACK = glamUrl('artist-cover.jpg');
export const GLAM_REFERENCE_UPLOAD_BACKDROP = glamUrl('reference-backdrop.jpg');
export const GLAM_OCCASION_FALLBACK_IMAGE = glamUrl('occasions/party.jpg');
export const GLAM_VENUE_FALLBACK_IMAGE = glamUrl('venues/at-home.jpg');

const SERVICE_FILES: Record<BeautyServiceId, string> = {
  NATURAL_GLOW: 'natural-glow.jpg',
  PARTY_GLAM: 'party-glam.jpg',
  HD_CAMERA: 'hd-camera.jpg',
  BRIDAL_FULL: 'bridal-full.jpg',
  HAIR_STYLING: 'hair-styling.jpg',
  SAREE_DRAPE: 'saree-drape.jpg',
  MEHENDI: 'mehendi.jpg',
  MANICURE: 'manicure.jpg',
  PEDICURE: 'pedicure.jpg',
  FACIAL: 'facial.jpg',
  THREADING: 'threading.jpg',
  WAXING: 'waxing.jpg',
};

const VENUE_FILES: Record<BeautyVenueId, string> = {
  AT_HOME: 'at-home.jpg',
  AT_STUDIO: 'at-studio.jpg',
};

const OCCASION_FILES: Record<BeautyOccasionId, string> = {
  EVERYDAY: 'everyday.jpg',
  OFFICE: 'office.jpg',
  PARTY: 'party.jpg',
  ENGAGEMENT: 'engagement.jpg',
  BRIDAL: 'bridal.jpg',
  /** Pexels 20319221 — Diwali diyas / festive look (replaces mismatched studio stock). */
  FESTIVE: 'festive.jpg',
};

/** @deprecated Remote CDN — kept for tooling / one-off asset refresh only. */
export function pexelsImage(photoId: number, width: number, height?: number): string {
  const h = height ? `&h=${height}` : '';
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}${h}&fit=crop`;
}

/** @deprecated */
export function glamStockImage(photoId: string, width: number, height?: number): string {
  const h = height ? `&h=${height}` : '';
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}${h}&q=82`;
}

export function glamVenueImage(venueId: BeautyVenueId, _width = 640): string {
  const file = VENUE_FILES[venueId] ?? VENUE_FILES.AT_STUDIO;
  return glamUrl(`venues/${file}`);
}

export function glamOccasionImage(occasionId: string, _width = 420): string {
  const file = OCCASION_FILES[occasionId as BeautyOccasionId] ?? OCCASION_FILES.PARTY;
  return glamUrl(`occasions/${file}`);
}

/** 240×240 assets in `public/glam/services/` — sharp on 2× phones at 120px CSS. */
export function glamServiceImage(serviceType: string, _cssPx = 120): string {
  const file = SERVICE_FILES[serviceType as BeautyServiceId];
  if (file) return glamUrl(`services/${file}`);
  return GLAM_SERVICE_FALLBACK_IMAGE;
}

export function artistCoverImage(workPhotoUrl: string | undefined, _width = 520): string {
  if (workPhotoUrl?.trim()) return workPhotoUrl.trim();
  return GLAM_ARTIST_COVER_FALLBACK;
}