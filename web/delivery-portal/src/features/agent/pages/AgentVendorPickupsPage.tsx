import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { VendorPickupCard } from '../components/AssignmentCards';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { usePickupManifests } from '../hooks/usePickupManifests';
import { groupPickupsByOrder } from '../lib/assignmentSteps';

type PickupFilter = 'all' | 'at_shop' | 'to_hub';

export function AgentVendorPickupsPage() {
  const [filter, setFilter] = useState<PickupFilter>('all');
  const { pickupTasks, loading, actionId, error, notice, reload, setSearch, search, doPickVendor } =
    useAgentWorkspace({ scope: 'active', leg: 'PICKUP' });

  const filtered = useMemo(() => {
    if (filter === 'at_shop') return pickupTasks.filter((t) => t.status === 'ASSIGNED');
    if (filter === 'to_hub') return pickupTasks.filter((t) => t.status === 'IN_PROGRESS');
    return pickupTasks;
  }, [pickupTasks, filter]);

  const groups = useMemo(() => groupPickupsByOrder(filtered), [filtered]);
  const { manifests, failedIds, loadingManifests, retryManifest } = usePickupManifests(pickupTasks);

  const atShopCount = pickupTasks.filter((t) => t.status === 'ASSIGNED').length;
  const toHubCount = pickupTasks.filter((t) => t.status === 'IN_PROGRESS').length;

  return (
    <AgentShell title="From shop" subtitle="Take bag → bring to hub" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <div style={styles.howto}>
        <p style={styles.howtoLine}>1️⃣ Go to shop</p>
        <p style={styles.howtoLine}>2️⃣ Take bag</p>
        <p style={styles.howtoLine}>3️⃣ Bring to hub</p>
      </div>

      <div style={styles.filters}>
        <FilterChip active={filter === 'all'} label={`All ${pickupTasks.length}`} onClick={() => setFilter('all')} />
        <FilterChip
          active={filter === 'at_shop'}
          label={`At shop ${atShopCount}`}
          onClick={() => setFilter('at_shop')}
        />
        <FilterChip
          active={filter === 'to_hub'}
          label={`To hub ${toHubCount}`}
          onClick={() => setFilter('to_hub')}
        />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type order number…"
        style={styles.search}
      />

      {loading && groups.length === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : groups.length === 0 ? (
        <p style={styles.empty}>
          {filter === 'at_shop'
            ? 'No shop job now.'
            : filter === 'to_hub'
              ? 'No bag on the way to hub.'
              : 'No shop job. Wait for hub uncle.'}
        </p>
      ) : (
        <div style={styles.list}>
          {groups.map((group) => (
            <section key={group.orderId} style={styles.orderGroup}>
              <h2 style={styles.orderTitle}>Order {group.orderNumber}</h2>
              <p style={styles.orderMeta}>
                {group.subOrders.length} bag{group.subOrders.length === 1 ? '' : 's'} for you
              </p>
              <div style={styles.cards}>
                {group.subOrders.map((task) => (
                  <VendorPickupCard
                    key={task.id}
                    task={task}
                    busy={actionId === task.id}
                    manifest={manifests[task.id]}
                    manifestLoading={loadingManifests}
                    manifestFailed={Boolean(failedIds[task.id])}
                    onRetryManifest={() => retryManifest(task.id)}
                    onPickVendor={doPickVendor}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AgentShell>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" style={active ? styles.chipActive : styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  howto: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    padding: '0.85rem 1rem',
    borderRadius: 14,
    background: 'rgba(129, 199, 132, 0.12)',
    border: '2px solid rgba(129, 199, 132, 0.35)',
  },
  howtoLine: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  filters: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  chip: {
    border: '2px solid var(--border)',
    borderRadius: 999,
    padding: '0.55rem 0.9rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipActive: {
    border: '2px solid var(--success)',
    borderRadius: 999,
    padding: '0.55rem 0.9rem',
    background: 'rgba(129, 199, 132, 0.2)',
    color: 'var(--success)',
    fontSize: '0.9rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.75rem 0.9rem',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  list: { display: 'grid', gap: '1.1rem' },
  orderGroup: {
    border: '2px solid var(--border)',
    borderRadius: 16,
    padding: '1rem',
    background: 'var(--bg-elevated)',
  },
  orderTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 800 },
  orderMeta: { margin: '0.25rem 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 700 },
  cards: { display: 'grid', gap: '0.75rem' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  notice: { margin: 0, color: 'var(--success)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontWeight: 700 },
  empty: {
    margin: 0,
    padding: '1rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
};
