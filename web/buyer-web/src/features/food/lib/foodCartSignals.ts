import type { CartView } from '@/features/shop/api/shopApi';
import { fetchFoodHotels } from '../api/foodApi';

export function isFoodDeliveryCart(
  cart: Pick<CartView, 'foodCart' | 'foodVendorId' | 'items'> | null | undefined,
  foodBasketActive = false,
): boolean {
  if (!cart?.items?.length) return false;
  return Boolean(cart.foodCart || cart.foodVendorId || foodBasketActive);
}

/** When API `foodCart` lags, still upsell from the hotel menu (not grocery). */
export function shouldShowHotelMenuUpsell(
  cart: CartView | null | undefined,
  foodBasketActive: boolean,
): boolean {
  if (!cart?.items?.length) return false;
  if (isFoodDeliveryCart(cart, foodBasketActive)) return true;
  const shop = cart.items[0]?.shopName?.trim() ?? '';
  if (!shop || !cart.items.every((i) => i.shopName?.trim() === shop)) return false;
  if (/(mart|grocery|essentials|pantry|store)/i.test(shop)) return false;
  return true;
}

export async function resolveFoodVendorIdForCart(
  cart: Pick<CartView, 'foodVendorId' | 'items'>,
  townId: string,
  token: string,
): Promise<string | null> {
  const fromApi = cart.foodVendorId?.trim();
  if (fromApi) return fromApi;
  const shop = cart.items[0]?.shopName?.trim();
  if (!shop) return null;
  try {
    const hotels = await fetchFoodHotels(token, townId);
    const hit = hotels.find((h) => {
      const a = (h.shopName || h.businessName || '').trim();
      return a.length > 0 && a.toLowerCase() === shop.toLowerCase();
    });
    return hit?.vendorId?.trim() || null;
  } catch {
    return null;
  }
}