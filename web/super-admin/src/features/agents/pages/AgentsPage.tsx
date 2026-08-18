import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog } from '@/shared/ui';
import {
  listAllAgents,
  permanentlyDisableAgent,
  restoreAgent,
  type AdminAgentVm,
} from '../api/agentsApi';

export function AgentsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [agents, setAgents] = useState<AdminAgentVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ type: 'disable' | 'restore'; agent: AdminAgentVm } | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setAgents(await listAllAgents(token));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(
    () =>
      [...agents].sort((a, b) => {
        const hub = String(a.hubName ?? '').localeCompare(String(b.hubName ?? ''));
        if (hub !== 0) return hub;
        return a.name.localeCompare(b.name);
      }),
    [agents],
  );

  function requestDisable(agent: AdminAgentVm) {
    setPending({ type: 'disable', agent });
  }

  function requestRestore(agent: AdminAgentVm) {
    setPending({ type: 'restore', agent });
  }

  async function onConfirmPending() {
    if (!pending) return;
    const { type, agent } = pending;
    setBusyId(agent.agentId);
    setError(null);
    setNotice(null);
    try {
      if (type === 'disable') {
        await permanentlyDisableAgent(token, agent.agentId);
        setNotice(`${agent.name} permanently disabled.`);
      } else {
        await restoreAgent(token, agent.agentId);
        setNotice(`${agent.name} restored to ACTIVE.`);
      }
      setPending(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : type === 'disable' ? 'Disable failed' : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell title="Delivery agents" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.card}>
        <p style={styles.hint}>
          Hub admins create and pause boys. Only super admin can permanently disable (soft delete) or restore
          them.
        </p>
        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p style={styles.muted}>No delivery agents found.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Boy</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Hub</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.thRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent) => {
                  const busy = busyId === agent.agentId;
                  return (
                    <tr key={agent.agentId}>
                      <td style={styles.td}>
                        <strong>{agent.name}</strong>
                      </td>
                      <td style={styles.tdMuted}>{agent.phone}</td>
                      <td style={styles.tdMuted}>{agent.hubName || '—'}</td>
                      <td style={styles.td}>
                        <span
                          style={
                            agent.status === 'ACTIVE'
                              ? styles.on
                              : agent.status === 'INACTIVE'
                                ? styles.off
                                : styles.dead
                          }
                        >
                          {agent.status}
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        {agent.status === 'DISABLED' ? (
                          <Button size="sm" disabled={busy} onClick={() => requestRestore(agent)}>
                            {busy ? '…' : 'Restore'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => requestDisable(agent)}
                          >
                            {busy ? '…' : 'Disable permanently'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.type === 'restore' ? `Restore ${pending.agent.name}?` : `Disable ${pending?.agent.name}?`}
        description={
          pending?.type === 'restore'
            ? `“${pending.agent.name}” will be set back to ACTIVE and can take jobs again.`
            : `“${pending?.agent.name}” will be permanently disabled. Hub admin cannot undo this — only super admin can restore later.`
        }
        confirmLabel={pending?.type === 'restore' ? 'Restore' : 'Disable permanently'}
        cancelLabel="Cancel"
        danger={pending?.type !== 'restore'}
        busy={Boolean(busyId)}
        onConfirm={() => void onConfirmPending()}
        onClose={() => {
          if (!busyId) setPending(null);
        }}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '1rem', display: 'grid', gap: '0.75rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' },
  muted: { margin: 0, color: 'var(--text-muted)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: {
    textAlign: 'left',
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
  thRight: {
    textAlign: 'right',
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
  td: { padding: '0.55rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMuted: {
    padding: '0.55rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    verticalAlign: 'middle',
  },
  on: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
  off: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
  dead: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--danger)',
    background: 'var(--danger-soft)',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
};
