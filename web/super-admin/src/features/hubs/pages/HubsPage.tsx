import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { createHub, listHubs, type AdminHubVm } from '../api/hubsApi';

export function HubsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [hubs, setHubs] = useState<AdminHubVm[]>([]);
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [townId, setTownId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const townById = useMemo(() => {
    const map = new Map<string, TownVm>();
    for (const t of towns) map.set(t.id, t);
    return map;
  }, [towns]);

  const townsWithoutHub = useMemo(() => {
    const taken = new Set(hubs.map((h) => h.townId));
    return towns.filter((t) => t.status === 'ENABLED' && !taken.has(t.id));
  }, [towns, hubs]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [hubList, townList] = await Promise.all([listHubs(token), listTowns(token)]);
      setHubs(hubList);
      setTowns(townList);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load hubs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!townId && townsWithoutHub.length > 0) {
      setTownId(townsWithoutHub[0].id);
    }
    if (townId && !townsWithoutHub.some((t) => t.id === townId)) {
      setTownId(townsWithoutHub[0]?.id ?? '');
    }
  }, [townsWithoutHub, townId]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    if (!townId) {
      setError('Select a town that does not already have a hub');
      setBusy(false);
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit hub phone');
      setBusy(false);
      return;
    }
    if (adminPhone.trim() && !/^[6-9]\d{9}$/.test(adminPhone.trim())) {
      setError('Enter a valid 10-digit admin phone (or leave blank to use hub phone)');
      setBusy(false);
      return;
    }
    try {
      const created = await createHub(token, {
        townId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim(),
        adminPhone: adminPhone.trim() || undefined,
        adminFirstName: adminFirstName.trim() || undefined,
        adminPassword: adminPassword.trim() || undefined,
      });
      const townLabel = townById.get(created.townId)?.displayName ?? 'town';
      const pwd = created.temporaryPassword?.trim();
      setNotice(
        pwd
          ? `Hub created for ${townLabel}. Share once — ${created.adminPhone ?? created.phone} / ${pwd}`
          : `Hub created for ${townLabel}`,
      );
      setShowAdd(false);
      setName('');
      setAddress('');
      setPhone('');
      setAdminPhone('');
      setAdminFirstName('');
      setAdminPassword('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Delivery hubs" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.card}>
        <div style={styles.head}>
          <div>
            <p style={styles.hint}>
              One hub per town. Creating a hub also creates the hub-admin login for the delivery portal.
              Works the same for 2 or 10 towns — no SQL seeds.
            </p>
          </div>
          <Button
            disabled={busy || townsWithoutHub.length === 0}
            onClick={() => {
              setShowAdd((v) => !v);
              setError(null);
              setNotice(null);
            }}
          >
            {showAdd ? 'Cancel' : 'Add hub'}
          </Button>
        </div>

        {townsWithoutHub.length === 0 && !loading ? (
          <p style={styles.muted}>
            Every enabled town already has a hub (or create a new town under Towns first).
          </p>
        ) : null}

        {showAdd ? (
          <div style={styles.form}>
            <label style={styles.label}>
              Town
              <select
                style={styles.select}
                value={townId}
                onChange={(e) => setTownId(e.target.value)}
                disabled={busy}
              >
                {townsWithoutHub.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName} ({t.townCode})
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Hub name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chirala Hub"
            />
            <TextField
              label="Address (optional)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Main road, near bus stand"
            />
            <TextField
              label="Hub contact phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876511111"
              inputMode="numeric"
            />
            <TextField
              label="Admin login phone (optional)"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Same as hub phone if blank"
              inputMode="numeric"
            />
            <TextField
              label="Admin first name (optional)"
              value={adminFirstName}
              onChange={(e) => setAdminFirstName(e.target.value)}
              placeholder="Defaults to hub name"
            />
            <TextField
              label="Admin password (optional)"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Blank → HlM@ + last 4 digits"
              autoComplete="new-password"
            />
            <Button disabled={busy || !name.trim() || !phone.trim()} onClick={() => void onCreate()}>
              {busy ? 'Creating…' : 'Create hub + admin'}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : hubs.length === 0 ? (
          <p style={styles.muted}>No hubs yet. Add the first town hub above.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Hub</th>
                  <th style={styles.th}>Town</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Admin user</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {hubs.map((h) => (
                  <tr key={h.hubId}>
                    <td style={styles.td}>
                      <strong>{h.name}</strong>
                      {h.address ? <div style={styles.sub}>{h.address}</div> : null}
                    </td>
                    <td style={styles.td}>{townById.get(h.townId)?.displayName ?? h.townId.slice(0, 8)}</td>
                    <td style={styles.td}>{h.phone}</td>
                    <td style={styles.tdMuted}>{h.adminPhone ?? h.adminUserId?.slice(0, 8) ?? '—'}</td>
                    <td style={styles.td}>{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '1rem' },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 560, lineHeight: 1.45 },
  muted: { margin: 0, color: 'var(--text-muted)' },
  form: {
    display: 'grid',
    gap: '0.75rem',
    maxWidth: 420,
    padding: '0.85rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted, #fafafa)',
  },
  label: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  select: {
    padding: '0.55rem 0.65rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    font: 'inherit',
    background: 'var(--bg-elevated)',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left',
    padding: '0.55rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: { padding: '0.65rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.65rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  sub: { marginTop: 2, fontSize: '0.8rem', color: 'var(--text-muted)' },
};
