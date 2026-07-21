import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  createMasterItem,
  listCategories,
  listMasterItems,
  listUnits,
  type CategoryVm,
  type MasterItemVm,
  type UnitVm,
} from '../api/catalogApi';

export function CatalogPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [items, setItems] = useState<MasterItemVm[]>([]);
  const [categories, setCategories] = useState<CategoryVm[]>([]);
  const [units, setUnits] = useState<UnitVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [mrp, setMrp] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [master, cats, uns] = await Promise.all([
        listMasterItems(token),
        listCategories(token),
        listUnits(token),
      ]);
      setItems(master);
      setCategories(cats);
      setUnits(uns);
      if (!categoryId && cats[0]) setCategoryId(cats[0].id);
      if (!unitId && uns[0]) setUnitId(uns[0].id);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load catalog');
    }
  }, [token, categoryId, unitId]);

  useEffect(() => {
    void reload();
    // intentionally load once on mount / token change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createMasterItem(token, {
        name: name.trim(),
        categoryId,
        unitId,
        mrp: mrp ? Number(mrp) : undefined,
      });
      setNotice('Master item created');
      setName('');
      setMrp('');
      const master = await listMasterItems(token);
      setItems(master);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Master catalog" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <h2 style={styles.sectionTitle}>Add master item</h2>
        <div style={styles.formGrid}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="MRP" value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" />
          <label style={styles.label}>
            Category
            <select style={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Unit
            <select style={styles.select} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button disabled={busy || !name.trim() || !categoryId || !unitId} onClick={() => void onCreate()}>
          Create item
        </Button>
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>Master items ({items.length})</h2>
        <div style={styles.list}>
          {items.length === 0 ? (
            <p style={styles.muted}>No master items.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} style={styles.row}>
                <div>
                  <strong>{item.name}</strong>
                  <p style={styles.muted}>
                    {item.categoryName ?? '—'} · {item.unitName ?? '—'}
                    {item.mrp != null ? ` · ₹${item.mrp}` : ''} · {item.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionTitle: { margin: '0 0 0.85rem', fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
    marginBottom: '0.85rem',
  },
  list: { display: 'grid', gap: '0.5rem' },
  row: {
    padding: '0.55rem 0',
    borderBottom: '1px solid var(--border)',
  },
  muted: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  select: {
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
};
