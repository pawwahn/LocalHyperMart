/**
 * Pilot ad inventory for buyer portal monetization slots.
 * Replace with town-scoped ads API later — keep slot IDs stable.
 *
 * Ownership (do not change without product sign-off):
 * - Ads are town-level.
 * - Only platform/town admin can edit.
 * - Delivery hub admin has nothing to do with ads.
 * Revert scope: features/ads + AdSlot usages in PortalShell / Shop / Cart.
 */

export type AdSlotId = 'home_hero' | 'home_mid_grid' | 'home_search_strip' | 'cart_upsell';

/** Slots currently shown in the buyer UI. `home_search_strip` reserved for later. */
export const ACTIVE_HOME_SLOTS: AdSlotId[] = ['home_hero', 'home_mid_grid'];

export type AdCreative = {
  id: string;
  slot: AdSlotId;
  sponsor: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  /** Soft background tint */
  tint: string;
  emoji: string;
  href?: string;
};

export const ADS_ENABLED = true;

export const PILOT_ADS: AdCreative[] = [
  {
    id: 'hero-local-milk',
    slot: 'home_hero',
    sponsor: 'Ravi Dairy',
    title: 'Farm-fresh milk every morning',
    subtitle: 'Order by 8 AM · COD available',
    ctaLabel: 'Shop milk',
    tint: 'linear-gradient(120deg, #0C831F 0%, #149C2E 55%, #F8CB46 160%)',
    emoji: '🥛',
  },
  {
    id: 'mid-atta',
    slot: 'home_mid_grid',
    sponsor: 'Siva Kirana',
    title: 'Atta & dal combo packs',
    subtitle: 'Sponsored · Save on weekly staples',
    ctaLabel: 'View deals',
    tint: 'linear-gradient(135deg, #FFF6D6 0%, #E7F6EC 100%)',
    emoji: '🌾',
  },
  {
    id: 'search-snacks',
    slot: 'home_search_strip',
    sponsor: 'Town Snacks Co.',
    title: 'Evening snacks from nearby shops',
    subtitle: 'Sponsored',
    ctaLabel: 'Browse',
    tint: '#EEF1F4',
    emoji: '🍪',
  }, // reserved — not rendered on Home until a 3rd slot is needed
  {
    id: 'cart-fill',
    slot: 'cart_upsell',
    sponsor: 'HyperLocalMart',
    title: 'Add biscuits & get free delivery on next trip',
    subtitle: 'Sponsored suggestion for your cart',
    ctaLabel: 'Add from shop',
    tint: 'linear-gradient(135deg, #E7F6EC 0%, #FFF6D6 100%)',
    emoji: '🛒',
  },
];

export function getAdForSlot(slot: AdSlotId): AdCreative | null {
  if (!ADS_ENABLED) return null;
  return PILOT_ADS.find((ad) => ad.slot === slot) ?? null;
}
