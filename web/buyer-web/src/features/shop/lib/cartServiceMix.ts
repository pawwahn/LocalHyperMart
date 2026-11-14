import { ApiError } from '@/shared/api/http';

export type CartServiceMixConflict = 'food_blocks_other' | 'grocery_blocks_food';

export type CartListingKind = 'GROCERY' | 'FOOD_MENU';

export function parseCartServiceMixConflict(err: unknown): CartServiceMixConflict | null {
  const raw = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '';
  if (/clear your food cart before adding grocery/i.test(raw)) {
    return 'food_blocks_other';
  }
  if (/clear your grocery cart before adding food/i.test(raw)) {
    return 'grocery_blocks_food';
  }
  return null;
}