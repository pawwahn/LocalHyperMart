import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  createTown,
  listTowns,
  updateTownStatus,
  type TownVm,
} from '../api/townsApi';

export function TownsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState('Andhra Pradesh');
  const [townCode, setTownCode] = useState('');
  const [stateCode, setStateCode] = useState('AP');
  const [pincodes, setPincodes] = useState('');
  const [radius, setRadius] = useState('10');

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setTowns(await listTowns(token));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createTown(token, {
        name: name.trim(),
        state: state.trim(),
        townCode: townCode.trim().toUpperCase(),
        stateCode: stateCode.trim().toUpperCase(),
        pincodes: pincodes
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        coverageRadiusKm: Number(radius) || 10,
      });
      setNotice('Town created');
      setName('');
      setTownCode('');
      setPincodes('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(town: TownVm) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = town.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
      await updateTownStatus(token, town.id, next, next === 'DISABLED' ? 'Paused by super admin' : undefined);
      setNotice(`${town.displayName} → ${next}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Towns" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <h2 style={styles.sectionTitle}>Create town</h2>
        <div style={styles.formGrid}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="State" value={state} onChange={(e) => setState(e.target.value)} />
          <TextField label="Town code" value={townCode} onChange={(e) => setTownCode(e.target.value)} />
          <TextField label="State code" value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
          <TextField
            label="Pincodes (comma-separated)"
            value={pincodes}
            onChange={(e) => setPincodes(e.target.value)}
          />
          <TextField
            label="Coverage km"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <Button disabled={busy || !name.trim() || !townCode.trim()} onClick={() => void onCreate()}>
          Create town
        </Button>
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>All towns</h2>
        <div style={styles.list}>
          {towns.length === 0 ? (
            <p style={styles.muted}>No towns yet.</p>
          ) : (
            towns.map((town) => (
              <div key={town.id} style={styles.row}>
                <div>
                  <strong>{town.displayName}</strong>
                  <p style={styles.muted}>
                    {town.townCode}/{town.stateCode} · {town.status}
                    {town.acceptingOrders ? ' · accepting orders' : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={town.status === 'ENABLED' ? 'danger' : 'primary'}
                  disabled={busy}
                  onClick={() => void toggleStatus(town)}
                >
                  {town.status === 'ENABLED' ? 'Disable' : 'Enable'}
                </Button>
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
  list: { display: 'grid', gap: '0.65rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.65rem 0',
    borderBottom: '1px solid var(--border)',
  },
  muted: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' },
};
