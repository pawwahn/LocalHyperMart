import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { HubShell } from '../layout/HubShell';
import {
  createHubAgent,
  fetchHubAgents,
  fetchMyHub,
  updateHubAgentStatus,
  type AgentDto,
  type CreateAgentInput,
} from '../api/hubApi';
import { HubAgentRatingsSheet } from '../components/HubAgentRatingsSheet';

const GOVT_ID_OPTIONS: Array<{ value: CreateAgentInput['govtIdType']; label: string }> = [
  { value: 'AADHAAR', label: 'Aadhaar card' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving licence' },
  { value: 'PAN', label: 'PAN card' },
  { value: 'OTHER', label: 'Other government proof' },
];

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  govtIdType: 'AADHAAR' as CreateAgentInput['govtIdType'],
  govtIdNumber: '',
  reference1Name: '',
  reference1Phone: '',
  reference2Name: '',
  reference2Phone: '',
};

export function HubAgentsPage() {
  const { session } = useAuth();
  const [hubId, setHubId] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ratingsAgent, setRatingsAgent] = useState<AgentDto | null>(null);
  const [tab, setTab] = useState<'list' | 'add'>('list');

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMyHub(session.accessToken);
      setHubId(me.hubId);
      setHubName(me.hubName);
      const list = await fetchHubAgents(session.accessToken, me.hubId);
      setAgents(list);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load delivery agents');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const active = agents.filter((a) => a.status === 'ACTIVE').length;
    const inactive = agents.filter((a) => a.status === 'INACTIVE').length;
    const disabled = agents.filter((a) => a.status === 'DISABLED').length;
    return { active, inactive, disabled, total: agents.length };
  }, [agents]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const agentPhone = form.phone.trim();
    const r1 = form.reference1Phone.trim();
    const r2 = form.reference2Phone.trim();
    if (r1 === agentPhone || r2 === agentPhone) {
      setError('Reference phones must be different from the agent phone');
      return;
    }
    if (r1 === r2) {
      setError('Reference 1 and reference 2 must use different phone numbers');
      return;
    }
    if (form.govtIdType === 'AADHAAR' && !/^\d{12}$/.test(form.govtIdNumber.replace(/\s/g, ''))) {
      setError('Aadhaar number must be 12 digits');
      return;
    }

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createHubAgent(session.accessToken, {
        name: form.name.trim(),
        phone: agentPhone,
        password: form.password,
        govtIdType: form.govtIdType,
        govtIdNumber: form.govtIdNumber.replace(/\s/g, '').trim(),
        reference1Name: form.reference1Name.trim(),
        reference1Phone: r1,
        reference2Name: form.reference2Name.trim(),
        reference2Phone: r2,
      });
      setNotice(`Delivery agent ${form.name.trim()} created and active.`);
      setForm(emptyForm);
      setTab('list');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not create delivery agent');
    } finally {
      setCreating(false);
    }
  }

  async function onToggle(agent: AgentDto) {
    if (!session) return;
    if (agent.status === 'DISABLED') {
      setError('This delivery agent is permanently disabled. Only platform admin can restore.');
      return;
    }
    const next = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = next === 'INACTIVE' ? 'Deactivate' : 'Activate';
    if (!window.confirm(`${action} ${agent.name}?`)) return;

    setBusyId(agent.agentId);
    setError(null);
    setNotice(null);
    try {
      await updateHubAgentStatus(session.accessToken, agent.agentId, next);
      setNotice(
        next === 'INACTIVE'
          ? `${agent.name} deactivated — cannot be assigned trips.`
          : `${agent.name} activated — can take trips again.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <HubShell
      title="Delivery agents"
      subtitle={hubName ? `Manage delivery agents · ${hubName}` : 'Manage delivery agents'}
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.tabs} role="tablist" aria-label="Delivery agents">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'list'}
          style={tab === 'list' ? styles.tabActive : styles.tab}
          onClick={() => setTab('list')}
        >
          Your delivery agents
          <span style={styles.tabCount}>{counts.total}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'add'}
          style={tab === 'add' ? styles.tabActive : styles.tab}
          onClick={() => setTab('add')}
        >
          Add delivery agent
        </button>
      </div>

      {tab === 'add' ? (
      <Card elevated style={styles.card}>
        <p style={styles.hint}>Login + hub link. Govt ID and 2 references required.</p>
        <form style={styles.form} onSubmit={(e) => void onCreate(e)}>
          <div style={styles.row2}>
            <TextField
              compact
              label="Name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              autoComplete="name"
              placeholder="Raju Delivery"
            />
            <TextField
              compact
              label="Phone"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              autoComplete="tel"
              placeholder="9876500200"
            />
          </div>
          <TextField
            compact
            label="Temp password (min 8)"
            type="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          <div style={styles.section}>
            <p style={styles.sectionTitle}>Government proof</p>
            <div style={styles.row2}>
              <label style={styles.selectLabel}>
                ID type
                <select
                  style={styles.select}
                  value={form.govtIdType}
                  onChange={(e) => updateField('govtIdType', e.target.value as CreateAgentInput['govtIdType'])}
                  required
                >
                  {GOVT_ID_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                compact
                label={form.govtIdType === 'AADHAAR' ? 'Aadhaar (12 digits)' : 'ID number'}
                value={form.govtIdNumber}
                onChange={(e) => updateField('govtIdNumber', e.target.value)}
                required
                inputMode="numeric"
                maxLength={form.govtIdType === 'AADHAAR' ? 12 : 40}
                placeholder={form.govtIdType === 'AADHAAR' ? 'XXXXXXXXXXXX' : 'ID number'}
              />
            </div>
          </div>

          <div style={styles.section}>
            <p style={styles.sectionTitle}>Reference 1</p>
            <div style={styles.row2}>
              <TextField
                compact
                label="Name"
                value={form.reference1Name}
                onChange={(e) => updateField('reference1Name', e.target.value)}
                required
                placeholder="Relative / neighbour"
              />
              <TextField
                compact
                label="Phone"
                value={form.reference1Phone}
                onChange={(e) => updateField('reference1Phone', e.target.value)}
                required
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          <div style={styles.section}>
            <p style={styles.sectionTitle}>Reference 2</p>
            <div style={styles.row2}>
              <TextField
                compact
                label="Name"
                value={form.reference2Name}
                onChange={(e) => updateField('reference2Name', e.target.value)}
                required
                placeholder="Relative / neighbour"
              />
              <TextField
                compact
                label="Phone"
                value={form.reference2Phone}
                onChange={(e) => updateField('reference2Phone', e.target.value)}
                required
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          <Button type="submit" disabled={creating || !hubId}>
            {creating ? 'Creating…' : 'Create delivery agent'}
          </Button>
        </form>
      </Card>
      ) : (
      <Card elevated style={styles.card}>
        <div style={styles.summary} aria-label="Delivery agent counts">
          <div style={styles.stat}>
            <span style={styles.statValue}>{counts.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{counts.active}</span>
            <span style={styles.statLabel}>Active</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{counts.inactive}</span>
            <span style={styles.statLabel}>Inactive</span>
          </div>
          {counts.disabled > 0 ? (
            <div style={styles.stat}>
              <span style={styles.statValue}>{counts.disabled}</span>
              <span style={styles.statLabel}>Disabled</span>
            </div>
          ) : null}
        </div>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : agents.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.muted}>No delivery agents yet.</p>
            <Button size="sm" onClick={() => setTab('add')}>
              Add delivery agent
            </Button>
          </div>
        ) : (
          <ul style={styles.list}>
            {agents.map((agent) => {
              const busy = busyId === agent.agentId;
              const disabled = agent.status === 'DISABLED';
              return (
                <li key={agent.agentId} style={styles.row}>
                  <div style={styles.rowMain}>
                    <strong style={styles.name}>{agent.name}</strong>
                    <span style={styles.meta}>{agent.phone}</span>
                    {agent.govtIdType ? (
                      <span style={styles.meta}>
                        {agent.govtIdType.replaceAll('_', ' ')} {agent.govtIdNumber ?? ''}
                      </span>
                    ) : null}
                    {agent.reference1Name ? (
                      <span style={styles.meta}>
                        Refs: {agent.reference1Name} ({agent.reference1Phone}) · {agent.reference2Name} (
                        {agent.reference2Phone})
                      </span>
                    ) : null}
                    <span
                      style={
                        agent.status === 'ACTIVE'
                          ? styles.badgeOn
                          : agent.status === 'INACTIVE'
                            ? styles.badgeOff
                            : styles.badgeDead
                      }
                    >
                      {agent.status === 'ACTIVE'
                        ? 'ACTIVE'
                        : agent.status === 'INACTIVE'
                          ? 'INACTIVE'
                          : 'DISABLED'}
                    </span>
                  </div>
                  <div style={styles.rowActions}>
                    <Button size="sm" variant="ghost" onClick={() => setRatingsAgent(agent)}>
                      ★ Ratings
                    </Button>
                    {disabled ? (
                      <span style={styles.mutedSmall}>Contact platform admin</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={agent.status === 'ACTIVE' ? 'secondary' : 'primary'}
                        disabled={busy}
                        onClick={() => void onToggle(agent)}
                      >
                        {busy
                          ? 'Saving…'
                          : agent.status === 'ACTIVE'
                            ? 'Deactivate'
                            : 'Activate'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      )}
      {ratingsAgent && session ? (
        <HubAgentRatingsSheet
          agent={ratingsAgent}
          token={session.accessToken}
          onClose={() => setRatingsAgent(null)}
        />
      ) : null}
    </HubShell>
  );
}

const styles: Record<string, CSSProperties> = {
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
    gap: '0.4rem',
  },
  stat: {
    padding: '0.4rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.05rem',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text)',
  },
  statLabel: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 3,
    padding: 3,
    marginBottom: '0.55rem',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
  },
  tab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.82rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    cursor: 'pointer',
    minHeight: 'var(--touch-min)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
  },
  tabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.82rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    cursor: 'pointer',
    minHeight: 'var(--touch-min)',
    boxShadow: 'var(--shadow-card)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
  },
  tabCount: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.08rem 0.4rem',
    fontVariantNumeric: 'tabular-nums',
  },
  card: { padding: '0.75rem', display: 'grid', gap: '0.45rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
  form: { display: 'grid', gap: '0.45rem' },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.45rem',
  },
  section: { display: 'grid', gap: '0.35rem' },
  sectionTitle: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  selectLabel: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    minWidth: 0,
  },
  select: {
    width: '100%',
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.92rem',
    minHeight: 'var(--touch-min)',
    boxSizing: 'border-box',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  empty: { display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' },
  mutedSmall: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.55rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  rowMain: { display: 'grid', gap: '0.12rem', minWidth: 0 },
  rowActions: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  name: { fontSize: '0.92rem' },
  meta: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  badgeOn: {
    width: 'fit-content',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.12rem 0.45rem',
  },
  badgeOff: {
    width: 'fit-content',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.12rem 0.45rem',
  },
  badgeDead: {
    width: 'fit-content',
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--danger)',
    background: 'var(--danger-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.12rem 0.45rem',
  },
};
