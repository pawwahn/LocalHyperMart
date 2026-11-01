export const HOME_RAIL_SECTION_IDS = {
  offers: 'hlm-home-rail-offers',
  skincare: 'hlm-home-rail-skincare',
  fresh: 'hlm-home-rail-fresh',
  farm: 'hlm-home-rail-farm',
} as const;

export type ShopHomeJumpIcon = 'deals' | 'beauty' | 'fresh' | 'farm';

export type ShopHomeJumpCard = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  accent: string;
  brandTag?: string;
  icon: ShopHomeJumpIcon;
  sectionId: string;
};

export function buildShopHomeJumpCards(townLabel: string): ShopHomeJumpCard[] {
  const town = townLabel?.trim() || 'your town';
  return [
    {
      id: 'jump-offers',
      title: 'Offers in your town',
      subtitle: `Top discounts in ${town}`,
      ctaLabel: 'View deals',
      accent: '#009111',
      brandTag: 'Deals',
      icon: 'deals',
      sectionId: HOME_RAIL_SECTION_IDS.offers,
    },
    {
      id: 'jump-skincare',
      title: 'Best in skincare',
      subtitle: 'Serums, creams and daily care',
      ctaLabel: 'Browse',
      accent: '#BE185D',
      brandTag: 'Beauty',
      icon: 'beauty',
      sectionId: HOME_RAIL_SECTION_IDS.skincare,
    },
    {
      id: 'jump-fresh',
      title: 'Fresh Store',
      subtitle: 'Dairy, bread, eggs and staples',
      ctaLabel: 'Shop fresh',
      accent: '#0F766E',
      brandTag: 'Fresh',
      icon: 'fresh',
      sectionId: HOME_RAIL_SECTION_IDS.fresh,
    },
    {
      id: 'jump-farm',
      title: 'Farm to door',
      subtitle: 'Vegetables and fruits from local shops',
      ctaLabel: 'Explore',
      accent: '#CA8A04',
      brandTag: 'Produce',
      icon: 'farm',
      sectionId: HOME_RAIL_SECTION_IDS.farm,
    },
  ];
}

export function scrollToHomeRailSection(sectionId: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(sectionId);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  el.classList.add('hlm-home-rail-flash');
  window.setTimeout(() => el.classList.remove('hlm-home-rail-flash'), 900);
}
