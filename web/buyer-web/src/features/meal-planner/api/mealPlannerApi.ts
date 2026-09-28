import { apiRequest } from '@/shared/api/http';
import type { CatalogItemView } from '@/features/shop/api/shopApi';

export type RecipeSummary = {
  id: string;
  name: string;
  servings: number;
};

export type RecipeShopLine = {
  masterItemId: string;
  masterItemName: string;
  quantityLabel: string;
  listingId: string | null;
  shopName: string | null;
  effectivePrice: number | null;
  imageUrl: string | null;
  available: boolean;
};

export type RecipeShopPlan = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeShopLine[];
};

export function recipeLineToCatalogItem(line: RecipeShopLine): CatalogItemView | null {
  if (!line.listingId) return null;
  const price = Number(line.effectivePrice ?? 0);
  const imageUrl = line.imageUrl?.trim() || null;
  return {
    listingId: line.listingId,
    name: line.masterItemName,
    shopName: line.shopName ?? '',
    unit: line.quantityLabel,
    price,
    priceLabel: `₹${price.toFixed(2)}`,
    avgRating: 0,
    ratingCount: 0,
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
  };
}

export async function searchRecipes(q: string): Promise<RecipeSummary[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  const suffix = params.toString() ? `?${params}` : '';
  const data = await apiRequest<{ items: RecipeSummary[] }>(`/api/v1/catalog/recipes${suffix}`, {
    timeoutMs: 10_000,
  });
  return data.items ?? [];
}

export async function fetchRecipePlan(recipeId: string, townId: string): Promise<RecipeShopPlan> {
  const params = new URLSearchParams({ townId });
  return apiRequest<RecipeShopPlan>(`/api/v1/catalog/recipes/${recipeId}?${params}`, {
    timeoutMs: 12_000,
  });
}
