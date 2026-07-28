import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button, TextField } from '@/shared/ui';
import {
  createCategory,
  createMasterItem,
  listCategories,
  listMasterItemsPage,
  listUnits,
  setMasterItemImages,
  uploadCatalogImage,
  type CategoryVm,
  type MasterItemVm,
  type UnitVm,
  type UploadedMedia,
} from '../api/catalogApi';

const PAGE_SIZE = 25;

type Tab = 'items' | 'categories';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemMrp, setItemMrp] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUnitId, setItemUnitId] = useState('');

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [imageItemId, setImageItemId] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const imageItem = items.find((i) => i.id === imageItemId) ?? null;

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
      });
      setItems(data.items);
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
  }, [token, page, q, filterCategoryId]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(0);
    setQ(qDraft.trim());
  }

  async function onCreateItem(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createMasterItem(token, {
        name: itemName.trim(),
        categoryId: itemCategoryId,
        unitId: itemUnitId,
        mrp: itemMrp ? Number(itemMrp) : undefined,
      });
      setNotice('Master item created');
      setItemName('');
      setItemMrp('');
      setPage(0);
      setLoading(true);
      try {
        const data = await listMasterItemsPage(token, {
          page: 0,
          size: PAGE_SIZE,
          q,
          categoryId: filterCategoryId || undefined,
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
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createCategory(token, {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });
      setNotice(`Category “${created.name}” created`);
      setCatName('');
      setCatDesc('');
      await loadLookups();
      setItemCategoryId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create category failed');
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

  useEffect(() => {
    if (!imageItemId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageItemId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageItemId]);

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
      </div>

      {tab === 'items' ? (
        <>
          <section style={styles.panel}>
            <h2 style={styles.h2}>Add item</h2>
            <form style={styles.formRow} onSubmit={(e) => void onCreateItem(e)}>
              <TextField
                label="Name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Tomato"
              />
              <label style={styles.label}>
                Category
                <select
                  style={styles.select}
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                Unit
                <select
                  style={styles.select}
                  value={itemUnitId}
                  onChange={(e) => setItemUnitId(e.target.value)}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.label || u.code}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="MRP"
                value={itemMrp}
                onChange={(e) => setItemMrp(e.target.value)}
                inputMode="decimal"
                placeholder="Optional"
              />
              <div style={styles.formAction}>
                <Button
                  type="submit"
                  disabled={busy || !itemName.trim() || !itemCategoryId || !itemUnitId}
                >
                  Create
                </Button>
              </div>
            </form>
          </section>

          <section style={styles.panel}>
            <div style={styles.toolbar}>
              <div>
                <h2 style={styles.h2}>Master items</h2>
                <p style={styles.meta}>
                  {loading ? 'Loading…' : `${totalElements} total`}
                </p>
              </div>
              <form style={styles.searchRow} onSubmit={onSearch}>
                <label style={styles.labelCompact}>
                  Category
                  <select
                    style={styles.selectCompact}
                    value={filterCategoryId}
                    onChange={(e) => {
                      setFilterCategoryId(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  style={styles.search}
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Search by name"
                  aria-label="Search master items"
                />
                <Button type="submit" variant="ghost" disabled={loading}>
                  Search
                </Button>
              </form>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Unit</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={4} style={styles.empty}>
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
                            <strong>{item.name}</strong>
                          </div>
                        </td>
                        <td style={styles.tdMuted}>{item.categoryName ?? '—'}</td>
                        <td style={styles.tdMuted}>{item.unitName ?? '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.mrp != null ? `₹${Number(item.mrp).toFixed(0)}` : '—'}
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
        </>
      ) : (
        <section style={styles.panel}>
          <h2 style={styles.h2}>Add category</h2>
          <p style={styles.meta}>Categories group master items (Vegetables, Dairy, Snacks…).</p>
          <form style={styles.catForm} onSubmit={(e) => void onCreateCategory(e)}>
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
            <div style={styles.formAction}>
              <Button type="submit" disabled={busy || !catName.trim()}>
                Create category
              </Button>
            </div>
          </form>

          <h2 style={{ ...styles.h2, marginTop: '1.25rem' }}>
            Categories ({categories.length})
          </h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={styles.empty}>
                      No categories yet.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.td}>
                        <strong>{c.name}</strong>
                      </td>
                      <td style={styles.tdMuted}>{c.description || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
    </PortalShell>
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
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  loading?: boolean;
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
        {` · ${total} items`}
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
  formAction: { display: 'flex', alignItems: 'end' },
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
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-end',
  },
  searchRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'end',
  },
  search: {
    minWidth: 160,
    flex: '1 1 160px',
    padding: '0.55rem 0.75rem',
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
    padding: '0.65rem 0.75rem',
    background: 'var(--bg-muted)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
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
