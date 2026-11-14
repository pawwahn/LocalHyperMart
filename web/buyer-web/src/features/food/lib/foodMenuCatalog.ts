import type { CatalogItemView } from '@/features/shop/api/shopApi';
import type { BuyerFoodMenu } from '../api/foodApi';

/** Flatten a hotel menu into catalog tiles for cart upsell strips. */
export function foodMenuToCatalogItems(menu: BuyerFoodMenu): CatalogItemView[] {
  const shopName = menu.shopName?.trim() || 'Hotel';
  const out: CatalogItemView[] = [];
  for (const cat of menu.categories) {
    if (!cat.active) continue;
    for (const item of cat.items) {
      if (!item.active || !item.listingId?.trim()) continue;
      const price = Number(item.price);
      out.push({
        listingId: item.listingId.trim(),
        name: item.name,
        shopName,
        unit: item.veg ? 'Veg' : 'Non-veg',
        price: Number.isFinite(price) ? price : 0,
        priceLabel: `₹${(Number.isFinite(price) ? price : 0).toFixed(2)}`,
        avgRating: 0,
        ratingCount: 0,
        imageUrl: item.imageUrls?.[0] ?? null,
        imageUrls: item.imageUrls ?? [],
        outOfStock: false,
      });
    }
  }
  return out;
}