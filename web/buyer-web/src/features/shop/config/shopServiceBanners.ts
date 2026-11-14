export type ShopServiceBanner = {
  id: 'grocery' | 'glam' | 'laundry' | 'diagnostics' | 'food';
  to: string;
  title: string;
  hint: string;
  cta: string;
  ariaLabel: string;
  accent: string;
};

export function buildShopServiceBanners(opts: {
  groceryEnabled?: boolean;
  beautyEnabled: boolean;
  laundryEnabled: boolean;
  diagnosticsEnabled?: boolean;
  foodDeliveryEnabled?: boolean;
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
  if (opts.diagnosticsEnabled) {
    banners.push({
      id: 'diagnostics',
      to: '/diagnostics',
      title: 'Koya Diagnostics',
      hint: 'Home sample collection · trusted local labs',
      cta: 'Book',
      ariaLabel: 'Book diagnostics home collection',
      accent: '#0D9488',
    });
  }
  if (opts.foodDeliveryEnabled) {
    banners.push({
      id: 'food',
      to: '/food',
      title: 'Koya Food',
      hint: 'Order from local hotels · one restaurant per cart',
      cta: 'Order',
      ariaLabel: 'Order food delivery from local hotels',
      accent: '#EA580C',
    });
  }
  const showGrocery = opts.groceryEnabled !== false;
  if (showGrocery) {
    banners.unshift({
      id: 'grocery',
      to: '/shop',
      title: 'Koya Grocery',
      hint: 'Quick delivery · everyday essentials in your town',
      cta: 'Shop',
      ariaLabel: 'Shop grocery and essentials',
      accent: '#009111',
    });
  }
  return banners;
}
