import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { useAuth } from '@/shared/auth/AuthContext';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  createVendorDeliveryAgent,
  fetchVendorDeliveryAgents,
  type VendorAgentDto,
} from '../api/deliveryAgentsApi';

export function DeliveryAgentsPage() {
  const { session } = useAuth();
  const { shop, loading: shopLoading } = useVendorShop();
  const [agents, setAgents] = useState<VendorAgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [govtIdType, setGovtIdType] = useState('AADHAAR');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  const [reference1Name, setReference1Name] = useState('');
  const [reference1Phone, setReference1Phone] = useState('');
  const [reference2Name, setReference2Name] = useState('');
  const [reference2Phone, setReference2Phone] = useState('');

  usePortalChrome({ title: 'Delivery agents' });

  const scope = useMemo(() => {
    if (!session || !shop?.shopId || !shop?.townId) return null;
    return {
      token: session.accessToken,
      vendorId: session.vendorId,
      shopId: shop.shopId,
      townId: shop.townId,
    };
  }, [session, shop?.shopId, shop?.townId]);

  const reload = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      setAgents(await fetchVendorDeliveryAgents(scope));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load agents');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createVendorDeliveryAgent(scope, {
        name: name.trim(),
        phone: trimmedPhone,
        password,
        govtIdType: showOptional && govtIdNumber.trim() ? govtIdType : undefined,
        govtIdNumber: showOptional ? govtIdNumber.replace(/\s/g, '').trim() || undefined : undefined,
        reference1Name: showOptional ? reference1Name.trim() || undefined : undefined,
        reference1Phone: showOptional ? reference1Phone.trim() || undefined : undefined,
        reference2Name: showOptional ? reference2Name.trim() || undefined : undefined,
        reference2Phone: showOptional ? reference2Phone.trim() || undefined : undefined,
      });
      setNotice(`Agent ${name.trim()} created. They can log in on the delivery app.`);
      setName('');
      setPhone('');
      setPassword('');
      setTab('list');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not create agent');
    } finally {
      setCreating(false);
    }
  }

  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;

  if (shopLoading && !shop) {
    return <p style={styles.muted}>Loading shop…</p>;
  }
  if (!scope) {
    return (
      <Banner tone="warning">
        Shop details missing. Open <Link to="/settings">Settings</Link> or contact support.
      </Banner>
    );
  }

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.toolbar}>
        <p style={styles.meta}>
          {activeCount} active · {agents.length} total · shop delivery staff (not hub agents)
        </p>
        <div style={styles.tabs}>
          <button
            type="button"
            style={tab === 'list' ? styles.tabOn : styles.tab}
            onClick={() => setTab('list')}
          >
            Agents
          </button>
          <button
            type="button"
            style={tab === 'add' ? styles.tabOn : styles.tab}
            onClick={() => setTab('add')}
          >
            Add agent
          </button>
        </div>
      </div>

      {tab === 'list' ? (
        loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : agents.length === 0 ? (
          <Card style={styles.empty}>
            <p style={styles.emptyTitle}>No delivery agents yet</p>
            <p style={styles.muted}>Add one to deliver orders with “Delivery by my agent”.</p>
            <Button size="sm" onClick={() => setTab('add')}>
              Add agent
            </Button>
          </Card>
        ) : (
          <ul style={styles.list}>
            {agents.map((a) => (
              <li key={a.agentId}>
                <Card style={styles.row}>
                  <span style={styles.rowName}>{a.name}</span>
                  <span style={styles.muted}>{a.phone}</span>
                  <span style={a.status === 'ACTIVE' ? styles.badgeOk : styles.badgeOff}>{a.status}</span>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : (
        <Card style={styles.formCard}>
          <p style={styles.hint}>Name and mobile are required. Agent uses the delivery app to reach buyers.</p>
          <form style={styles.form} onSubmit={(e) => void onCreate(e)}>
            <div style={styles.row2}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField
                label="Mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                required
              />
            </div>
            <TextField
              label="Login password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              style={styles.optionalToggle}
              onClick={() => setShowOptional((v) => !v)}
            >
              {showOptional ? 'Hide' : 'Show'} optional ID & references (same as hub form)
            </button>
            {showOptional ? (
              <>
                <div style={styles.row2}>
                  <label style={styles.selectWrap}>
                    <span style={styles.label}>ID type</span>
                    <select
                      style={styles.select}
                      value={govtIdType}
                      onChange={(e) => setGovtIdType(e.target.value)}
                    >
                      <option value="AADHAAR">Aadhaar</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="DRIVING_LICENSE">Driving licence</option>
                      <option value="PAN">PAN</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <TextField
                    label="ID number"
                    value={govtIdNumber}
                    onChange={(e) => setGovtIdNumber(e.target.value)}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 1 name"
                    value={reference1Name}
                    onChange={(e) => setReference1Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 1 phone"
                    value={reference1Phone}
                    onChange={(e) => setReference1Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 2 name"
                    value={reference2Name}
                    onChange={(e) => setReference2Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 2 phone"
                    value={reference2Phone}
                    onChange={(e) => setReference2Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </>
            ) : null}
            <div style={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setTab('list')}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create agent'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  meta: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  tabs: { display: 'flex', gap: '0.35rem' },
  tab: {
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  tabOn: {
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.4rem' },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '0.45rem',
    alignItems: 'center',
    padding: '0.55rem 0.75rem',
  },
  rowName: { fontWeight: 700, fontSize: '0.9rem' },
  badgeOk: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
  },
  badgeOff: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' },
  empty: { textAlign: 'center', padding: '1rem' },
  emptyTitle: { margin: '0 0 0.35rem', fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  formCard: { padding: '0.75rem 0.85rem' },
  hint: { margin: '0 0 0.45rem', fontSize: '0.82rem', color: 'var(--text-muted)' },
  form: { display: 'grid', gap: '0.45rem' },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.45rem',
  },
  optionalToggle: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--accent-hover)',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  selectWrap: { display: 'grid', gap: '0.2rem' },
  label: { fontSize: '0.78rem', fontWeight: 700 },
  select: {
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.85rem',
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.25rem' },
};
