import { apiRequest, type PageData } from '@/shared/api/http';

export type MasterItemVm = {
  id: string;
  name: string;
  categoryName?: string | null;
  unitName?: string | null;
  mrp?: number | null;
  status: string;
};

export type CategoryVm = { id: string; name: string; parentId?: string | null };
export type UnitVm = { id: string; code: string; displayName?: string; label?: string };

type MasterItemDto = {
  id?: string;
  masterItemId?: string;
  name: string;
  category?: string | null;
  categoryName?: string | null;
  unit?: string | null;
  unitName?: string | null;
  unitCode?: string | null;
  mrp?: number | null;
  status?: string;
};

export type CreateMasterItemInput = {
  categoryId: string;
  unitId: string;
  name: string;
  description?: string;
  mrp?: number;
};

export async function listMasterItems(token: string): Promise<MasterItemVm[]> {
  const data = await apiRequest<PageData<MasterItemDto>>('/api/v1/catalog/master-items?page=0&size=100', {
    token,
  });
  return (data.items ?? []).map((i) => ({
    id: i.id ?? i.masterItemId ?? '',
    name: i.name,
    categoryName: i.categoryName ?? i.category,
    unitName: i.unitName ?? i.unit ?? i.unitCode,
    mrp: i.mrp,
    status: i.status ?? 'ACTIVE',
  }));
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
  return {
    id: created.id ?? created.masterItemId ?? '',
    name: created.name,
    categoryName: created.categoryName ?? created.category,
    unitName: created.unitName ?? created.unit ?? created.unitCode,
    mrp: created.mrp,
    status: created.status ?? 'ACTIVE',
  };
}
