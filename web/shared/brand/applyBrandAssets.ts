import { resolveBrandLogoSrc } from './platformBrandApi';

export function applyBrandFavicon(logoUrl: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const href = resolveBrandLogoSrc(logoUrl);
  const existing = document.querySelector<HTMLLinkElement>('link[data-hlm-brand-icon="1"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = href;
  link.setAttribute('data-hlm-brand-icon', '1');
  if (!existing) {
    document.head.appendChild(link);
  }
}
