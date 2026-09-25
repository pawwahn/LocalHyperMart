import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import { listMasterItemsPage, type MasterItemVm } from '@/features/catalog/api/catalogApi';
import {
  createAdminRecipe,
  deleteAdminRecipe,
  fetchAdminRecipe,
  fetchAdminRecipes,
  updateAdminRecipe,
  type AdminRecipeDetail,
  type AdminRecipeSummary,
  type UpsertRecipeInput,
} from '../api/recipesApi';

type IngredientDraft = {
  key: string;
  masterItemId: string;
  masterItemLabel: string;
  quantityLabel: string;
  itemQuery: string;
};

function emptyForm(): {
  name: string;
  searchText: string;
  servings: string;
  enabled: boolean;
  ingredients: IngredientDraft[];
} {
  return {
    name: '',
    searchText: '',
    servings: '4',
    enabled: true,
    ingredients: [
      {
        key: crypto.randomUUID(),
        masterItemId: '',
        masterItemLabel: '',
        quantityLabel: '',
        itemQuery: '',
      },
    ],
  };
}

type RecipeFormState = ReturnType<typeof emptyForm>;

function detailToForm(d: AdminRecipeDetail): RecipeFormState {
  return {
    name: d.name,
    searchText: d.searchText,
    servings: String(d.servings),
    enabled: d.enabled,
    ingredients: d.ingredients.map((i) => ({
      key: i.id ?? crypto.randomUUID(),
      masterItemId: String(i.masterItemId),
      masterItemLabel: i.masterItemName ?? '',
      quantityLabel: i.quantityLabel,
      itemQuery: i.masterItemName ?? '',
    })),
  };
}

