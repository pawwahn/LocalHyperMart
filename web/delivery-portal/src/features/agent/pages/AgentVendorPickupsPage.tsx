import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { AgentShell } from '../layout/AgentShell';
import { useAgentKind } from '../hooks/useAgentKind';
import { VendorPickupCard } from '../components/AssignmentCards';
import { ConfirmTookBagDialog } from '../components/ConfirmTookBagDialog';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { usePickupManifests } from '../hooks/usePickupManifests';
import { groupPickupsByOrder } from '../lib/assignmentSteps';
import { useSingleExpandedCard } from '../hooks/useSingleExpandedCard';
import { agentAssignmentList, agentAssignmentRail } from '../layout/agentAssignmentRail';
import {
  agentTripChip,
  agentTripChipActive,
  agentTripSearch,
  agentTripSearchIcon,
  agentTripSearchWrap,
  agentTripSegment,
} from '../layout/agentTripFilterStyles';

type PickupFilter = 'all' | 'at_shop' | 'to_hub';

type TookBagPrompt = {
  id: string;
  status: string;
  shopName: string;
  orderNumber: string;
} | null;

export function AgentVendorPickupsPage() {
  const { vendorShop, ready } = useAgentKind();
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
  const flatTasks = useMemo(() => groups.flatMap((g) => g.subOrders), [groups]);
  const [expandedId, setExpandedId] = useSingleExpandedCard(flatTasks, 'IN_PROGRESS');
  const { manifests, failedIds, loadingManifests, retryManifest } = usePickupManifests(pickupTasks);

  const atShopCount = pickupTasks.filter((t) => t.status === 'ASSIGNED').length;
  const toHubCount = pickupTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const promptBusy = Boolean(tookPrompt && actionId === tookPrompt.id);

  if (ready && vendorShop) {
    return <Navigate to="/agent/deliveries" replace />;
  }

  return (
    <AgentShell title="From shop" subtitle="Take bag → bring to hub" onRefresh={() => void reload()}>
      <div style={agentAssignmentRail}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <div style={agentTripSegment} role="tablist" aria-label="Filter pickups">
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

      <div style={agentTripSearchWrap}>
        <span style={agentTripSearchIcon} aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number"
          className="agent-trip-search"
          style={agentTripSearch}
        />
      </div>

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
                    expanded={expandedId === task.id}
                    onRequestExpand={() => setExpandedId(task.id)}
                    onRequestCollapse={() => setExpandedId(null)}
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
      </div>

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
    <button
      type="button"
      role="tab"
      aria-selected={active}
      style={active ? agentTripChipActive : agentTripChip}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  list: agentAssignmentList,
  orderGroup: {
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    borderRadius: 14,
    padding: '0.65rem 0.7rem',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-soft)',
  },
  orderTitle: { margin: 0, fontSize: '0.98rem', fontWeight: 800 },
  orderMeta: { margin: '0.15rem 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 },
  cards: agentAssignmentList,
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
