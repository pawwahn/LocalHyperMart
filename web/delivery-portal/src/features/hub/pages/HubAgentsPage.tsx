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
} from '../api/hubApi';

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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

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
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load boys');
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createHubAgent(session.accessToken, {
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      setNotice(`Boy ${name.trim()} created and active.`);
      setName('');
      setPhone('');
      setPassword('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not create boy');
    } finally {
      setCreating(false);
    }
  }

  async function onToggle(agent: AgentDto) {
    if (!session) return;
    if (agent.status === 'DISABLED') {
      setError('This boy is permanently disabled. Only platform admin can restore.');
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
      title="Boys"
      subtitle={hubName ? `${hubName} · manage delivery agents` : 'Manage delivery agents'}
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.summary} aria-label="Boy counts">
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
            <span style={styles.statLabel}>Disabled by admin</span>
          </div>
        ) : null}
      </div>

      <Card elevated style={styles.card}>
        <h3 style={styles.title}>Add boy</h3>
        <p style={styles.hint}>
          Creates login + hub link. You can activate/deactivate later. Permanent delete is only for platform
          admin.
        </p>
        <form style={styles.form} onSubmit={(e) => void onCreate(e)}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Raju Delivery"
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            autoComplete="tel"
            placeholder="9876500200"
          />
          <TextField
            label="Temp password (min 8 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Button type="submit" disabled={creating || !hubId}>
            {creating ? 'Creating…' : 'Create boy'}
          </Button>
        </form>
      </Card>

      <Card elevated style={styles.card}>
        <h3 style={styles.title}>Your boys</h3>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : agents.length === 0 ? (
          <p style={styles.muted}>No boys yet. Add the first one above.</p>
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
    </HubShell>
  );
}

const styles: Record<string, CSSProperties> = {
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '0.55rem',
    marginBottom: '0.85rem',
  },
  stat: {
    padding: '0.7rem 0.8rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.1rem',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    color: 'var(--text)',
  },
  statLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' },
  card: { padding: '1rem', display: 'grid', gap: '0.65rem', marginBottom: '0.85rem' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  form: { display: 'grid', gap: '0.65rem' },
  muted: { margin: 0, color: 'var(--text-muted)' },
  mutedSmall: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '0.7rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  rowMain: { display: 'grid', gap: '0.2rem', minWidth: 0 },
  rowActions: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  name: { fontSize: '0.95rem' },
  meta: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
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