export function RecipesPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const [list, setList] = useState<AdminRecipeSummary[]>([]);
  const [listQ, setListQ] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [itemOptions, setItemOptions] = useState<Record<string, MasterItemVm[]>>({});

  const reloadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const page = await fetchAdminRecipes(token, { q: listQ, size: 100 });
      setList(page.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load recipes');
    } finally {
      setListLoading(false);
    }
  }, [token, listQ]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  const loadRecipe = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);
      setCreating(false);
      setSelectedId(id);
      try {
        const d = await fetchAdminRecipe(token, id);
        setForm(detailToForm(d));
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load recipe');
      }
    },
    [token],
  );

  function resetFormForNewRecipe() {
    setSelectedId(null);
    setCreating(true);
    setForm(emptyForm());
    setItemOptions({});
  }

  function startCreate() {
    resetFormForNewRecipe();
    setError(null);
    setNotice(null);
  }

  async function searchItemsForRow(rowKey: string, q: string) {
    if (!token || q.trim().length < 2) {
      setItemOptions((prev) => ({ ...prev, [rowKey]: [] }));
      return;
    }
    try {
      const page = await listMasterItemsPage(token, { q, size: 15 });
      setItemOptions((prev) => ({ ...prev, [rowKey]: page.items }));
    } catch {
      setItemOptions((prev) => ({ ...prev, [rowKey]: [] }));
    }
  }

  function buildPayload(): UpsertRecipeInput | null {
    const name = form.name.trim();
    if (!name) {
      setError('Dish name is required.');
      return null;
    }
    const servings = Number(form.servings);
    if (!Number.isFinite(servings) || servings < 1) {
      setError('Servings must be at least 1.');
      return null;
    }
    const ingredients = form.ingredients
      .filter((i) => i.masterItemId && i.quantityLabel.trim())
      .map((i, idx) => ({
        masterItemId: i.masterItemId,
        quantityLabel: i.quantityLabel.trim(),
        sortOrder: idx,
      }));
    if (!ingredients.length) {
      setError('Add at least one catalog item with a quantity label.');
      return null;
    }
    return {
      name,
      searchText: form.searchText.trim() || undefined,
      servings,
      enabled: form.enabled,
      ingredients,
    };
  }

  async function handleSave() {
    if (!token) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (creating || !selectedId) {
        await createAdminRecipe(token, payload);
      } else {
        await updateAdminRecipe(token, selectedId, payload);
      }
      setNotice('Recipe saved successfully.');
      resetFormForNewRecipe();
      await reloadList();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!token || !deleteId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAdminRecipe(token, deleteId);
      setNotice('Recipe deleted.');
      if (selectedId === deleteId) {
        setSelectedId(null);
        setCreating(false);
        setForm(emptyForm());
      }
      setDeleteId(null);
      await reloadList();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  const editorTitle = useMemo(() => {
    if (selectedId && !creating) return 'Edit recipe';
    return 'New recipe';
  }, [creating, selectedId]);

  const canDelete = Boolean(selectedId && !creating && !saving);

  function pickCatalogItem(rowKey: string, item: MasterItemVm) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((x) =>
        x.key === rowKey
          ? {
              ...x,
              masterItemId: item.id,
              masterItemLabel: item.name,
              itemQuery: item.name,
            }
          : x,
      ),
    }));
    setItemOptions((prev) => ({ ...prev, [rowKey]: [] }));
  }

  function clearCatalogItem(rowKey: string) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((x) =>
        x.key === rowKey ? { ...x, masterItemId: '', masterItemLabel: '', itemQuery: '' } : x,
      ),
    }));
  }

  return (
    <PortalShell title="Meal recipes" subtitle="Buyer meal planner dishes and ingredient mapping" onRefresh={() => void reloadList()}>
      <style>{FORM_CSS}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.layout} className="recipe-layout">
        <Card style={styles.listCard}>
          <div style={styles.listHead}>
            <TextField
              label="Search"
              value={listQ}
              onChange={(e) => setListQ(e.target.value)}
              placeholder="Dish name…"
            />
            <Button onClick={startCreate}>New recipe</Button>
          </div>
          {listLoading ? <p style={styles.muted}>Loading…</p> : null}
          <ul style={styles.list}>
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  style={{
                    ...styles.listBtn,
                    ...(selectedId === r.id && !creating ? styles.listBtnOn : null),
                  }}
                  onClick={() => void loadRecipe(r.id)}
                >
                  <span style={styles.listName}>{r.name}</span>
                  <span style={styles.listMeta}>
                    {r.servings} srv · {r.ingredientCount} items{r.enabled ? '' : ' · off'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card style={styles.formCard}>
          <h2 style={styles.formTitle}>{editorTitle}</h2>
          <>
            <p style={styles.formHint}>
              Dish name is what buyers see. Map each ingredient to a <strong>catalog product</strong> and how much the
              recipe needs (e.g. 500g). Pick a recipe on the left to edit, or fill this form and save.
            </p>
              <div className="recipe-meta-grid">
                <TextField
                  label="Dish name"
                  value={form.name}
                  placeholder="e.g. Idly"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={styles.compactInput}
                />
                <TextField
                  label="Buyer search words"
                  value={form.searchText}
                  onChange={(e) => setForm((f) => ({ ...f, searchText: e.target.value }))}
                  placeholder="Optional — defaults to dish name"
                  style={styles.compactInput}
                />
                <TextField
                  label="Servings"
                  value={form.servings}
                  onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
                  inputMode="numeric"
                  style={styles.compactInput}
                />
                <label style={styles.fieldBlock}>
                  <span style={styles.fieldLabel}>Meal planner</span>
                  <span style={styles.checkCell}>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    />
                    Show this dish to buyers
                  </span>
                </label>
              </div>

              <p style={styles.sectionLabel}>Ingredients</p>
              <p style={styles.sectionHint}>Type a product name, pick a match, then enter quantity.</p>
              <div style={styles.ingTable}>
                <div style={styles.ingHeader} className="recipe-ing-row">
                  <span>#</span>
                  <span>Catalog product</span>
                  <span>Quantity</span>
                  <span aria-hidden="true" />
                </div>
                {form.ingredients.map((row, idx) => {
                  const options = itemOptions[row.key] ?? [];
                  const picked = Boolean(row.masterItemId && row.masterItemLabel);
                  return (
                    <div key={row.key} style={styles.ingRow} className="recipe-ing-row">
                      <span style={styles.rowNum}>{idx + 1}</span>
                      <div style={styles.catalogCell}>
                        {picked ? (
                          <div style={styles.pickedBox}>
                            <span style={styles.pickedName}>{row.masterItemLabel}</span>
                            <button type="button" style={styles.linkBtn} onClick={() => clearCatalogItem(row.key)}>
                              Change
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              style={{ ...styles.compactInput, ...styles.blockInput }}
                              value={row.itemQuery}
                              placeholder="Type 2+ letters to search…"
                              aria-label={`Search catalog product ${idx + 1}`}
                              onChange={(e) => {
                                const v = e.target.value;
                                setForm((f) => ({
                                  ...f,
                                  ingredients: f.ingredients.map((x) =>
                                    x.key === row.key ? { ...x, itemQuery: v } : x,
                                  ),
                                }));
                                void searchItemsForRow(row.key, v);
                              }}
                            />
                            {options.length > 0 ? (
                              <ul style={styles.resultList}>
                                {options.map((m) => (
                                  <li key={m.id}>
                                    <button type="button" style={styles.resultBtn} onClick={() => pickCatalogItem(row.key, m)}>
                                      <span>{m.name}</span>
                                      {m.categoryName ? (
                                        <span style={styles.resultMeta}>{m.categoryName}</span>
                                      ) : null}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : row.itemQuery.trim().length >= 2 ? (
                              <p style={styles.resultEmpty}>No catalog match — try another word.</p>
                            ) : null}
                          </>
                        )}
                      </div>
                      <label style={styles.qtyField}>
                        <span style={styles.srOnly}>Quantity for ingredient {idx + 1}</span>
                        <input
                          style={{ ...styles.compactInput, ...styles.blockInput }}
                          value={row.quantityLabel}
                          placeholder="e.g. 500g"
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              ingredients: f.ingredients.map((x) =>
                                x.key === row.key ? { ...x, quantityLabel: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={form.ingredients.length <= 1}
                        style={styles.removeBtn}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            ingredients: f.ingredients.filter((x) => x.key !== row.key),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="secondary"
                size="sm"
                style={styles.addIngBtn}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    ingredients: [
                      ...f.ingredients,
                      {
                        key: crypto.randomUUID(),
                        masterItemId: '',
                        masterItemLabel: '',
                        quantityLabel: '',
                        itemQuery: '',
                      },
                    ],
                  }))
                }
              >
                Add ingredient
              </Button>

            <div style={styles.actions}>
              <Button disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving…' : 'Save recipe'}
              </Button>
              {canDelete ? (
                <Button disabled={saving} onClick={() => setDeleteId(selectedId)}>
                  Delete
                </Button>
              ) : null}
            </div>
          </>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete recipe?"
        description="Buyers will no longer see this dish in the meal planner."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={saving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteId(null)}
      />
    </PortalShell>
  );
}

const FORM_CSS = `
  .recipe-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem 0.55rem;
    align-items: end;
  }
  .recipe-ing-row {
    display: grid;
    grid-template-columns: 28px minmax(0, 2fr) minmax(110px, 0.85fr) 72px;
    gap: 0.45rem;
    align-items: start;
  }
  @media (max-width: 720px) {
    .recipe-layout { grid-template-columns: 1fr !important; }
    .recipe-meta-grid { grid-template-columns: 1fr; }
    .recipe-ing-row {
      grid-template-columns: 1fr;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 320px) minmax(0, 1fr)',
    gap: '0.65rem',
    alignItems: 'start',
  },
  listCard: { padding: '0.55rem', display: 'grid', gap: '0.45rem', maxHeight: 'calc(100dvh - 9rem)', overflow: 'hidden' },
  listHead: { display: 'grid', gap: '0.35rem' },
  list: { listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', display: 'grid', gap: '0.25rem' },
  listBtn: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    background: 'var(--bg)',
    cursor: 'pointer',
  },
  listBtnOn: {
    borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))',
    background: 'var(--accent-soft)',
  },
  listName: { display: 'block', fontWeight: 800, fontSize: '0.82rem' },
  listMeta: { display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  formCard: { padding: '0.65rem', display: 'grid', gap: '0.45rem' },
  formTitle: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  formHint: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  fieldBlock: { display: 'grid', gap: '0.35rem', minWidth: 0 },
  fieldLabel: { fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  checkCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    minHeight: 36,
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  sectionLabel: { margin: '0.35rem 0 0', fontSize: '0.8rem', fontWeight: 800 },
  sectionHint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
  ingTable: {
    display: 'grid',
    gap: 0,
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  ingHeader: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.4rem 0.45rem',
    background: 'var(--bg-muted)',
    borderBottom: '1px solid var(--border)',
  },
  ingRow: {
    padding: '0.45rem',
    borderBottom: '1px solid var(--border)',
  },
  rowNum: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', paddingTop: '0.45rem' },
  catalogCell: { minWidth: 0, position: 'relative' },
  pickedBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem',
    minHeight: 36,
    padding: '0.4rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'var(--accent-soft)',
  },
  pickedName: { fontSize: '0.82rem', fontWeight: 800, minWidth: 0 },
  linkBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    flexShrink: 0,
  },
  resultList: {
    listStyle: 'none',
    margin: '0.25rem 0 0',
    padding: 0,
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 160,
    overflowY: 'auto',
  },
  resultBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.35rem',
    padding: '0.4rem 0.5rem',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  resultMeta: { fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  resultEmpty: { margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' },
  qtyField: { display: 'block', minWidth: 0 },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
  blockInput: { width: '100%', boxSizing: 'border-box' },
  compactInput: {
    padding: '0.45rem 0.55rem',
    fontSize: '0.82rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  removeBtn: { width: '100%', minHeight: 36, padding: '0.35rem 0.4rem', marginTop: 0 },
  addIngBtn: { justifySelf: 'start', marginTop: '0.15rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
};
