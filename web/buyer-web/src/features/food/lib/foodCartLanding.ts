import type { CartView } from '@/features/shop/api/shopApi';
import { isFoodDeliveryCart } from './foodCartSignals';

/** Food-only basket → stay in the /food journey (hotel menu or town list). */
export function foodCartLandingPath(
  cart: Pick<CartView, 'foodCart' | 'foodVendorId' | 'items'> | null | undefined,
  foodBasketActive = false,
): string | null {
  if (!isFoodDeliveryCart(cart, foodBasketActive)) return null;
  return cart?.foodVendorId ? `/food/${cart.foodVendorId}` : '/food';
}