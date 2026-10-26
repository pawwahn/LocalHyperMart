export const HOME_RAIL_SECTION_IDS = {
  offers: 'hlm-home-rail-offers',
  skincare: 'hlm-home-rail-skincare',
  fresh: 'hlm-home-rail-fresh',
  farm: 'hlm-home-rail-farm',
} as const;

export type ShopHomeJumpCard = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  background: string;
  textTone: 'light' | 'dark';
  brandTag?: string;
  emojis: string[];
  sectionId: string;
};

export function buildShopHomeJumpCards(townLabel: string): ShopHomeJumpCard[] {
  const town = townLabel?.trim() || 'your town';
  return [
    {
      id: 'jump-offers',
      title: 'Offers in your town',
      subtitle: `Top discounts live in ${town} today`,
      ctaLabel: 'Shop now',
      background:
        'radial-gradient(120% 140% at 100% 0%, rgba(247,206,70,0.28) 0%, transparent 55%), linear-gradient(135deg, #0A6E1C 0%, #0C831F 48%, #16A34A 100%)',
      textTone: 'light',
      brandTag: 'Deals',
      emojis: ['🏷️', '🎁', '✨'],
      sectionId: HOME_RAIL_SECTION_IDS.offers,
    },
    {
      id: 'jump-skincare',
      title: 'Best in skincare',
      subtitle: 'Serums, creams & daily care picks',
      ctaLabel: 'Try now',
      background:
        'radial-gradient(90% 120% at 95% 85%, rgba(255,255,255,0.35) 0%, transparent 50%), linear-gradient(145deg, #F472B6 0%, #EC4899 38%, #DB2777 100%)',
      textTone: 'light',
      brandTag: 'Beauty',
      emojis: ['🧴', '💄', '🪞'],
      sectionId: HOME_RAIL_SECTION_IDS.skincare,
    },
    {
      id: 'jump-fresh',
      title: 'Fresh Store',
      subtitle: 'Dairy, bread, eggs & morning staples',
      ctaLabel: 'Shop now',
      background:
        'radial-gradient(110% 100% at 0% 100%, rgba(255,255,255,0.25) 0%, transparent 45%), linear-gradient(135deg, #0C831F 0%, #16A34A 50%, #4ADE80 100%)',
      textTone: 'light',
      brandTag: 'Fresh',
      emojis: ['🥛', '🍞', '🥚'],
      sectionId: HOME_RAIL_SECTION_IDS.fresh,
    },
    {
      id: 'jump-farm',
      title: 'Farm to Door',
      subtitle: 'Vegetables & fruits from local shops',
      ctaLabel: 'Explore',
      background:
        'radial-gradient(100% 90% at 85% 15%, rgba(255,255,255,0.2) 0%, transparent 50%), linear-gradient(135deg, #CA8A04 0%, #EAB308 38%, #FDE047 100%)',
      textTone: 'dark',
      brandTag: 'Local',
      emojis: ['🥬', '🍎', '🥕'],
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
