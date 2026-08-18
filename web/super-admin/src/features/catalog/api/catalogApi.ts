import { apiRequest, type PageData } from '@/shared/api/http';

export type MasterItemVm = {
  id: string;
  name: string;
  categoryId?: string | null;
  categoryName?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  mrp?: number | null;
  status: string;
  imageUrls: string[];
};

export type CategoryVm = {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  status?: string;
  hiddenTownCount?: number;
  liveTownCount?: number;
};

export type UnitVm = { id: string; code: string; displayName?: string; label?: string };

export type MasterItemPage = {
  items: MasterItemVm[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type UploadedMedia = {
  mediaId: string;
  url: string;
  contentType?: string;
};

type MasterItemDto = {
  id?: string;
  masterItemId?: string;
  categoryId?: string | null;
  unitId?: string | null;
  name: string;
  category?: string | null;
  categoryName?: string | null;
  unit?: string | null;
  unitName?: string | null;
  unitCode?: string | null;
  mrp?: number | null;
  status?: string;
  imageUrls?: string[] | null;
};

export type CreateMasterItemInput = {
  categoryId: string;
  unitId: string;
  name: string;
  description?: string;
  mrp?: number;
};

export type CreateCategoryInput = {
  name: string;
  description?: string;
};

function mapMaster(i: MasterItemDto): MasterItemVm {
  return {
    id: i.id ?? i.masterItemId ?? '',
    name: i.name,
    categoryId: i.categoryId ?? null,
    categoryName: i.categoryName ?? i.category,
    unitId: i.unitId ?? null,
    unitName: i.unitName ?? i.unit ?? i.unitCode,
    mrp: i.mrp,
    status: i.status ?? 'ACTIVE',
    imageUrls: i.imageUrls ?? [],
  };
}

export async function listMasterItemsPage(
  token: string,
  opts: {
    page?: number;
    size?: number;
    q?: string;
    categoryId?: string;
    unitId?: string;
    sort?: string;
    dir?: string;
  } = {},
): Promise<MasterItemPage> {
  const params = new URLSearchParams({
    page: String(opts.page ?? 0),
    size: String(opts.size ?? 25),
    sort: opts.sort ?? 'name',
    dir: opts.dir ?? 'asc',
  });
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.categoryId) params.set('categoryId', opts.categoryId);
  if (opts.unitId) params.set('unitId', opts.unitId);
  const data = await apiRequest<PageData<MasterItemDto>>(
    `/api/v1/catalog/master-items?${params}`,
    { token },
  );
  return {
    items: (data.items ?? []).map(mapMaster),
    page: data.page ?? 0,
    size: data.size ?? opts.size ?? 25,
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
  };
}

export async function listCategories(token: string): Promise<CategoryVm[]> {
  const data = await apiRequest<{ items: CategoryVm[] }>('/api/v1/catalog/categories', { token });
  return data.items ?? [];
}

export async function listUnits(token: string): Promise<UnitVm[]> {
  const data = await apiRequest<{ items: UnitVm[] }>('/api/v1/catalog/units', { token });
  return data.items ?? [];
}

export async function createMasterItem(
  token: string,
  input: CreateMasterItemInput,
): Promise<MasterItemVm> {
  const created = await apiRequest<MasterItemDto>('/api/v1/catalog/master-items', {
    method: 'POST',
    token,
    body: input,
  });
  return mapMaster(created);
}

export async function updateMasterItem(
  token: string,
  masterItemId: string,
  input: CreateMasterItemInput,
): Promise<MasterItemVm> {
  const updated = await apiRequest<MasterItemDto>(`/api/v1/catalog/master-items/${masterItemId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return mapMaster(updated);
}

export async function deleteMasterItem(token: string, masterItemId: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/v1/catalog/master-items/${masterItemId}`, {
    method: 'DELETE',
    token,
  });
}

export async function createCategory(
  token: string,
  input: CreateCategoryInput,
): Promise<CategoryVm> {
  return apiRequest<CategoryVm>('/api/v1/catalog/categories', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function deleteCategory(token: string, categoryId: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/v1/catalog/categories/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

export async function updateCategory(
  token: string,
  categoryId: string,
  input: CreateCategoryInput,
): Promise<CategoryVm> {
  return apiRequest<CategoryVm>(`/api/v1/catalog/categories/${categoryId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function setCategoryPaused(
  token: string,
  categoryId: string,
  paused: boolean,
): Promise<CategoryVm> {
  return apiRequest<CategoryVm>(`/api/v1/catalog/categories/${categoryId}/visibility`, {
    method: 'PATCH',
    token,
    body: { paused },
  });
}

export async function setAllCategoriesPaused(
  token: string,
  paused: boolean,
): Promise<{ paused: boolean; updatedCount: number }> {
  const data = await apiRequest<{ paused: boolean; updatedCount: number }>(
    '/api/v1/catalog/categories/visibility',
    {
      method: 'PATCH',
      token,
      body: { paused },
    },
  );
  return { paused: Boolean(data.paused), updatedCount: data.updatedCount ?? 0 };
}

export type CategoryTownVisibilityVm = {
  categoryId: string;
  paused: boolean;
  hiddenTownIds: string[];
  liveTownIds: string[];
};

export async function getCategoryTownVisibility(
  token: string,
  categoryId: string,
): Promise<CategoryTownVisibilityVm> {
  const data = await apiRequest<CategoryTownVisibilityVm>(
    `/api/v1/catalog/categories/${categoryId}/town-visibility`,
    { token },
  );
  return {
    categoryId: data.categoryId,
    paused: Boolean(data.paused),
    hiddenTownIds: data.hiddenTownIds ?? [],
    liveTownIds: data.liveTownIds ?? [],
  };
}

export async function setCategoryTownVisibility(
  token: string,
  categoryId: string,
  visible: boolean,
  townIds: string[],
): Promise<CategoryVm> {
  const unique = [...new Set(townIds)];
  let last: CategoryVm | null = null;
  for (let i = 0; i < unique.length; i += 2000) {
    last = await apiRequest<CategoryVm>(`/api/v1/catalog/categories/${categoryId}/town-visibility`, {
      method: 'PUT',
      token,
      body: { visible, townIds: unique.slice(i, i + 2000) },
    });
  }
  if (!last) throw new Error('Select at least one town');
  return last;
}

export async function uploadCatalogImage(token: string, file: File): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', file);
  form.append('context', 'CATALOG_PRODUCT');
  const response = await fetch('/api/v1/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: form,
  });
  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: UploadedMedia;
  };
  if (!response.ok || !payload.data?.mediaId || !payload.data?.url) {
    throw new Error(payload.message || 'Image upload failed');
  }
  return payload.data;
}

export async function setMasterItemImages(
  token: string,
  masterItemId: string,
  images: Array<{ mediaId: string; url: string }>,
): Promise<string[]> {
  const data = await apiRequest<{ items: string[] }>(
    `/api/v1/catalog/master-items/${masterItemId}/images`,
    {
      method: 'PUT',
      token,
      body: { images },
    },
  );
  return data.items ?? [];
}
