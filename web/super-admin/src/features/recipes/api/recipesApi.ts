import { apiRequest, type PageData } from '@/shared/api/http';

export type AdminRecipeSummary = {
  id: string;
  name: string;
  servings: number;
  enabled: boolean;
  ingredientCount: number;
  updatedAt?: string;
};

export type AdminRecipeIngredient = {
  id?: string;
  masterItemId: string;
  masterItemName?: string;
  quantityLabel: string;
  sortOrder?: number;
};

export type AdminRecipeDetail = {
  id: string;
  name: string;
  searchText: string;
  servings: number;
  enabled: boolean;
  ingredients: AdminRecipeIngredient[];
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertRecipeInput = {
  name: string;
  searchText?: string;
  servings: number;
  enabled: boolean;
  ingredients: Array<{ masterItemId: string; quantityLabel: string; sortOrder?: number }>;
};

export async function fetchAdminRecipes(
  token: string,
  opts?: { q?: string; page?: number; size?: number },
): Promise<PageData<AdminRecipeSummary>> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set('q', opts.q.trim());
  params.set('page', String(opts?.page ?? 0));
  params.set('size', String(opts?.size ?? 50));
  return apiRequest<PageData<AdminRecipeSummary>>(`/api/v1/catalog/admin/recipes?${params}`, { token });
}

export async function fetchAdminRecipe(token: string, recipeId: string): Promise<AdminRecipeDetail> {
  return apiRequest<AdminRecipeDetail>(`/api/v1/catalog/admin/recipes/${recipeId}`, { token });
}

export async function createAdminRecipe(token: string, input: UpsertRecipeInput): Promise<AdminRecipeDetail> {
  return apiRequest<AdminRecipeDetail>('/api/v1/catalog/admin/recipes', {
    token,
    method: 'POST',
    body: input,
  });
}

export async function updateAdminRecipe(
  token: string,
  recipeId: string,
  input: UpsertRecipeInput,
): Promise<AdminRecipeDetail> {
  return apiRequest<AdminRecipeDetail>(`/api/v1/catalog/admin/recipes/${recipeId}`, {
    token,
    method: 'PUT',
    body: input,
  });
}

export async function deleteAdminRecipe(token: string, recipeId: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/v1/catalog/admin/recipes/${recipeId}`, {
    token,
    method: 'DELETE',
  });
}
