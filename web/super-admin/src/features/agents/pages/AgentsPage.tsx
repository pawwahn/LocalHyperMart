import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listHubs, type AdminHubVm } from '@/features/hubs/api/hubsApi';
import { AgentDetailDialog } from '../components/AgentDetailDialog';
import {
  listAllAgents,
  permanentlyDisableAgent,
  restoreAgent,
  type AdminAgentVm,
} from '../api/agentsApi';

const PAGE_SIZE = 25;

function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

function hubTownName(hubName?: string | null): string {
  return (hubName || '').replace(/\s+hub$/i, '').trim();
}

function townsFromNetwork(agents: AdminAgentVm[], hubs: AdminHubVm[]): TownVm[] {
  const byId = new Map<string, TownVm>();
  for (const hub of hubs) {
    if (!hub.townId || byId.has(hub.townId)) continue;
    byId.set(hub.townId, {
      id: hub.townId,
      displayName: hubTownName(hub.name) || hub.name,
      townCode: '',
      stateCode: '',
      status: 'ENABLED',
      acceptingOrders: true,
    });
  }
  for (const agent of agents) {
    const id = agent.townId;
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      displayName: hubTownName(agent.hubName) || 'Town',
      townCode: '',
      stateCode: '',
      status: 'ENABLED',
      acceptingOrders: true,
    });
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function AgentsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [agents, setAgents] = useState<AdminAgentVm[]>([]);
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [hubTownByHubId, setHubTownByHubId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [townsLoading, setTownsLoading] = useState(true);
  const [pageView, setPageView] = useState<'agents' | 'history'>('agents');
  const [townId, setTownId] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [historyTick, setHistoryTick] = useState(0);
  const [openAgent, setOpenAgent] = useState<AdminAgentVm | null>(null);
  const [pending, setPending] = useState<{ type: 'disable' | 'restore'; agent: AdminAgentVm } | null>(null);
  const hasAgentsRef = useRef(false);

  const townById = useMemo(() => {
    const map = new Map<string, TownVm>();
    for (const t of towns) map.set(t.id, t);
    return map;
  }, [towns]);

  function agentTownId(agent: AdminAgentVm): string | undefined {
    return agent.townId || (agent.hubId ? hubTownByHubId[agent.hubId] : undefined);
  }

  const filtered = useMemo(() => {
    return agents
      .filter((a) => !townId || agentTownId(a) === townId)
      .filter((a) =>
        matchesQuery(
          [a.name, a.phone, a.hubName, a.status, townById.get(agentTownId(a) ?? '')?.displayName]
            .filter(Boolean)
            .join(' '),
          query,
        ),
      )
      .sort((a, b) => {
        const town = String(townById.get(agentTownId(a) ?? '')?.displayName ?? '').localeCompare(
          String(townById.get(agentTownId(b) ?? '')?.displayName ?? ''),
        );
        if (town !== 0) return town;
        return a.name.localeCompare(b.name);
      });
  }, [agents, townId, query, townById, hubTownByHubId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [query, townId]);

  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setTownsLoading(false);
      return;
    }
    if (!hasAgentsRef.current) setLoading(true);
    setError(null);
    try {
      const safeAgents = await listAllAgents(token).then((list) => (Array.isArray(list) ? list : []));
      hasAgentsRef.current = true;
      setAgents(safeAgents);
      setLoading(false);
      setOpenAgent((prev) => {
        if (!prev) return null;
        const next = safeAgents.find((a) => a.agentId === prev.agentId);
        return next && next.status !== prev.status ? next : prev;
      });

      const derived = townsFromNetwork(safeAgents, []);
      if (derived.length > 0) {
        setTowns((prev) => (prev.length > 0 ? prev : derived));
        setTownsLoading(false);
      }

      const hubList = await listHubs(token).catch(() => [] as AdminHubVm[]);
      setHubTownByHubId(Object.fromEntries(hubList.map((h) => [h.hubId, h.townId])));
      const fromHubs = townsFromNetwork(safeAgents, hubList);
      setTowns((prev) => (prev.some((t) => t.townCode) ? prev : fromHubs.length ? fromHubs : prev));
      if (fromHubs.length > 0) setTownsLoading(false);

      const official = await listTowns(token).catch(() => [] as TownVm[]);
      if (official.length > 0) setTowns(official);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
      setTownsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
      setHistoryTick((n) => n + 1);
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : type === 'disable'
            ? 'Disable failed'
            : 'Restore failed',
      );
    } finally {
      setBusyId(null);
    }
  }

  const from = filtered.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const to = Math.min(pageSafe * PAGE_SIZE, filtered.length);
  const historyTown = townById.get(townId);

  return (
    <PortalShell
      title="Delivery agents"
      onRefresh={() => {
        setHistoryTick((n) => n + 1);
        void reload();
      }}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card elevated style={styles.toolbar}>
        <div style={styles.toolbarRow}>
          <div>
            <p style={styles.eyebrow}>Operations</p>
            <p style={styles.summary}>
              <strong>{filtered.length}</strong> agents
              {townId ? ` in ${historyTown?.displayName ?? 'town'}` : ` · ${agents.length} all towns`}
            </p>
          </div>
          <div style={styles.toolbarActions}>
            <div style={styles.viewTabs} role="tablist" aria-label="Agents or history">
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'agents'}
                style={pageView === 'agents' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPageView('agents')}
              >
                Agents
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pageView === 'history'}
                style={pageView === 'history' ? styles.viewTabActive : styles.viewTab}
                onClick={() => {
                  setPageView('history');
                  setHistoryTick((n) => n + 1);
                }}
              >
                History
              </button>
            </div>
            <label style={styles.townSearch}>
              <select
                style={styles.townSelect}
                value={townId}
                disabled={townsLoading && towns.length === 0}
                aria-label="Filter by town"
                onChange={(e) => setTownId(e.target.value)}
              >
                <option value="">{towns.length === 0 && townsLoading ? 'Loading towns…' : 'All towns'}</option>
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                    {t.status !== 'ENABLED' ? ' · DISABLED' : ''}
                  </option>
                ))}
              </select>
            </label>
            {pageView === 'agents' ? (
              <input
                style={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search boy / phone…"
                aria-label="Search agents"
              />
            ) : null}
          </div>
        </div>
      </Card>

      {pageView === 'agents' ? (
        <Card style={styles.listCard}>
          <style>{`.agent-row:hover{background:color-mix(in srgb,var(--accent) 7%,transparent)}`}</style>
          <p style={styles.hint}>
            Filter by town if you want. Click a boy for deliveries, ratings, and change log.
          </p>
          {loading && agents.length === 0 ? (
            <p style={styles.muted}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={styles.muted}>
              {townId ? 'No delivery boys in this town match.' : 'No delivery agents found.'}
            </p>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Boy</th>
                      <th style={styles.th}>Phone</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Hub / shop</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((agent) => (
                      <tr
                        key={agent.agentId}
                        className="agent-row"
                        style={styles.row}
                        tabIndex={0}
                        onClick={() => setOpenAgent(agent)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenAgent(agent);
                          }
                        }}
                      >
                        <td style={styles.td}>
                          <strong>{agent.name}</strong>
                        </td>
                        <td style={styles.tdMuted}>{agent.phone}</td>
                        <td style={styles.td}>
                          {agent.agentType === 'VENDOR' ? (
                            <span style={styles.vendorTag}>Vendor shop</span>
                          ) : (
                            <span style={styles.hubTag}>Hub network</span>
                          )}
                        </td>
                        <td style={styles.tdMuted}>
                          {agent.agentType === 'VENDOR' ? 'Shop agent' : agent.hubName || '—'}
                        </td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={styles.pager}>
                <span style={styles.pageMeta}>
                  {from}–{to} of {filtered.length.toLocaleString('en-IN')}
                </span>
                <Button size="sm" variant="ghost" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : token ? (
        <AdminHistoryPanel
          token={token}
          screen="agents"
          title={historyTown ? `${historyTown.displayName} agent history` : 'Agent history'}
          townId={townId || undefined}
          requireTown={!townId}
          emptyHint="Search a town above to see disable / restore history."
          refreshTick={historyTick}
          tall
        />
      ) : null}

      {openAgent && token ? (
        <AgentDetailDialog
          agent={{ ...openAgent, townId: agentTownId(openAgent) ?? openAgent.townId }}
          townLabel={
            townById.get(agentTownId(openAgent) ?? '')?.displayName
            || hubTownName(openAgent.hubName)
            || 'Town'
          }
          token={token}
          busy={busyId === openAgent.agentId}
          onClose={() => setOpenAgent(null)}
          onDisable={() => requestDisable(openAgent)}
          onRestore={() => requestRestore(openAgent)}
        />
      ) : null}

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
  toolbar: {
    display: 'grid',
    gap: '0.55rem',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elevated)), var(--bg-elevated))',
  },
  toolbarRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'end',
    justifyContent: 'space-between',
  },
  toolbarActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    flex: '1 1 260px',
    justifyContent: 'flex-end',
  },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  summary: { margin: '0.2rem 0 0', color: 'var(--text)', fontSize: '0.95rem' },
  townSearch: { minWidth: 200, flex: '1 1 200px', maxWidth: 280 },
  townSelect: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.55rem 0.7rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 650,
    fontSize: '0.88rem',
  },
  search: {
    flex: '1 1 140px',
    minWidth: 0,
    maxWidth: 220,
    boxSizing: 'border-box',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  listCard: { display: 'grid', gap: '0.55rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4 },
  muted: { margin: 0, color: 'var(--text-muted)' },
  tableWrap: {
    overflow: 'auto',
    maxHeight: 'min(62vh, 560px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted, var(--bg))',
    zIndex: 1,
  },
  row: { cursor: 'pointer' },
  td: { padding: '0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMuted: {
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  pager: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.4rem',
  },
  pageMeta: { marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 650 },
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
  vendorTag: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#5B21B6',
    background: 'color-mix(in srgb, #7C3AED 14%, transparent)',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
  hubTag: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#1D4ED8',
    background: 'color-mix(in srgb, #2563EB 12%, transparent)',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
};
