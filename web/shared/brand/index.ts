export const APP_NAME = 'KoyaKart';

export { BrandMark } from './BrandMark';
export { PlatformBrandProvider, usePlatformBrand } from './PlatformBrandProvider';
export {
  fetchPlatformBrandPublic,
  resolveBrandLogoSrc,
  type PlatformBrandPublic,
} from './platformBrandApi';
export { applyBrandFavicon } from './applyBrandAssets';
