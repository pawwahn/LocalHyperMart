/** Consumer-facing brand. Legal/invoice name can still come from platform settings. */
export const APP_NAME = 'KoyaKart';

/** Intrinsic pixels of bundled logo art (sharp scaling in CSS). */
export const DEFAULT_BRAND_LOGO_SIZE = { width: 1254, height: 1254 } as const;

function brandPublicUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}brand/${file}`;
}

/** Bundled logo — prefer PNG in UI; JPG fallback. */
export function defaultBrandLogoUrl(preferPng = true): string {
  return preferPng ? brandPublicUrl('koyakart-logo.png') : brandPublicUrl('koyakart-logo.jpg');
}
