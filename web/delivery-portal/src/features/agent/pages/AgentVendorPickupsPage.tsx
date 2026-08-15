import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { VendorPickupCard } from '../components/AssignmentCards';
import { ConfirmTookBagDialog } from '../components/ConfirmTookBagDialog';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { usePickupManifests } from '../hooks/usePickupManifests';
import { groupPickupsByOrder } from '../lib/assignmentSteps';

type PickupFilter = 'all' | 'at_shop' | 'to_hub';

type TookBagPrompt = {
  id: string;
  status: string;
  shopName: string;
  orderNumber: string;
} | null;

export function AgentVendorPickupsPage() {
  const [filter, setFilter] = useState<PickupFilter>('all');
  const [tookPrompt, setTookPrompt] = useState<TookBagPrompt>(null);
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
  const promptBusy = Boolean(tookPrompt && actionId === tookPrompt.id);

  return (
    <AgentShell title="From shop" subtitle="Take bag → bring to hub" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

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
                    onPickVendor={(id, status) => {
                      const shopName = manifests[id]?.shopName?.trim() || 'Shop';
                      setTookPrompt({
                        id,
                        status,
                        shopName,
                        orderNumber: task.orderNumber,
                      });
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmTookBagDialog
        open={Boolean(tookPrompt)}
        shopName={tookPrompt?.shopName ?? 'Shop'}
        orderNumber={tookPrompt?.orderNumber}
        busy={promptBusy}
        onClose={() => {
          if (!promptBusy) setTookPrompt(null);
        }}
        onConfirm={() => {
          if (!tookPrompt) return;
          const { id, status } = tookPrompt;
          void (async () => {
            await doPickVendor(id, status);
            setTookPrompt(null);
          })();
        }}
      />
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
  filters: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  chip: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.4rem 0.7rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipActive: {
    border: '1px solid var(--success)',
    borderRadius: 999,
    padding: '0.4rem 0.7rem',
    background: 'rgba(129, 199, 132, 0.2)',
    color: 'var(--success)',
    fontSize: '0.82rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '0.95rem',
  },
  list: { display: 'grid', gap: '0.75rem' },
  orderGroup: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.75rem',
    background: 'var(--bg-elevated)',
  },
  orderTitle: { margin: 0, fontSize: '0.98rem', fontWeight: 800 },
  orderMeta: { margin: '0.15rem 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 },
  cards: { display: 'grid', gap: '0.55rem' },
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
