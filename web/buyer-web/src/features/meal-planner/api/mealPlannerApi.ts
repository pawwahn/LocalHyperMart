import { apiRequest } from '@/shared/api/http';

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
