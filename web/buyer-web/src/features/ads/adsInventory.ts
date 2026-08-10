/**
 * Pilot ad inventory for buyer portal monetization slots.
 * Town-scoped: switching town swaps creatives. Replace with ads API later.
 *
 * Ownership (locked):
 * - Only **super admin** may create/edit/pause ads.
 * - Not town hub admin, not delivery hub, not vendors, not buyers.
 * - Creatives are still served per town (townId) to buyers.
 * Revert scope: features/ads + AdSlot usages in PortalShell / Shop / Cart.
 */

export type AdSlotId = 'home_hero' | 'home_mid_grid' | 'home_search_strip' | 'cart_upsell';

/** Slots currently shown in the buyer UI. `home_search_strip` reserved for later. */
export const ACTIVE_HOME_SLOTS: AdSlotId[] = ['home_hero', 'home_mid_grid'];

export type AdCreative = {
  id: string;
  /** Empty / '*' = show in any town as fallback when no town-specific ad exists. */
  townId: string | '*';
  slot: AdSlotId;
  sponsor: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  /** Soft background tint */
  tint: string;
  emoji: string;
  /** Optional creative image from super-admin upload. */
  imageUrl?: string;
  /** Up to 3 images for swipe carousel. */
  imageUrls?: string[];
  href?: string;
};

export const ADS_ENABLED = true;

/** Stable pilot town IDs (town-service seeds). */
export const TOWN_NARSARAOPET = 'a1111111-1111-4111-8111-111111111111';
export const TOWN_CHIRALA = 'a8e7366c-2bd8-4376-b18b-7ba110f4d69f';

export const PILOT_ADS: AdCreative[] = [
  // —— Narsaraopet ——
  {
    id: 'nrpt-hero-milk',
    townId: TOWN_NARSARAOPET,
    slot: 'home_hero',
    sponsor: 'Ravi Dairy',
    title: 'Farm-fresh milk every morning',
    subtitle: 'Order by 8 AM · COD available',
    ctaLabel: 'Shop milk',
    tint: 'linear-gradient(135deg, #E8F8EC 0%, #D4F0DC 100%)',
    emoji: '🥛',
  },
  {
    id: 'nrpt-mid-atta',
    townId: TOWN_NARSARAOPET,
    slot: 'home_mid_grid',
    sponsor: 'Siva Kirana',
    title: 'Atta & dal combo packs',
    subtitle: 'Save on weekly staples',
    ctaLabel: 'View deals',
    tint: 'linear-gradient(135deg, #FFF8E8 0%, #EAF8EF 100%)',
    emoji: '🌾',
  },
  {
    id: 'nrpt-cart-fill',
    townId: TOWN_NARSARAOPET,
    slot: 'cart_upsell',
    sponsor: 'HyperLocalMart',
    title: 'Add biscuits & get free delivery on next trip',
    subtitle: 'Sponsored suggestion for your cart',
    ctaLabel: 'Add from shop',
    tint: 'linear-gradient(135deg, #E7F6EC 0%, #FFF6D6 100%)',
    emoji: '🛒',
  },

  // —— Chirala ——
  {
    id: 'clx-hero-seafood',
    townId: TOWN_CHIRALA,
    slot: 'home_hero',
    sponsor: 'Coastal Catch',
    title: 'Fresh catch from Chirala harbour',
    subtitle: 'Same-day · ice-packed · COD',
    ctaLabel: 'Shop fish',
    tint: 'linear-gradient(135deg, #E6F4FF 0%, #D6EBFF 100%)',
    emoji: '🐟',
  },
  {
    id: 'clx-mid-snacks',
    townId: TOWN_CHIRALA,
    slot: 'home_mid_grid',
    sponsor: 'R K Fancy',
    title: 'Murukku & ghee packs',
    subtitle: 'Local favourites for evening tea',
    ctaLabel: 'Browse snacks',
    tint: 'linear-gradient(135deg, #FFF0E8 0%, #FFE8F0 100%)',
    emoji: '🥨',
  },
  {
    id: 'clx-cart-fill',
    townId: TOWN_CHIRALA,
    slot: 'cart_upsell',
    sponsor: 'HyperLocalMart Chirala',
    title: 'Add coconut oil — free delivery over ₹299',
    subtitle: 'Sponsored suggestion for your cart',
    ctaLabel: 'Add from shop',
    tint: 'linear-gradient(135deg, #E7F6EC 0%, #E8F4FF 100%)',
    emoji: '🥥',
  },

  // —— Fallback (any other town) ——
  {
    id: 'any-hero-local',
    townId: '*',
    slot: 'home_hero',
    sponsor: 'HyperLocalMart',
    title: 'Same-day groceries from your town',
    subtitle: 'Local shops · COD available',
    ctaLabel: 'Start shopping',
    tint: 'linear-gradient(135deg, #E8F8EC 0%, #D4F0DC 100%)',
    emoji: '🛒',
  },
  {
    id: 'any-mid-deals',
    townId: '*',
    slot: 'home_mid_grid',
    sponsor: 'HyperLocalMart',
    title: 'Deals from neighbourhood shops',
    subtitle: 'Sponsored · updates by town',
    ctaLabel: 'See deals',
    tint: 'linear-gradient(135deg, #FFF8E8 0%, #EAF8EF 100%)',
    emoji: '🏷️',
  },
  {
    id: 'any-cart-fill',
    townId: '*',
    slot: 'cart_upsell',
    sponsor: 'HyperLocalMart',
    title: 'Add a snack for the ride home',
    subtitle: 'Sponsored suggestion for your cart',
    ctaLabel: 'Add from shop',
    tint: 'linear-gradient(135deg, #E7F6EC 0%, #FFF6D6 100%)',
    emoji: '🍪',
  },
];

/** Resolve creative for a slot in the buyer's current town. */
export function getAdForSlot(slot: AdSlotId, townId?: string | null): AdCreative | null {
  if (!ADS_ENABLED) return null;
  const tid = townId?.trim() || '';
  if (tid) {
    const forTown = PILOT_ADS.find((ad) => ad.slot === slot && ad.townId === tid);
    if (forTown) return forTown;
  }
  return PILOT_ADS.find((ad) => ad.slot === slot && ad.townId === '*') ?? null;
}
