export type ShopServiceBanner = {
  id: 'glam' | 'laundry';
  to: string;
  title: string;
  hint: string;
  cta: string;
  ariaLabel: string;
  accent: string;
};

export function buildShopServiceBanners(opts: {
  beautyEnabled: boolean;
  laundryEnabled: boolean;
}): ShopServiceBanner[] {
  const banners: ShopServiceBanner[] = [];
  if (opts.beautyEnabled) {
    banners.push({
      id: 'glam',
      to: '/beauty',
      title: 'Koya Glam',
      hint: 'Makeup artists near you · home or studio',
      cta: 'Book',
      ariaLabel: 'Book makeup and beauty',
      accent: '#BE185D',
    });
  }
  if (opts.laundryEnabled) {
    banners.push({
      id: 'laundry',
      to: '/laundry',
      title: 'Koya Laundry',
      hint: 'Wash and iron · pickup in your town',
      cta: 'Book',
      ariaLabel: 'Book laundry pickup and delivery',
      accent: '#009111',
    });
  }
  return banners;
}
