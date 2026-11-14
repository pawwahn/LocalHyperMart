import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Toast } from '@/shared/ui';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';
import {
  createFoodCategory,
  createFoodItem,
  fetchFoodItemPhotos,
  fetchFoodMenu,
  saveFoodProfile,
  updateFoodItem,
  sanitizeDishPhotos,
  type FoodDishImageRef,
  type FoodMenuCategoryVm,
  type FoodMenuItemVm,
} from '../api/foodApi';
import { mediaFromPublicUrl, resolveMediaContentUrl } from '@/features/listings/api/listingsApi';
import { FoodHotelPhotosCard } from '../components/FoodHotelPhotosCard';
import { FoodDishSheet, type FoodDishForm } from '../components/FoodDishSheet';

const MAX_PHOTOS = 3;

const DESK_CSS = `
  .hlm-food-desk-rail {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow-y: auto;
    max-height: min(56vh, 480px);
    scrollbar-width: none;
    -ms-overflow-style: none;
    border-right: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-muted) 70%, var(--bg-elevated));
  }
  .hlm-food-desk-rail::-webkit-scrollbar { display: none; }
  .hlm-food-desk-panel {
    overflow-y: auto;
    max-height: min(56vh, 480px);
    scrollbar-width: none;
  }
  .hlm-food-desk-panel::-webkit-scrollbar { display: none; }
  .hlm-food-desk-split {
    display: grid;
    grid-template-columns: minmax(6.75rem, 34%) 1fr;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    background: var(--bg-elevated);
    box-shadow: var(--shadow-card);
  }
  @media (min-width: 720px) {
    .hlm-food-desk-split { grid-template-columns: minmax(10rem, 220px) 1fr; }
  }
`;

const INPUT: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.45rem 0.55rem',
  fontSize: '0.88rem',
  lineHeight: 1.25,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  minHeight: 'var(--touch-min, 44px)',
};

function photosFromImageUrls(urls: string[] | undefined): FoodDishForm['photos'] {
  return sanitizeDishPhotos(
    (urls ?? [])
      .map((url) => mediaFromPublicUrl(url))
      .filter((m): m is NonNullable<ReturnType<typeof mediaFromPublicUrl>> => Boolean(m?.mediaId && m.url)),
  );
}

function photosFromItem(item: FoodMenuItemVm): FoodDishForm['photos'] {
  const fromApi = sanitizeDishPhotos(item.photos);
  if (fromApi.length > 0) return fromApi;
  return photosFromImageUrls(item.imageUrls);
}

function mergeDishPhotos(
  local: FoodDishForm['photos'],
  server: FoodDishImageRef[],
): FoodDishForm['photos'] {
  const cleanedLocal = sanitizeDishPhotos(local);
  const cleanedServer = sanitizeDishPhotos(server);
  if (cleanedServer.length === 0) return cleanedLocal;
  const byId = new Map<string, FoodDishImageRef>();
  for (const p of cleanedServer) byId.set(p.mediaId, p);
  for (const p of cleanedLocal) {
    if (!byId.has(p.mediaId)) byId.set(p.mediaId, p);
  }
  return Array.from(byId.values()).slice(0, MAX_PHOTOS);
}

async function loadPhotosForEdit(
  token: string,
  vendorId: string,
  item: FoodMenuItemVm,
): Promise<FoodDishForm['photos']> {
  if (token && vendorId && item.id) {
    try {
      const fromApi = sanitizeDishPhotos(await fetchFoodItemPhotos(token, vendorId, item.id));
      if (fromApi.length > 0) {
        return fromApi;
      }
    } catch {
      // fall through to menu-derived urls
    }
  }
  return photosFromItem(item);
}

const emptyForm = (): FoodDishForm => ({
  name: '',
  price: '',
  veg: null,
  note: '',
  photos: [],
});

