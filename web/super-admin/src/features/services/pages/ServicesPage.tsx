import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import {
  createService,
  deleteService,
  listServices,
  updateService,
  type ServiceOffering,
} from '../api/servicesApi';

export function ServicesPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [hidesListings, setHidesListings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listServices(token);
      setServices(rows);
      setNames(Object.fromEntries(rows.map((row) => [row.id, row.name])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load services');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onAdd() {
    const next = name.trim();
    if (!next) {
      setError('Service name is required');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createService(token, next, hidesListings || /laundry/i.test(next));
      setName('');
      setHidesListings(false);
      setNotice(`${next} added`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not add service');
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(row: ServiceOffering, nextName: string, hide: boolean) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setError('Service name is required');
      setNames((prev) => ({ ...prev, [row.id]: row.name }));
      return;
    }
    const hideListings = hide || /laundry/i.test(trimmed);
    if (trimmed === row.name && hideListings === row.hidesListings) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateService(token, row.id, trimmed, hideListings);
      setNotice(`${trimmed} saved`);
      await reload();
    } catch (err) {
      setNames((prev) => ({ ...prev, [row.id]: row.name }));
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save service');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!removeId) return;
    const row = services.find((item) => item.id === removeId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteService(token, removeId);
      setNotice(`${row?.name ?? 'Service'} removed`);
      setRemoveId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not remove service');
    } finally {
      setBusy(false);
    }
  }

  const removing = services.find((item) => item.id === removeId);

  return (
    <PortalShell title="Services" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.card}>
        <p style={styles.hint}>
          Names here are the Service choices when adding a vendor.{' '}
          <Link to="/vendors" style={styles.link}>
            Back to vendors
          </Link>
          . Laundry always hides Listings.
        </p>
        <div style={styles.addRow}>
          <TextField
            id="new-service-name"
            label="Service name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Groceries"
            maxLength={80}
            style={styles.nameField}
          />
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={hidesListings || /laundry/i.test(name)}
              disabled={/laundry/i.test(name)}
              onChange={(e) => setHidesListings(e.target.checked)}
            />
            Hide Listings
          </label>
          <Button disabled={busy || !name.trim()} onClick={() => void onAdd()}>
            {busy ? 'Saving…' : 'Add'}
          </Button>
        </div>
      </Card>

      <Card style={styles.card}>
        {loading && services.length === 0 ? (
          <p style={styles.hint}>Loading…</p>
        ) : services.length === 0 ? (
          <p style={styles.hint}>No services yet. Add Groceries and Laundry.</p>
        ) : (
          <div style={styles.list}>
            {services.map((row) => (
              <div key={row.id} style={styles.row}>
                <TextField
                  id={`service-name-${row.id}`}
                  label="Name"
                  value={names[row.id] ?? row.name}
                  maxLength={80}
                  style={styles.nameField}
                  onChange={(e) => setNames((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  onBlur={() => void saveRow(row, names[row.id] ?? row.name, row.hidesListings)}
                />
                <label style={styles.check}>
                  <input
                    type="checkbox"
                    checked={row.hidesListings || /laundry/i.test(names[row.id] ?? row.name)}
                    disabled={busy || /laundry/i.test(names[row.id] ?? row.name)}
                    onChange={(e) => void saveRow(row, names[row.id] ?? row.name, e.target.checked)}
                  />
                  Hide Listings
                </label>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoveId(row.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(removeId)}
        title={`Remove ${removing?.name ?? 'service'}?`}
        description="Vendors already using it cannot be left without a service, so removal is blocked while it is in use."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={() => void onRemove()}
        onClose={() => setRemoveId(null)}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.45rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem' },
  link: { color: 'var(--accent)', fontWeight: 700 },
  addRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'end',
  },
  list: { display: 'grid', gap: '0.45rem' },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'end',
  },
  nameField: { flex: '1 1 180px', minWidth: 140, maxWidth: 280 },
  check: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    minHeight: 44,
    fontSize: '0.86rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
};
