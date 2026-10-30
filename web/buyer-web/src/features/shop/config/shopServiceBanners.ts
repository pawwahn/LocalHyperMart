export type ShopServiceBanner = {
  id: string;
  to: string;
  title: string;
  hint: string;
  cta: string;
  emoji: string;
  ariaLabel: string;
  background: string;
  ctaColor: string;
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
      hint: 'Book makeup artists near you · home or studio',
      cta: 'Book',
      emoji: '💄',
      ariaLabel: 'Book makeup and beauty',
      background:
        'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.25) 0%, transparent 55%), linear-gradient(125deg, #831843 0%, #db2777 55%, #f472b6 100%)',
      ctaColor: '#be185d',
    });
  }
  if (opts.laundryEnabled) {
    banners.push({
      id: 'laundry',
      to: '/laundry',
      title: 'Koya Laundry',
      hint: 'Wash & iron · pickup and delivery in your town',
      cta: 'Book',
      emoji: '🧺',
      ariaLabel: 'Book laundry pickup and delivery',
      background:
        'linear-gradient(105deg, #0a5c28 0%, #0C831F 52%, color-mix(in srgb, #0C831F 62%, #fff) 100%)',
      ctaColor: '#0C831F',
    });
  }
  return banners;
}