export function FoodDeskPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const vendorId = session?.vendorId ?? '';
  const narrow = useIsNarrow(767);
  const [categories, setCategories] = useState<FoodMenuCategoryVm[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<FoodDishForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [editPhotosLoading, setEditPhotosLoading] = useState(false);
  const editSessionRef = useRef(0);

  const sheetOpen = openCategoryId != null;
  const modalCategory = useMemo(
    () => categories.find((c) => c.id === openCategoryId) ?? null,
    [categories, openCategoryId],
  );
  const editingItem = useMemo(() => {
    if (!editingItemId) return null;
    for (const cat of categories) {
      const hit = cat.items.find((i) => i.id === editingItemId);
      if (hit) return hit;
    }
    return null;
  }, [categories, editingItemId]);

  const stats = useMemo(() => {
    const dishes = categories.reduce((n, c) => n + c.items.length, 0);
    const withPhotos = categories.reduce(
      (n, c) =>
        n +
        c.items.filter((i) => (i.photos?.length ?? 0) > 0 || (i.imageUrls?.length ?? 0) > 0).length,
      0,
    );
    return { categories: categories.length, dishes, withPhotos };
  }, [categories]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  );

  const ensureShopLive = useCallback(async () => {
    if (!token || !vendorId) return;
    await saveFoodProfile(token, vendorId, { enabled: true, acceptingOrders: true });
  }, [token, vendorId]);

  const reload = useCallback((options?: { silent?: boolean }) => {
    if (!token || !vendorId) {
      return Promise.resolve();
    }
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    return fetchFoodMenu(token, vendorId)
      .then((menu) => setCategories(menu.categories ?? []))
      .catch((err) => {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load menu');
      })
      .finally(() => {
        if (!options?.silent) {
          setLoading(false);
        }
      });
  }, [token, vendorId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategoryId(null);
      return;
    }
    if (!activeCategoryId || !categories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  usePortalChrome({ title: 'Food menu', onRefresh: () => void reload() });

  async function addCategory() {
    const name = newCategory.trim();
    if (!name || !token || !vendorId) return;
    setBusy(true);
    try {
      await ensureShopLive();
      const created = await createFoodCategory(token, vendorId, name);
      setNewCategory('');
      setToast(`Category “${name}” added`);
      setActiveCategoryId(created.id);
      reload();
    } catch (err) {
      setToast(err instanceof ApiError || err instanceof Error ? err.message : 'Could not add category');
    } finally {
      setBusy(false);
    }
  }

  function startAddItem(categoryId: string) {
    setOpenCategoryId(categoryId);
    setEditingItemId(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function startEditItem(item: FoodMenuItemVm) {
    const session = ++editSessionRef.current;
    setOpenCategoryId(item.categoryId);
    setEditingItemId(item.id);
    setEditPhotosLoading(true);
    const preload = photosFromItem(item);
    setForm({
      name: item.name,
      price: String(item.price),
      veg: item.veg,
      note: item.buyerNote,
      photos: preload,
    });
    setFormError(null);
    void loadPhotosForEdit(token, vendorId, item)
      .then((photos) => {
        if (session !== editSessionRef.current) return;
        setForm((prev) => ({
          ...prev,
          photos: mergeDishPhotos(prev.photos, photos),
        }));
      })
      .finally(() => {
        if (session === editSessionRef.current) {
          setEditPhotosLoading(false);
        }
      });
  }

  function closeItemSheet() {
    editSessionRef.current += 1;
    setEditPhotosLoading(false);
    setOpenCategoryId(null);
    setEditingItemId(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function showToast(message: string, tone: 'success' | 'danger' = 'success') {
    setToastTone(tone);
    setToast(message);
  }

  async function saveItem() {
    const categoryId = openCategoryId;
    if (!token || !vendorId || !categoryId) return;
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0) {
      const msg = 'Enter dish name and a valid price';
      setFormError(msg);
      showToast(msg, 'danger');
      return;
    }
    if (form.veg === null) {
      const msg = 'Choose Veg or Non-veg';
      setFormError(msg);
      showToast(msg, 'danger');
      return;
    }
    if (!form.note.trim()) {
      const msg = 'Add a short note for customers';
      setFormError(msg);
      showToast(msg, 'danger');
      return;
    }
    setFormError(null);
    const photosToSave = sanitizeDishPhotos(form.photos);
    const hadPhotos = (editingItem?.imageUrls?.length ?? 0) > 0;
    const syncPhotos = photosToSave.length > 0 || (Boolean(editingItemId) && hadPhotos);
    const body = {
      categoryId,
      name: form.name.trim(),
      buyerNote: form.note.trim(),
      price,
      veg: form.veg,
      active: true,
      ...(syncPhotos
        ? {
            images: photosToSave.map((p) => ({ mediaId: p.mediaId, url: p.url })),
          }
        : {}),
    };
    setBusy(true);
    try {
      await ensureShopLive();
      if (editingItemId) {
        await updateFoodItem(token, vendorId, editingItemId, body);
      } else {
        await createFoodItem(token, vendorId, body);
      }
      await reload({ silent: true });
      showToast(editingItemId ? 'Dish updated' : 'Dish added', 'success');
      closeItemSheet();
    } catch (err) {
      const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Could not save dish';
      setFormError(msg);
      showToast(msg, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={narrow ? S.pageNarrow : S.page}>
      <style>{DESK_CSS}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <section style={S.heroCard}>
        <div style={S.heroTop}>
          <div>
            <p style={S.heroEyebrow}>Customer menu</p>
            <h2 style={S.heroTitle}>Food desk</h2>
            <p style={S.heroSub}>Categories on the left · dishes on the right · buyers see this in the app.</p>
          </div>
          <div style={S.statGrid}>
            <StatPill label="Categories" value={stats.categories} />
            <StatPill label="Dishes" value={stats.dishes} accent />
            <StatPill label="With photo" value={stats.withPhotos} />
          </div>
        </div>
        <AddCategoryRow>
          <input
            id="food-new-category"
            name="foodNewCategory"
            style={INPUT}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category — Starters, Biryani…"
            aria-label="New category"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addCategory();
            }}
          />
          <Button type="button" size="sm" disabled={busy || !newCategory.trim()} onClick={() => void addCategory()}>
            + Category
          </Button>
        </AddCategoryRow>
      </section>

      {token && vendorId ? (
        <FoodHotelPhotosCard
          token={token}
          vendorId={vendorId}
          onToast={(msg) => showToast(msg, 'success')}
          onError={(msg) => showToast(msg, 'danger')}
        />
      ) : null}

      {loading ? <p style={S.muted}>Loading menu…</p> : null}

      {!loading && categories.length === 0 ? (
        <section style={S.emptyHero}>
          <span style={S.emptyEmoji} aria-hidden>
            🍽️
          </span>
          <h3 style={S.emptyTitle}>Start your menu</h3>
          <p style={S.emptyText}>Add a category above, pick it on the left, then add your first dish.</p>
        </section>
      ) : null}

      {!loading && categories.length > 0 ? (
        <div className="hlm-food-desk-split">
          <nav className="hlm-food-desk-rail" aria-label="Menu categories">
            {categories.map((cat) => {
              const on = cat.id === activeCategoryId;
              const count = cat.items.length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  style={on ? S.railOn : S.railItem}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  <span style={S.railName}>{cat.name}</span>
                  <span style={on ? S.railCountOn : S.railCount}>{count}</span>
                </button>
              );
            })}
          </nav>

          <FoodDeskPanel className="hlm-food-desk-panel">
            {activeCategory ? (
              <>
                <header style={S.panelHead}>
                  <div style={S.panelTitleWrap}>
                    <h3 style={S.panelTitle}>{activeCategory.name}</h3>
                    <span style={S.panelMeta}>
                      {activeCategory.items.length} dish{activeCategory.items.length === 1 ? '' : 'es'}
                    </span>
                  </div>
                  <Button type="button" size="sm" onClick={() => startAddItem(activeCategory.id)}>
                    + Add dish
                  </Button>
                </header>

                {activeCategory.items.length > 0 ? (
                  <ul style={S.dishGrid}>
                    {activeCategory.items.map((item, index) => (
                      <li key={item.id}>
                        <DishCard
                          item={item}
                          zebra={index % 2 === 1}
                          onEdit={() => void startEditItem(item)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ActivationEmpty onAdd={() => startAddItem(activeCategory.id)} />
                )}
              </>
            ) : (
              <p style={S.mutedPanel}>Select a category.</p>
            )}
          </FoodDeskPanel>
        </div>
      ) : null}

      <FoodDishSheet
        open={sheetOpen && modalCategory != null}
        categoryName={modalCategory?.name ?? ''}
        mode={editingItemId ? 'edit' : 'add'}
        dishName={editingItem?.name}
        form={form}
        busy={busy}
        narrow={narrow}
        token={token}
        formError={formError}
        photosLoading={editPhotosLoading}
        onChange={setForm}
        onClose={closeItemSheet}
        onSave={() => void saveItem()}
        onToast={(msg) => showToast(msg, 'danger')}
      />

      <Toast
        open={Boolean(toast)}
        message={toast ?? ''}
        tone={toastTone}
        placement={toastTone === 'danger' ? 'center' : 'bottom'}
        bottom="calc(env(safe-area-inset-bottom, 0px) + 4.5rem)"
        onClose={() => setToast(null)}
      />
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={accent ? S.statPillOn : S.statPill}>
      <span style={S.statValue}>{value}</span>
      <span style={S.statLabel}>{label}</span>
    </div>
  );
}

function AddCategoryRow({ children }: { children: ReactNode }) {
  return <div style={S.addRow}>{children}</div>;
}

function FoodDeskPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function ActivationEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={S.panelEmpty}>
      <p style={S.panelEmptyTitle}>No dishes here yet</p>
      <p style={S.panelEmptyText}>Add name, price, veg/non-veg and a short note — buyers see it instantly.</p>
      <Button type="button" size="sm" onClick={onAdd}>
        + Add first dish
      </Button>
    </div>
  );
}

function DishCard({
  item,
  zebra,
  onEdit,
}: {
  item: FoodMenuItemVm;
  zebra: boolean;
  onEdit: () => void;
}) {
  const thumb = item.imageUrls?.[0];
  return (
    <article style={{ ...S.dishCard, ...(zebra ? S.dishCardZebra : null) }}>
      <div style={S.dishMedia}>
        {thumb ? (
          <img src={resolveMediaContentUrl(thumb)} alt="" style={S.dishPhoto} loading="lazy" />
        ) : (
          <div style={S.dishPhotoPlaceholder} aria-hidden>
            🍴
          </div>
        )}
      </div>
      <div style={S.dishBody}>
        <div style={S.dishTitleRow}>
          <VegBadge veg={item.veg} />
          <span style={S.dishName}>{item.name}</span>
        </div>
        <p style={S.dishNote}>{item.buyerNote}</p>
        {(item.imageUrls?.length ?? 0) > 1 ? (
          <span style={S.photoHint}>{item.imageUrls!.length} photos</span>
        ) : null}
      </div>
      <div style={S.dishAside}>
        <span style={S.dishPrice}>₹{item.price}</span>
        <button type="button" style={S.editBtn} onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  );
}

function VegBadge({ veg }: { veg: boolean }) {
  return (
    <span
      style={{
        width: 11,
        height: 11,
        border: `2px solid ${veg ? '#16a34a' : '#dc2626'}`,
        borderRadius: 2,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
      title={veg ? 'Veg' : 'Non-veg'}
      aria-hidden
    />
  );
}

const S: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '0.55rem', paddingBottom: '1rem' },
  pageNarrow: { display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '4.25rem' },
  heroCard: {
    padding: '0.75rem 0.85rem',
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elevated)), var(--bg-elevated) 55%)',
    boxShadow: 'var(--shadow-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  heroTop: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.55rem',
  },
  heroEyebrow: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  heroTitle: {
    margin: '0.1rem 0 0',
    fontSize: '1.15rem',
    fontWeight: 900,
    fontFamily: 'var(--font-display)',
    lineHeight: 1.15,
  },
  heroSub: { margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '28rem', lineHeight: 1.35 },
  statGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  statPill: {
    minWidth: 62,
    padding: '0.35rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.05rem',
  },
  statPillOn: {
    minWidth: 62,
    padding: '0.35rem 0.5rem',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'var(--accent-soft)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.05rem',
  },
  statValue: { fontSize: '1rem', fontWeight: 900, lineHeight: 1, color: 'var(--text)' },
  statLabel: { fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' },
  addRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem', alignItems: 'center' },
  muted: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  emptyHero: {
    textAlign: 'center',
    padding: '1.25rem 0.85rem',
    borderRadius: 14,
    border: '1px dashed color-mix(in srgb, var(--accent) 30%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 4%, var(--bg-muted))',
  },
  emptyEmoji: { fontSize: '2rem' },
  emptyTitle: { margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 800 },
  emptyText: { margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' },
  railItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.15rem',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    borderLeft: '3px solid transparent',
    background: 'transparent',
    padding: '0.52rem 0.45rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 44px)',
  },
  railOn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.15rem',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent)',
    background: 'var(--bg-elevated)',
    padding: '0.52rem 0.45rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--accent)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min, 44px)',
  },
  railName: { lineHeight: 1.25, wordBreak: 'break-word', width: '100%' },
  railCount: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' },
  railCountOn: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)' },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.55rem 0.65rem',
    borderBottom: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg-muted) 40%, var(--bg-elevated))',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  panelTitleWrap: { minWidth: 0 },
  panelTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 900, fontFamily: 'var(--font-display)', lineHeight: 1.2 },
  panelMeta: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  mutedPanel: { margin: 0, padding: '1rem 0.65rem', fontSize: '0.82rem', color: 'var(--text-muted)' },
  panelEmpty: {
    padding: '1.1rem 0.75rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.35rem',
  },
  panelEmptyTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  panelEmptyText: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '16rem', lineHeight: 1.35 },
  dishGrid: { listStyle: 'none', margin: 0, padding: '0.35rem 0.45rem 0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  dishCard: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '0.45rem',
    alignItems: 'flex-start',
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
    background: 'var(--bg-elevated)',
  },
  dishCardZebra: {
    background: 'var(--hlm-row-stripe-b, color-mix(in srgb, var(--bg-muted) 50%, var(--bg-elevated)))',
  },
  dishMedia: { flexShrink: 0 },
  dishPhoto: { width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' },
  dishPhotoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    border: '1px dashed var(--border)',
    background: 'var(--bg-muted)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.1rem',
  },
  dishBody: { minWidth: 0 },
  dishTitleRow: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  dishName: { fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25 },
  dishNote: {
    margin: '0.18rem 0 0',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  photoHint: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' },
  dishAside: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 },
  dishPrice: {
    fontWeight: 900,
    fontSize: '0.86rem',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    padding: '0.15rem 0.4rem',
    borderRadius: 8,
  },
  editBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    padding: '0.28rem 0.55rem',
    borderRadius: 8,
    minHeight: 32,
  },
};