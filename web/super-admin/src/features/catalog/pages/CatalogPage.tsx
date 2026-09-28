import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button, ConfirmDialog, SearchSelect, TextField, Toast } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import {
  createCategory,
  createMasterItem,
  deleteCategory,
  deleteMasterItem,
  fetchMasterItem,
  listCategories,
  listMasterItemsPage,
  listUnits,
  setMasterItemImages,
  setCategoryImage,
  updateCategory,
  updateMasterItem,
  uploadCatalogImage,
  setCategoryPaused,
  setAllCategoriesPaused,
  type CategoryVm,
  type MasterItemVm,
  type UnitVm,
  type UploadedMedia,
} from '../api/catalogApi';
import { CategoryTownVisibilityDialog } from '../components/CategoryTownVisibilityDialog';

const PAGE_SIZE = 25;
const CAT_PAGE_SIZE = 15;
const GST_SLAB_OPTIONS = ['0', '0.25', '3', '5', '12', '18', '28'] as const;

function formatGstSlab(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '18';
  const match = GST_SLAB_OPTIONS.find((g) => Number(g) === Number(value));
  return match ?? String(value);
}

function isValidHsn(value: string): boolean {
  return /^[0-9]{4,8}$/.test(value.trim());
}

function enrichMasterItemRow(
  item: MasterItemVm,
  categories: CategoryVm[],
  units: UnitVm[],
): MasterItemVm {
  return {
    ...item,
    categoryName:
      item.categoryName ??
      categories.find((c) => c.id === item.categoryId)?.name ??
      null,
    unitName:
      item.unitName ??
      units.find((u) => u.id === item.unitId)?.displayName ??
      units.find((u) => u.id === item.unitId)?.label ??
      units.find((u) => u.id === item.unitId)?.code ??
      null,
  };
}

const GST_FILTER_OPTIONS = [
  { value: '', label: 'All GST' },
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
] as const;

function patchMasterItemRow(
  prev: MasterItemVm[],
  updated: MasterItemVm,
  categories: CategoryVm[],
  units: UnitVm[],
  filterCategoryId: string,
  filterGstPercent: string,
): MasterItemVm[] {
  const row = enrichMasterItemRow(updated, categories, units);
  if (filterCategoryId && row.categoryId !== filterCategoryId) {
    return prev.filter((i) => i.id !== row.id);
  }
  if (filterGstPercent) {
    const slab = Number(filterGstPercent);
    const rowGst = row.gstPercent ?? null;
    if (rowGst == null || rowGst !== slab) {
      return prev.filter((i) => i.id !== row.id);
    }
  }
  const idx = prev.findIndex((i) => i.id === row.id);
  if (idx < 0) return prev;
  const next = [...prev];
  next[idx] = {
    ...next[idx],
    ...row,
    hsnCode: row.hsnCode ?? next[idx].hsnCode,
    gstPercent: row.gstPercent ?? next[idx].gstPercent,
    cessPercent: row.cessPercent ?? next[idx].cessPercent,
    priceIncludesTax: row.priceIncludesTax ?? next[idx].priceIncludesTax,
    countryOfOrigin: row.countryOfOrigin ?? next[idx].countryOfOrigin,
    imageUrls: row.imageUrls?.length ? row.imageUrls : next[idx].imageUrls,
  };
  return next;
}

function mergeItemTaxFromPrior(prev: MasterItemVm[], incoming: MasterItemVm[]): MasterItemVm[] {
  const prevById = new Map(prev.map((i) => [i.id, i]));
  return incoming.map((row) => {
    const prior = prevById.get(row.id);
    if (!prior) return row;
    return {
      ...row,
      hsnCode: row.hsnCode ?? prior.hsnCode,
      gstPercent: row.gstPercent ?? prior.gstPercent,
      cessPercent: row.cessPercent ?? prior.cessPercent,
      priceIncludesTax: row.priceIncludesTax ?? prior.priceIncludesTax,
      countryOfOrigin: row.countryOfOrigin ?? prior.countryOfOrigin,
    };
  });
}

type Tab = 'items' | 'categories' | 'history';
type ItemSortKey = 'name' | 'category' | 'unit' | 'mrp';
type CatSortKey = 'name' | 'description';
type SortDir = 'asc' | 'desc';

export function CatalogPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<MasterItemVm[]>([]);
  const [categories, setCategories] = useState<CategoryVm[]>([]);
  const [units, setUnits] = useState<UnitVm[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterUnitId, setFilterUnitId] = useState('');
  const [filterGstPercent, setFilterGstPercent] = useState('');
  const [itemSort, setItemSort] = useState<ItemSortKey>('name');
  const [itemDir, setItemDir] = useState<SortDir>('asc');
  const [catQuery, setCatQuery] = useState('');
  const [catSort, setCatSort] = useState<CatSortKey>('name');
  const [catDir, setCatDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [itemCreateToast, setItemCreateToast] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [busy, setBusy] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemSearchNames, setItemSearchNames] = useState('');
  const [itemMrp, setItemMrp] = useState('');
  const [itemHsn, setItemHsn] = useState('');
  const [itemGst, setItemGst] = useState('18');
  const [itemCess, setItemCess] = useState('0');
  const [itemTaxIncl, setItemTaxIncl] = useState(true);
  const [itemOrigin, setItemOrigin] = useState('IN');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUnitId, setItemUnitId] = useState('');

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CategoryVm | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<string | null>(null);
  const [pendingItemDelete, setPendingItemDelete] = useState<MasterItemVm | null>(null);
  const [itemDeleteAlert, setItemDeleteAlert] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryVm | null>(null);
  const [townsCategory, setTownsCategory] = useState<CategoryVm | null>(null);
  const [pendingPause, setPendingPause] = useState<CategoryVm | null>(null);
  const [pendingPauseAll, setPendingPauseAll] = useState<boolean | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingItem, setEditingItem] = useState<MasterItemVm | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemSearchNames, setEditItemSearchNames] = useState('');
  const [editItemCategoryId, setEditItemCategoryId] = useState('');
  const [editItemUnitId, setEditItemUnitId] = useState('');
  const [editItemMrp, setEditItemMrp] = useState('');
  const [editItemHsn, setEditItemHsn] = useState('');
  const [editItemGst, setEditItemGst] = useState('18');
  const [editItemCess, setEditItemCess] = useState('0');
  const [editItemTaxIncl, setEditItemTaxIncl] = useState(true);
  const [editItemOrigin, setEditItemOrigin] = useState('IN');
  const [catPage, setCatPage] = useState(0);
  const [imageItemId, setImageItemId] = useState<string | null>(null);
  const [imageCategoryId, setImageCategoryId] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const imageItem = items.find((i) => i.id === imageItemId) ?? null;
  const imageCategory = categories.find((c) => c.id === imageCategoryId) ?? null;
  const catNameNormalized = catName.trim().replace(/\s+/g, ' ');
  const catNameTaken = categories.some(
    (c) => c.name.trim().toLowerCase() === catNameNormalized.toLowerCase(),
  );
  const editNameNormalized = editName.trim().replace(/\s+/g, ' ');
  const editNameTaken = Boolean(
    editing &&
      editNameNormalized &&
      categories.some(
        (c) =>
          c.id !== editing.id &&
          c.name.trim().toLowerCase() === editNameNormalized.toLowerCase(),
      ),
  );
  const filteredCategories = useMemo(() => {
    const needle = catQuery.trim().toLowerCase();
    const list = needle
      ? categories.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            (c.description ?? '').toLowerCase().includes(needle),
        )
      : categories;
    return [...list].sort((a, b) => {
      const av = catSort === 'description' ? (a.description ?? '') : a.name;
      const bv = catSort === 'description' ? (b.description ?? '') : b.name;
      const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
      return catDir === 'desc' ? -cmp : cmp;
    });
  }, [categories, catQuery, catSort, catDir]);
  const catTotalPages = Math.max(1, Math.ceil(filteredCategories.length / CAT_PAGE_SIZE));
  const safeCatPage = Math.min(catPage, catTotalPages - 1);
  const pagedCategories = filteredCategories.slice(
    safeCatPage * CAT_PAGE_SIZE,
    (safeCatPage + 1) * CAT_PAGE_SIZE,
  );
  const bulkVisibility = useMemo(() => {
    if (categories.length === 0) {
      return { canPauseAll: false, canResumeAll: false };
    }
    const allCleanLive = categories.every(
      (c) =>
        c.status !== 'INACTIVE' &&
        !(c.hiddenTownCount ?? 0) &&
        !(c.liveTownCount ?? 0),
    );
    const allCleanPaused = categories.every(
      (c) => c.status === 'INACTIVE' && !(c.liveTownCount ?? 0),
    );
    return { canPauseAll: !allCleanPaused, canResumeAll: !allCleanLive };
  }, [categories]);
  const categoryOptions = useMemo(
    () =>
      [...categories]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((c) => ({
          value: c.id,
          label: c.name,
          searchText: `${c.name} ${c.description ?? ''}`,
        })),
    [categories],
  );
  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id,
        label: u.displayName || u.label || u.code,
        searchText: `${u.displayName ?? ''} ${u.label ?? ''} ${u.code}`,
      })),
    [units],
  );

  useEffect(() => {
    if (catPage > catTotalPages - 1) setCatPage(Math.max(0, catTotalPages - 1));
  }, [catPage, catTotalPages]);

  useEffect(() => {
    setCatPage(0);
  }, [catQuery]);

  const loadLookups = useCallback(async () => {
    if (!token) return;
    const errors: string[] = [];
    try {
      const cats = await listCategories(token);
      setCategories(cats);
      setItemCategoryId((prev) => prev || cats[0]?.id || '');
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Categories failed');
    }
    try {
      const uns = await listUnits(token);
      setUnits(uns);
      setItemUnitId((prev) => prev || uns[0]?.id || '');
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Units failed');
    }
    if (errors.length) setError(errors.join(' · '));
  }, [token]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMasterItemsPage(token, {
        page,
        size: PAGE_SIZE,
        q,
        categoryId: filterCategoryId || undefined,
        unitId: filterUnitId || undefined,
        gstPercent: filterGstPercent ? Number(filterGstPercent) : undefined,
        sort: itemSort,
        dir: itemDir,
      });
      setItems((prev) => mergeItemTaxFromPrior(prev, data.items ?? []));
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (err) {
      setItems([]);
      setTotalPages(0);
      setTotalElements(0);
      setError(err instanceof Error ? err.message : 'Failed to load master items');
    } finally {
      setLoading(false);
    }
  }, [token, page, q, filterCategoryId, filterUnitId, filterGstPercent, itemSort, itemDir]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = qDraft.trim();
      setQ((prev) => {
        if (prev !== next) setPage(0);
        return next;
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [qDraft]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(0);
    setQ(qDraft.trim());
  }

  function toggleItemSort(column: ItemSortKey) {
    if (itemSort === column) {
      setItemDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setItemSort(column);
      setItemDir('asc');
    }
    setPage(0);
  }

  function toggleCatSort(column: CatSortKey) {
    if (catSort === column) {
      setCatDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCatSort(column);
      setCatDir('asc');
    }
    setCatPage(0);
  }

  async function onCreateItem(e: FormEvent) {
    e.preventDefault();
    if (!isValidHsn(itemHsn)) {
      setError('Enter a valid HSN code (4–8 digits) before creating this product.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setItemCreateToast(null);
    const createdName = itemName.trim();
    try {
      await createMasterItem(token, {
        name: createdName,
        searchNames: itemSearchNames.trim(),
        categoryId: itemCategoryId,
        unitId: itemUnitId,
        mrp: itemMrp ? Number(itemMrp) : undefined,
        hsnCode: itemHsn.trim(),
        gstPercent: Number(itemGst),
        cessPercent: itemCess ? Number(itemCess) : 0,
        priceIncludesTax: itemTaxIncl,
        countryOfOrigin: itemOrigin.trim() || 'IN',
      });
      setHistoryRefresh((n) => n + 1);
      setItemCreateToast(`${createdName} created in master table`);
      setItemName('');
      setItemSearchNames('');
      setItemMrp('');
      setItemHsn('');
      setItemGst('18');
      setItemCess('0');
      setPage(0);
      setLoading(true);
      try {
        const data = await listMasterItemsPage(token, {
          page: 0,
          size: PAGE_SIZE,
          q,
          categoryId: filterCategoryId || undefined,
          unitId: filterUnitId || undefined,
          gstPercent: filterGstPercent ? Number(filterGstPercent) : undefined,
          sort: itemSort,
          dir: itemDir,
        });
        setItems(data.items);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create item failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateCategory(e: FormEvent) {
    e.preventDefault();
    const name = catName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const duplicate = categories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setError(`Category “${name}” already exists`);
      setNotice(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createCategory(token, {
        name,
        description: catDesc.trim() || undefined,
      });
      setHistoryRefresh((n) => n + 1);
      setNotice(`Category “${created.name}” created`);
      setCatName('');
      setCatDesc('');
      setCatPage(0);
      await loadLookups();
      setItemCategoryId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create category failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete || !token) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteCategory(token, pendingDelete.id);
      setHistoryRefresh((n) => n + 1);
      setNotice(`Category “${pendingDelete.name}” deleted`);
      if (imageCategoryId === pendingDelete.id) setImageCategoryId(null);
      setFilterCategoryId((prev) => (prev === pendingDelete.id ? '' : prev));
      setItemCategoryId((prev) => (prev === pendingDelete.id ? '' : prev));
      setPendingDelete(null);
      setDeleteAlert(null);
      await loadLookups();
    } catch (err) {
      setDeleteAlert(err instanceof Error ? err.message : 'Delete category failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmDeleteItem() {
    if (!pendingItemDelete || !token) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteMasterItem(token, pendingItemDelete.id);
      setHistoryRefresh((n) => n + 1);
      setNotice(`Item “${pendingItemDelete.name}” deleted`);
      if (imageItemId === pendingItemDelete.id) setImageItemId(null);
      setPendingItemDelete(null);
      setItemDeleteAlert(null);
      await loadItems();
    } catch (err) {
      setItemDeleteAlert(err instanceof Error ? err.message : 'Delete item failed');
    } finally {
      setBusy(false);
    }
  }

  function visibilityLabel(cat: CategoryVm) {
    const paused = cat.status === 'INACTIVE';
    const hidden = cat.hiddenTownCount ?? 0;
    const live = cat.liveTownCount ?? 0;
    if (paused && live === 0) return 'Paused';
    if (paused) return `Live in ${live} town${live === 1 ? '' : 's'}`;
    if (hidden === 0) return 'Live';
    return `Hidden in ${hidden}`;
  }

  function upsertCategory(next: CategoryVm) {
    setCategories((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }

  async function onConfirmPause() {
    if (!pendingPause || !token) return;
    const pause = pendingPause.status !== 'INACTIVE';
    setBusy(true);
    setError(null);
    try {
      const next = await setCategoryPaused(token, pendingPause.id, pause);
      upsertCategory(next);
      setNotice(
        pause
          ? `“${pendingPause.name}” paused in all towns`
          : `“${pendingPause.name}” live in all towns`,
      );
      setPendingPause(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmPauseAll() {
    if (pendingPauseAll === null || !token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setAllCategoriesPaused(token, pendingPauseAll);
      await loadLookups();
      setNotice(
        pendingPauseAll
          ? `Paused ${result.updatedCount} categories in all towns`
          : `Resumed ${result.updatedCount} categories in all towns`,
      );
      setPendingPauseAll(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update all categories');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(cat: CategoryVm) {
    setEditing(cat);
    setEditName(cat.name);
    setEditDesc(cat.description ?? '');
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !token) return;
    const name = editNameNormalized;
    if (!name || editNameTaken) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateCategory(token, editing.id, {
        name,
        description: editDesc.trim() || undefined,
      });
      setHistoryRefresh((n) => n + 1);
      setNotice(`Category “${updated.name}” updated`);
      setEditing(null);
      await loadLookups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update category failed');
    } finally {
      setBusy(false);
    }
  }

  function applyEditFormFromItem(item: MasterItemVm) {
    setEditItemName(item.name);
    setEditItemSearchNames(item.searchNames ?? '');
    setEditItemCategoryId(item.categoryId ?? itemCategoryId);
    setEditItemUnitId(item.unitId ?? itemUnitId);
    setEditItemMrp(item.mrp != null ? String(item.mrp) : '');
    setEditItemHsn(item.hsnCode?.trim() ?? '');
    setEditItemGst(formatGstSlab(item.gstPercent));
    setEditItemCess(item.cessPercent != null ? String(item.cessPercent) : '0');
    setEditItemTaxIncl(item.priceIncludesTax !== false);
    setEditItemOrigin(item.countryOfOrigin?.trim() || 'IN');
  }

  function openEditItem(item: MasterItemVm) {
    setEditingItem(item);
    applyEditFormFromItem(item);
    setError(null);
    if (!token) return;
    void fetchMasterItem(token, item.id)
      .then((fresh) => applyEditFormFromItem(fresh))
      .catch(() => {
        /* keep list row data if detail fetch fails */
      });
  }

  async function onSaveEditItem(e: FormEvent) {
    e.preventDefault();
    if (!editingItem || !token) return;
    const name = editItemName.trim();
    if (!name || !editItemCategoryId || !editItemUnitId) return;
    if (!isValidHsn(editItemHsn)) {
      setError('Enter a valid HSN code (4–8 digits). Save is blocked until HSN is set for GST invoices.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateMasterItem(token, editingItem.id, {
        name,
        searchNames: editItemSearchNames.trim(),
        categoryId: editItemCategoryId,
        unitId: editItemUnitId,
        mrp: editItemMrp ? Number(editItemMrp) : undefined,
        hsnCode: editItemHsn.trim(),
        gstPercent: Number(editItemGst),
        cessPercent: editItemCess ? Number(editItemCess) : 0,
        priceIncludesTax: editItemTaxIncl,
        countryOfOrigin: editItemOrigin.trim() || 'IN',
      });
      const rowForList: MasterItemVm = {
        ...updated,
        hsnCode: updated.hsnCode ?? editItemHsn.trim(),
        gstPercent: updated.gstPercent ?? Number(editItemGst),
        cessPercent: updated.cessPercent ?? (editItemCess ? Number(editItemCess) : 0),
        priceIncludesTax: updated.priceIncludesTax ?? editItemTaxIncl,
        countryOfOrigin: updated.countryOfOrigin ?? (editItemOrigin.trim() || 'IN'),
      };
      setEditingItem(null);
      setItems((prev) =>
        patchMasterItemRow(prev, rowForList, categories, units, filterCategoryId, filterGstPercent),
      );
      setHistoryRefresh((n) => n + 1);
      setNotice(`Item “${updated.name}” updated`);
      void loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update item failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPickImages(files: FileList | null) {
    if (!token || !imageItem || !files?.length) return;
    setImageBusy(true);
    setError(null);
    setNotice(null);
    try {
      const existing: UploadedMedia[] = (imageItem.imageUrls ?? []).map((url) => {
        const mediaId = url.split('/').filter(Boolean).at(-2) ?? '';
        return { mediaId, url };
      }).filter((m) => m.mediaId);
      const room = Math.max(0, 3 - existing.length);
      const incoming = Array.from(files).slice(0, room);
      if (incoming.length === 0) {
        setError('Already have 3 images. Clear them first to replace.');
        return;
      }
      const uploaded: UploadedMedia[] = [];
      for (const file of incoming) {
        uploaded.push(await uploadCatalogImage(token, file));
      }
      const next = [...existing, ...uploaded].slice(0, 3);
      const urls = await setMasterItemImages(
        token,
        imageItem.id,
        next.map((m) => ({ mediaId: m.mediaId, url: m.url })),
      );
      setItems((prev) =>
        prev.map((item) => (item.id === imageItem.id ? { ...item, imageUrls: urls } : item)),
      );
      setNotice(`Saved ${urls.length} image${urls.length === 1 ? '' : 's'} for ${imageItem.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setImageBusy(false);
    }
  }

  async function onClearImages() {
    if (!token || !imageItem) return;
    setImageBusy(true);
    setError(null);
    try {
      await setMasterItemImages(token, imageItem.id, []);
      setItems((prev) =>
        prev.map((item) => (item.id === imageItem.id ? { ...item, imageUrls: [] } : item)),
      );
      setNotice('Images cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear images');
    } finally {
      setImageBusy(false);
    }
  }

  async function onPickCategoryImage(files: FileList | null) {
    if (!token || !imageCategory || !files?.[0]) return;
    setImageBusy(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await uploadCatalogImage(token, files[0]);
      const updated = await setCategoryImage(token, imageCategory.id, {
        mediaId: uploaded.mediaId,
        url: uploaded.url,
      });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setNotice(`Cover saved for ${updated.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setImageBusy(false);
    }
  }

  async function onClearCategoryImage() {
    if (!token || !imageCategory) return;
    setImageBusy(true);
    setError(null);
    try {
      const updated = await setCategoryImage(token, imageCategory.id, null);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setNotice('Cover image cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cover');
    } finally {
      setImageBusy(false);
    }
  }

  useEffect(() => {
    if (!imageItemId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageItemId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageItemId]);

  useEffect(() => {
    if (!imageCategoryId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageCategoryId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageCategoryId]);

  return (
    <PortalShell
      title="Master catalog"
      subtitle="Platform products vendors can list in their shops"
      onRefresh={() => {
        void loadLookups();
        void loadItems();
      }}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.tabs} role="tablist" aria-label="Catalog sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'items'}
          style={tab === 'items' ? styles.tabActive : styles.tab}
          onClick={() => setTab('items')}
        >
          Items
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'categories'}
          style={tab === 'categories' ? styles.tabActive : styles.tab}
          onClick={() => setTab('categories')}
        >
          Categories
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          style={tab === 'history' ? styles.tabActive : styles.tab}
          onClick={() => setTab('history')}
        >
          Change history
        </button>
      </div>

      {tab === 'history' && token ? (
        <div style={styles.historyPane}>
          <AdminHistoryPanel
            token={token}
            screen="catalog"
            refreshTick={historyRefresh}
            fullPage
            searchPlaceholder="Search changes (GST, HSN, name, category)…"
            emptyHint="Each save lists every field that changed (previous → new). GST %, HSN, MRP, category, and unit appear here."
          />
        </div>
      ) : null}

      {tab === 'items' ? (
        <div style={styles.itemsPage}>
          <section style={styles.sectionCard} aria-labelledby="catalog-add-item-heading">
            <div style={styles.addStripHead}>
              <h2 id="catalog-add-item-heading" style={styles.addTitle}>Add item</h2>
              <span style={styles.addHintInline}>
                HSN required (4–8 digits) · GST-inclusive MRP usual
              </span>
            </div>
            <form style={styles.addForm} onSubmit={(e) => void onCreateItem(e)}>
              <div style={styles.addRowPrimary}>
                <TextField
                  label="Name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Tomato"
                />
                <TextField
                  label="Other names"
                  value={itemSearchNames}
                  onChange={(e) => setItemSearchNames(e.target.value)}
                  placeholder="tamatar, tomato local"
                />
                <SearchSelect
                  compact
                  label="Category"
                  noun="categories"
                  value={itemCategoryId}
                  options={categoryOptions}
                  onChange={setItemCategoryId}
                  placeholder="Category"
                />
                <SearchSelect
                  compact
                  label="Unit"
                  noun="units"
                  value={itemUnitId}
                  options={unitOptions}
                  onChange={setItemUnitId}
                  placeholder="Unit"
                />
                <TextField
                  label="MRP"
                  value={itemMrp}
                  onChange={(e) => setItemMrp(e.target.value)}
                  inputMode="decimal"
                  placeholder="Opt."
                />
                <TextField
                  label="HSN"
                  value={itemHsn}
                  onChange={(e) => setItemHsn(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  placeholder="4–8 digits"
                />
              </div>
              <div style={styles.addRowSecondary}>
                <label style={styles.fieldMini}>
                  GST %
                  <select
                    style={styles.miniSelectCompact}
                    value={itemGst}
                    onChange={(e) => setItemGst(e.target.value)}
                  >
                    {GST_SLAB_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}%
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Cess %"
                  value={itemCess}
                  onChange={(e) => setItemCess(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <TextField
                  label="Origin"
                  value={itemOrigin}
                  onChange={(e) => setItemOrigin(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="IN"
                />
                <label style={styles.checkMini}>
                  <input
                    type="checkbox"
                    checked={itemTaxIncl}
                    onChange={(e) => setItemTaxIncl(e.target.checked)}
                  />
                  Incl. GST
                </label>
                <div style={styles.addCreateWrap}>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy || !itemName.trim() || !itemCategoryId || !itemUnitId}
                  >
                    Create
                  </Button>
                </div>
              </div>
              {!itemHsn.trim() || isValidHsn(itemHsn) ? null : (
                <p style={styles.fieldError}>HSN must be 4–8 digits.</p>
              )}
            </form>
          </section>

          <section style={styles.listSection} aria-labelledby="catalog-master-items-heading">
          <div style={styles.toolbar}>
            <div style={styles.toolbarTop}>
              <h2 id="catalog-master-items-heading" style={styles.h2}>
                Master items
                <span style={styles.countInline}>
                  {loading ? 'Loading…' : `${totalElements}`}
                </span>
              </h2>
                <label style={styles.sortInline}>
                  Sort
                  <select
                    style={styles.sortSelect}
                    value={`${itemSort}-${itemDir}`}
                    aria-label="Sort items"
                    onChange={(e) => {
                      const [col, dir] = e.target.value.split('-') as [ItemSortKey, SortDir];
                      setItemSort(col);
                      setItemDir(dir);
                      setPage(0);
                    }}
                  >
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                    <option value="category-asc">Category A–Z</option>
                    <option value="category-desc">Category Z–A</option>
                    <option value="unit-asc">Unit A–Z</option>
                    <option value="unit-desc">Unit Z–A</option>
                    <option value="mrp-asc">MRP low–high</option>
                    <option value="mrp-desc">MRP high–low</option>
                  </select>
                </label>
              </div>
              <form style={styles.filterBar} onSubmit={onSearch}>
                <label style={styles.searchLead}>
                  <span style={styles.searchGlyph} aria-hidden>
                    ⌕
                  </span>
                  <input
                    style={styles.searchInput}
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    placeholder="Search name or other names"
                    aria-label="Search master items"
                  />
                </label>
                <SearchSelect
                  compact
                  noun="categories"
                  value={filterCategoryId}
                  options={[{ value: '', label: 'All categories' }, ...categoryOptions]}
                  onChange={(id) => {
                    setFilterCategoryId(id);
                    setPage(0);
                  }}
                  placeholder="Category"
                />
                <SearchSelect
                  compact
                  noun="units"
                  value={filterUnitId}
                  options={[{ value: '', label: 'All units' }, ...unitOptions]}
                  onChange={(id) => {
                    setFilterUnitId(id);
                    setPage(0);
                  }}
                  placeholder="Unit"
                />
                <label style={styles.gstFilter}>
                  <span style={styles.gstFilterLabel}>GST</span>
                  <select
                    style={styles.gstFilterSelect}
                    value={filterGstPercent}
                    aria-label="Filter by GST percent"
                    onChange={(e) => {
                      setFilterGstPercent(e.target.value);
                      setPage(0);
                    }}
                  >
                    {GST_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </form>
            </div>

            <div style={styles.tableWrapFill}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <SortTh
                      label="Item"
                      column="name"
                      active={itemSort}
                      dir={itemDir}
                      onSort={toggleItemSort}
                    />
                    <SortTh
                      label="Category"
                      column="category"
                      active={itemSort}
                      dir={itemDir}
                      onSort={toggleItemSort}
                    />
                    <SortTh
                      label="Unit"
                      column="unit"
                      active={itemSort}
                      dir={itemDir}
                      onSort={toggleItemSort}
                    />
                    <SortTh
                      label="MRP"
                      column="mrp"
                      active={itemSort}
                      dir={itemDir}
                      onSort={toggleItemSort}
                      align="right"
                    />
                    <th style={styles.thRight}>HSN</th>
                    <th style={styles.thRight}>GST</th>
                    <th style={styles.thRight}> </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} style={styles.empty}>
                        No master items match.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.itemCell}>
                            <button
                              type="button"
                              style={styles.thumbBtn}
                              title="Manage images"
                              aria-label={`Manage images for ${item.name}`}
                              onClick={() => setImageItemId(item.id)}
                            >
                              <Thumb urls={item.imageUrls} />
                            </button>
                            <span style={styles.itemText}>
                              <strong>{item.name}</strong>
                              {item.searchNames ? (
                                <span style={styles.aliasLine} title={item.searchNames}>
                                  {item.searchNames}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td style={styles.tdMuted}>{item.categoryName ?? '—'}</td>
                        <td style={styles.tdMuted}>{item.unitName ?? '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.mrp != null ? `₹${Number(item.mrp).toFixed(0)}` : '—'}
                        </td>
                        <td style={{ ...styles.tdMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.hsnCode?.trim() ? item.hsnCode : '—'}
                        </td>
                        <td style={{ ...styles.tdMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.gstPercent != null ? `${item.gstPercent}%` : '—'}
                        </td>
                        <td style={styles.tdRight}>
                          <div style={styles.rowActions}>
                            <button
                              type="button"
                              style={styles.editLink}
                              disabled={busy}
                              onClick={() => openEditItem(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={styles.deleteLink}
                              disabled={busy}
                              onClick={() => {
                                setItemDeleteAlert(null);
                                setPendingItemDelete(item);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pager
              page={page}
              totalPages={totalPages}
              total={totalElements}
              loading={loading}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </section>
        </div>
      ) : tab === 'categories' ? (
        <div style={styles.itemsPage}>
          <section style={styles.sectionCard} aria-labelledby="catalog-add-category-heading">
            <div style={styles.addStripHead}>
              <h2 id="catalog-add-category-heading" style={styles.addTitle}>Add category</h2>
              <span style={styles.addHintInline}>Groups items (Vegetables, Dairy…)</span>
            </div>
            <form style={styles.catFormInline} onSubmit={(e) => void onCreateCategory(e)}>
              <TextField
                label="Name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Dairy"
              />
              <TextField
                label="Description"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Optional"
              />
              <div style={styles.addCreateWrap}>
                <Button type="submit" size="sm" disabled={busy || !catNameNormalized || catNameTaken}>
                  Create
                </Button>
              </div>
              {catNameTaken ? (
                <span style={styles.dupHint}>“{catNameNormalized}” exists</span>
              ) : null}
            </form>
          </section>

          <section style={styles.listSection} aria-labelledby="catalog-categories-heading">
          <div style={styles.toolbar}>
            <div style={styles.toolbarTop}>
              <h2 id="catalog-categories-heading" style={styles.h2}>
                Categories
                <span style={styles.countInline}>{filteredCategories.length}</span>
              </h2>
              <label style={styles.sortInline}>
                Sort
                <select
                  style={styles.sortSelect}
                  value={`${catSort}-${catDir}`}
                  aria-label="Sort categories"
                  onChange={(e) => {
                    const [col, dir] = e.target.value.split('-') as [CatSortKey, SortDir];
                    setCatSort(col);
                    setCatDir(dir);
                    setCatPage(0);
                  }}
                >
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="description-asc">Description A–Z</option>
                  <option value="description-desc">Description Z–A</option>
                </select>
              </label>
              <div style={styles.bulkActions}>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || !bulkVisibility.canPauseAll}
                  onClick={() => setPendingPauseAll(true)}
                >
                  Pause all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !bulkVisibility.canResumeAll}
                  onClick={() => setPendingPauseAll(false)}
                >
                  Resume all
                </Button>
              </div>
            </div>
            <label style={styles.searchLead}>
              <span style={styles.searchGlyph} aria-hidden>
                ⌕
              </span>
              <input
                style={styles.searchInput}
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="Search categories"
                aria-label="Search categories"
              />
            </label>
          </div>
          <div style={styles.tableWrapFill}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cover</th>
                  <SortTh
                    label="Name"
                    column="name"
                    active={catSort}
                    dir={catDir}
                    onSort={toggleCatSort}
                  />
                  <SortTh
                    label="Description"
                    column="description"
                    active={catSort}
                    dir={catDir}
                    onSort={toggleCatSort}
                  />
                  <th style={styles.th}>Status</th>
                  <th style={styles.thRight}> </th>
                </tr>
              </thead>
              <tbody>
                {pagedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.empty}>
                      {catQuery.trim() ? 'No categories match.' : 'No categories yet.'}
                    </td>
                  </tr>
                ) : (
                  pagedCategories.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.thumbBtn}
                          title="Category cover for buyer home"
                          aria-label={`Cover image for ${c.name}`}
                          onClick={() => setImageCategoryId(c.id)}
                        >
                          <Thumb urls={c.imageUrl ? [c.imageUrl] : []} />
                        </button>
                      </td>
                      <td style={styles.td}>
                        <strong>{c.name}</strong>
                      </td>
                      <td style={styles.tdMuted}>{c.description || '—'}</td>
                      <td style={styles.tdMuted}>{visibilityLabel(c)}</td>
                      <td style={styles.tdRight}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.editLink}
                            disabled={busy}
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={styles.pauseLink}
                            disabled={busy}
                            onClick={() => setPendingPause(c)}
                          >
                            {c.status === 'INACTIVE' ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            type="button"
                            style={styles.editLink}
                            disabled={busy}
                            onClick={() => setTownsCategory(c)}
                          >
                            Towns
                          </button>
                          <button
                            type="button"
                            style={styles.deleteLink}
                            disabled={busy}
                            onClick={() => {
                              setDeleteAlert(null);
                              setPendingDelete(c);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager
            page={safeCatPage}
            totalPages={filteredCategories.length === 0 ? 0 : catTotalPages}
            total={filteredCategories.length}
            noun="categories"
            onPrev={() => setCatPage((p) => Math.max(0, p - 1))}
            onNext={() => setCatPage((p) => p + 1)}
          />
          </section>
        </div>
      ) : null}

      {imageItem ? (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onClick={() => setImageItemId(null)}
        >
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-images-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHead}>
              <div>
                <h3 id="master-images-title" style={styles.h3}>
                  Images · {imageItem.name}
                </h3>
                <p style={styles.meta}>
                  Up to 3 photos. Vendors inherit these when they add this item.
                </p>
              </div>
              <button
                type="button"
                style={styles.modalClose}
                aria-label="Close"
                onClick={() => setImageItemId(null)}
              >
                ✕
              </button>
            </div>

            <div style={styles.thumbsRow}>
              {(imageItem.imageUrls ?? []).map((url) => (
                <img key={url} src={url} alt="" style={styles.thumbLarge} />
              ))}
              {(imageItem.imageUrls?.length ?? 0) < 3 ? (
                <label style={styles.uploadTile}>
                  {imageBusy ? '…' : '+ Add'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    hidden
                    disabled={imageBusy}
                    onChange={(e) => {
                      void onPickImages(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div style={styles.imageActions}>
              <Button
                type="button"
                variant="ghost"
                disabled={imageBusy || (imageItem.imageUrls?.length ?? 0) === 0}
                onClick={() => void onClearImages()}
              >
                Clear images
              </Button>
              <Button type="button" variant="secondary" onClick={() => setImageItemId(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {imageCategory ? (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onClick={() => setImageCategoryId(null)}
        >
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-cover-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHead}>
              <div>
                <h3 id="category-cover-title" style={styles.h3}>
                  Cover · {imageCategory.name}
                </h3>
                <p style={styles.meta}>One photo for the buyer category tile.</p>
              </div>
              <button
                type="button"
                style={styles.modalClose}
                aria-label="Close"
                onClick={() => setImageCategoryId(null)}
              >
                ✕
              </button>
            </div>
            <div style={styles.thumbsRow}>
              {imageCategory.imageUrl ? (
                <img src={imageCategory.imageUrl} alt="" style={styles.thumbLarge} />
              ) : null}
              <label style={styles.uploadTile}>
                {imageBusy ? '…' : imageCategory.imageUrl ? 'Replace' : '+ Add'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  disabled={imageBusy}
                  onChange={(e) => {
                    void onPickCategoryImage(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div style={styles.imageActions}>
              <Button
                type="button"
                variant="ghost"
                disabled={imageBusy || !imageCategory.imageUrl}
                onClick={() => void onClearCategoryImage()}
              >
                Clear
              </Button>
              <Button type="button" variant="secondary" onClick={() => setImageCategoryId(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setEditingItem(null);
          }}
        >
          <form
            style={styles.editDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-item-title"
            onSubmit={(e) => void onSaveEditItem(e)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="edit-item-title" style={styles.editTitle}>
              Edit item
            </h2>
            <div style={styles.editRow}>
              <TextField
                label="Name"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
              />
              <TextField
                label="Other names"
                value={editItemSearchNames}
                onChange={(e) => setEditItemSearchNames(e.target.value)}
                placeholder="tamatar, tomato local"
                disabled={busy}
              />
              <SearchSelect
                compact
                label="Category"
                noun="categories"
                value={editItemCategoryId}
                options={categoryOptions}
                onChange={setEditItemCategoryId}
                placeholder="Search category"
                disabled={busy}
              />
              <SearchSelect
                compact
                label="Unit"
                noun="units"
                value={editItemUnitId}
                options={unitOptions}
                onChange={setEditItemUnitId}
                placeholder="Search unit"
                disabled={busy}
              />
              <TextField
                label="MRP"
                value={editItemMrp}
                onChange={(e) => setEditItemMrp(e.target.value)}
                inputMode="decimal"
                placeholder="Optional"
              />
              <TextField
                label="HSN code"
                value={editItemHsn}
                onChange={(e) => setEditItemHsn(e.target.value.replace(/\D/g, '').slice(0, 8))}
                inputMode="numeric"
                placeholder="4–8 digits"
              />
              {!isValidHsn(editItemHsn) ? (
                <p style={styles.fieldError}>
                  HSN is required (4–8 digits) for GST invoices — e.g. 18069010 for chocolate.
                </p>
              ) : null}
              <label style={styles.fieldMini}>
                GST %
                <select
                  style={styles.miniSelect}
                  value={editItemGst}
                  disabled={busy}
                  onChange={(e) => setEditItemGst(e.target.value)}
                >
                  {GST_SLAB_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}%
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Cess %"
                value={editItemCess}
                onChange={(e) => setEditItemCess(e.target.value)}
                inputMode="decimal"
                disabled={busy}
              />
              <TextField
                label="Country of origin"
                value={editItemOrigin}
                onChange={(e) => setEditItemOrigin(e.target.value.toUpperCase().slice(0, 2))}
                disabled={busy}
              />
              <label style={styles.checkMini}>
                <input
                  type="checkbox"
                  checked={editItemTaxIncl}
                  disabled={busy}
                  onChange={(e) => setEditItemTaxIncl(e.target.checked)}
                />
                Price includes GST
              </label>
            </div>
            <div style={styles.editActions}>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || !editItemName.trim() || !editItemCategoryId || !editItemUnitId}
              >
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
        >
          <form
            style={styles.editDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-category-title"
            onSubmit={(e) => void onSaveEdit(e)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="edit-category-title" style={styles.editTitle}>
              Edit category
            </h2>
            <div style={styles.editRow}>
              <TextField
                label="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <TextField
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {editNameTaken ? (
              <p style={styles.dupHint}>“{editNameNormalized}” already exists</p>
            ) : null}
            <div style={styles.editActions}>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !editNameNormalized || editNameTaken}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {townsCategory ? (
        <CategoryTownVisibilityDialog
          token={token}
          category={townsCategory}
          busy={busy}
          onClose={() => setTownsCategory(null)}
          onSaved={(next) => {
            upsertCategory(next);
            setNotice(`Town visibility updated for “${next.name}”`);
          }}
          onError={(message) => setError(message)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingPauseAll !== null}
        title={pendingPauseAll ? 'Pause all categories?' : 'Resume all categories?'}
        description={
          pendingPauseAll
            ? `All ${categories.length} categories will be hidden from buyers in every town, including towns launched later. Town exceptions are cleared. Listings stay in the catalog.`
            : `All ${categories.length} categories will show in every town, including towns launched later. Town exceptions are cleared.`
        }
        confirmLabel={pendingPauseAll ? 'Pause all' : 'Resume all'}
        cancelLabel="Cancel"
        danger={pendingPauseAll === true}
        busy={busy}
        onConfirm={() => void onConfirmPauseAll()}
        onClose={() => {
          if (!busy) setPendingPauseAll(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPause)}
        title={pendingPause?.status === 'INACTIVE' ? 'Resume everywhere?' : 'Pause everywhere?'}
        description={
          pendingPause?.status === 'INACTIVE'
            ? `“${pendingPause.name}” will show in all towns, including towns launched later.`
            : `“${pendingPause?.name}” will be hidden from buyers in all towns, including towns launched later. Listings stay in the catalog.`
        }
        confirmLabel={pendingPause?.status === 'INACTIVE' ? 'Resume' : 'Pause'}
        cancelLabel="Cancel"
        danger={pendingPause?.status !== 'INACTIVE'}
        busy={busy}
        onConfirm={() => void onConfirmPause()}
        onClose={() => {
          if (!busy) setPendingPause(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={deleteAlert ? 'Cannot delete' : 'Delete category?'}
        description={
          deleteAlert
            ? deleteAlert
            : pendingDelete
              ? `“${pendingDelete.name}” will be removed. Items already in this category must be moved first.`
              : ''
        }
        confirmLabel={deleteAlert ? 'OK' : 'Delete'}
        cancelLabel="Cancel"
        danger={!deleteAlert}
        alertOnly={Boolean(deleteAlert)}
        busy={busy}
        onConfirm={() => void onConfirmDelete()}
        onClose={() => {
          if (!busy) {
            setPendingDelete(null);
            setDeleteAlert(null);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingItemDelete)}
        title={itemDeleteAlert ? 'Cannot delete' : 'Delete item?'}
        description={
          itemDeleteAlert
            ? itemDeleteAlert
            : pendingItemDelete
              ? `“${pendingItemDelete.name}” will be removed from the master catalog.`
              : ''
        }
        confirmLabel={itemDeleteAlert ? 'OK' : 'Delete'}
        cancelLabel="Cancel"
        danger={!itemDeleteAlert}
        alertOnly={Boolean(itemDeleteAlert)}
        busy={busy}
        onConfirm={() => void onConfirmDeleteItem()}
        onClose={() => {
          if (!busy) {
            setPendingItemDelete(null);
            setItemDeleteAlert(null);
          }
        }}
      />
      <Toast
        open={Boolean(itemCreateToast)}
        message={itemCreateToast ?? ''}
        onClose={() => setItemCreateToast(null)}
      />
    </PortalShell>
  );
}

function SortTh<T extends string>({
  label,
  column,
  active,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  column: T;
  active: T;
  dir: SortDir;
  onSort: (column: T) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === column;
  return (
    <th style={{ ...styles.th, textAlign: align }}>
      <button
        type="button"
        style={{
          ...styles.sortThBtn,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          color: isActive ? 'var(--text)' : 'var(--text-muted)',
        }}
        onClick={() => onSort(column)}
      >
        {label}
        <span aria-hidden>{isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    </th>
  );
}

function Thumb({ urls }: { urls?: string[] }) {
  const url = urls?.[0];
  if (!url) {
    return <span style={styles.thumbEmpty}>📦</span>;
  }
  return <img src={url} alt="" style={styles.thumb} />;
}

function Pager({
  page,
  totalPages,
  total,
  loading,
  noun = 'items',
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  loading?: boolean;
  noun?: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1 && page === 0) return null;
  const canNext = page + 1 < totalPages;
  return (
    <div style={styles.pager}>
      <button
        type="button"
        style={page <= 0 || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={page <= 0 || loading}
        onClick={onPrev}
      >
        ‹ Prev
      </button>
      <span style={styles.pagerMeta}>
        Page {page + 1}
        {totalPages > 0 ? ` / ${totalPages}` : ''}
        {` · ${total} ${noun}`}
      </span>
      <button
        type="button"
        style={!canNext || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={!canNext || loading}
        onClick={onNext}
      >
        Next ›
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  historyPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 'calc(100vh - 11rem)',
  },
  itemsPage: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
    flex: 1,
    minHeight: 'calc(100vh - 11rem)',
  },
  sectionCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.65rem 0.85rem',
    display: 'grid',
    gap: '0.4rem',
    boxShadow: 'var(--shadow-soft)',
    flexShrink: 0,
  },
  listSection: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.55rem 0.75rem 0.65rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    flex: 1,
    minHeight: 0,
    boxShadow: 'var(--shadow-soft)',
  },
  addStripHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.35rem 0.65rem',
  },
  addTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
  },
  addHintInline: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  addForm: {
    display: 'grid',
    gap: '0.35rem',
    width: '100%',
  },
  addRowPrimary: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns:
      'minmax(0, 2.4fr) minmax(0, 1.45fr) minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
    gap: '0.4rem',
    alignItems: 'end',
  },
  addRowSecondary: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.75fr) auto minmax(0, 1.35fr)',
    gap: '0.4rem',
    alignItems: 'end',
  },
  catFormInline: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr) minmax(120px, auto)',
    gap: '0.4rem',
    alignItems: 'end',
  },
  addCreateWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 42,
  },
  tabs: {
    display: 'inline-flex',
    gap: '0.25rem',
    padding: '0.2rem',
    background: 'var(--bg-muted)',
    borderRadius: 999,
    width: 'fit-content',
  },
  tab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.45rem 0.95rem',
    borderRadius: 999,
    cursor: 'pointer',
  },
  tabActive: {
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.85rem',
    padding: '0.45rem 0.95rem',
    borderRadius: 999,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-soft)',
  },
  panel: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '1rem 1.05rem',
    display: 'grid',
    gap: '0.75rem',
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  h3: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
  },
  meta: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' },
  itemCell: { display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 },
  itemText: { display: 'grid', gap: '0.05rem', minWidth: 0 },
  aliasLine: {
    display: 'block',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    lineHeight: 1.2,
  },
  thumbBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    borderRadius: 8,
    lineHeight: 0,
    flexShrink: 0,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--bg-muted)',
    display: 'block',
  },
  thumbEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    flexShrink: 0,
    fontSize: '0.95rem',
  },
  thumbLarge: {
    width: 88,
    height: 88,
    borderRadius: 12,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 20, 0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    zIndex: 1000,
  },
  editDialog: {
    width: 'min(440px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1rem 1.1rem',
    display: 'grid',
    gap: '0.65rem',
  },
  editTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.12rem',
  },
  editRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  editActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' },
  modal: {
    width: 'min(440px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.1rem 1.15rem 1.15rem',
    display: 'grid',
    gap: '0.9rem',
  },
  modalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  modalClose: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    width: 32,
    height: 32,
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 700,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  thumbsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center' },
  uploadTile: {
    width: 88,
    height: 88,
    borderRadius: 12,
    border: '1px dashed var(--border)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    fontWeight: 800,
    color: 'var(--accent)',
    background: 'var(--bg)',
    fontSize: '0.82rem',
  },
  imageActions: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.65rem',
    alignItems: 'end',
  },
  catForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.65rem',
    alignItems: 'end',
  },
  formAction: { display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' },
  fieldError: { margin: 0, fontSize: '0.76rem', color: 'var(--danger)', fontWeight: 700, gridColumn: '1 / -1' },
  fieldHint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', gridColumn: '1 / -1' },
  taxHint: { margin: '0 0 0.45rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  fieldMini: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: 0,
    width: '100%',
  },
  miniSelect: {
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  miniSelectCompact: {
    width: '100%',
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    minHeight: 42,
    boxSizing: 'border-box',
  },
  checkMini: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    minHeight: 42,
  },
  dupHint: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)' },
  label: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  labelCompact: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  select: {
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  selectCompact: {
    padding: '0.45rem 0.6rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    minWidth: 120,
  },
  toolbar: {
    display: 'grid',
    gap: '0.45rem',
  },
  toolbarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  countInline: {
    marginLeft: '0.45rem',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  sortInline: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minHeight: 44,
  },
  bulkActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  sortSelect: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '0.3rem 0.45rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    minHeight: 32,
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'stretch',
  },
  gstFilter: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    minHeight: 36,
    padding: '0 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    flex: '0 1 auto',
  },
  gstFilterLabel: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  gstFilterSelect: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.82rem',
    fontWeight: 650,
    padding: '0.2rem 0',
    minWidth: '4.5rem',
    cursor: 'pointer',
  },
  searchLead: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minHeight: 36,
    padding: '0 0.55rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    flex: '2 1 200px',
    minWidth: 180,
  },
  searchGlyph: {
    color: 'var(--text-muted)',
    fontWeight: 700,
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text)',
    padding: '0.45rem 0',
    fontSize: '0.88rem',
  },
  searchRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'end',
    flex: '1 1 360px',
  },
  search: {
    minWidth: 140,
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.45rem 0.6rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  tableWrapFill: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 480,
  },
  th: {
    textAlign: 'left',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '0.45rem 0.75rem',
    background: 'var(--bg-muted)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
  },
  sortThBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.15rem',
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    minHeight: 44,
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'inherit',
  },
  thRight: {
    textAlign: 'right',
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.65rem 0.75rem',
    background: 'var(--bg-muted)',
    borderBottom: '1px solid var(--border)',
    width: 120,
  },
  td: {
    padding: '0.7rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.9rem',
    verticalAlign: 'middle',
  },
  tdMuted: {
    padding: '0.7rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: '0.35rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    verticalAlign: 'middle',
    width: 220,
  },
  rowActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.1rem',
    justifyContent: 'flex-end',
  },
  editLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: 44,
    padding: '0.35rem 0.45rem',
  },
  pauseLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: 44,
    padding: '0.35rem 0.45rem',
  },
  deleteLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 800,
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: 44,
    padding: '0.35rem 0.45rem',
  },
  empty: {
    padding: '1.25rem 0.75rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  pagerMeta: { fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 },
  pagerBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '0.4rem 0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pagerBtnDisabled: {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    borderRadius: 8,
    padding: '0.4rem 0.75rem',
    fontWeight: 700,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
