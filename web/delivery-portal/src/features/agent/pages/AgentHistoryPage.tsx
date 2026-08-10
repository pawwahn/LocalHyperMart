import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PaginationBar } from '@/shared/components/PaginationBar';
import { AgentShell } from '../layout/AgentShell';
import { BuyerDeliveryCard, VendorPickupCard } from '../components/AssignmentCards';
import { useAgentWorkspace, type AgentLeg } from '../hooks/useAgentWorkspace';
import { useDeliveryManifests } from '../hooks/useDeliveryManifests';
import { usePickupManifests } from '../hooks/usePickupManifests';

type HistoryLeg = 'all' | AgentLeg;

export function AgentHistoryPage() {
  const [legFilter, setLegFilter] = useState<HistoryLeg>('all');
  const [page, setPage] = useState(0);

  const leg = legFilter === 'all' ? undefined : legFilter;
  const { assignments, loading, totalPages, totalElements, pageSize, error, reload, setSearch, search } =
    useAgentWorkspace({ scope: 'completed', leg, page });

  const pickupTasks = useMemo(
    () => assignments.filter((t) => t.legType === 'PICKUP'),
    [assignments],
  );
  const deliveryTasks = useMemo(
    () => assignments.filter((t) => t.legType === 'LAST_MILE'),
    [assignments],
  );

  const pickup = usePickupManifests(pickupTasks);
  const delivery = useDeliveryManifests(deliveryTasks);

  return (
    <AgentShell title="Done jobs" subtitle="Jobs you already finished" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.segment} role="tablist" aria-label="Filter history">
        <FilterChip
          active={legFilter === 'all'}
          label="All"
          onClick={() => {
            setLegFilter('all');
            setPage(0);
          }}
        />
        <FilterChip
          active={legFilter === 'PICKUP'}
          label="From shop"
          onClick={() => {
            setLegFilter('PICKUP');
            setPage(0);
          }}
        />
        <FilterChip
          active={legFilter === 'LAST_MILE'}
          label="To home"
          onClick={() => {
            setLegFilter('LAST_MILE');
            setPage(0);
          }}
        />
      </div>

      <div style={styles.searchWrap}>
        <span style={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number"
          style={styles.search}
        />
      </div>

      {loading && assignments.length === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : assignments.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No finished jobs yet</p>
          <p style={styles.emptyBody}>Completed pickups and deliveries show up here.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {assignments.map((task) =>
            task.legType === 'PICKUP' ? (
              <VendorPickupCard
                key={task.id}
                task={task}
                busy
                manifest={pickup.manifests[task.id]}
                manifestLoading={pickup.loadingManifests}
                manifestFailed={Boolean(pickup.failedIds[task.id])}
                onRetryManifest={() => pickup.retryManifest(task.id)}
                onPickVendor={() => undefined}
              />
            ) : (
              <BuyerDeliveryCard
                key={task.id}
                task={task}
                busy
                manifest={delivery.manifests[task.id]}
                manifestLoading={delivery.loadingManifests}
                manifestFailed={Boolean(delivery.failedIds[task.id])}
                onRetryManifest={() => delivery.retryManifest(task.id)}
                onPickHub={() => undefined}
                onDeliver={() => undefined}
              />
            ),
          )}
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={pageSize}
        onPageChange={setPage}
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
    <button type="button" role="tab" aria-selected={active} style={active ? styles.chipActive : styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  segment: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  chip: {
    border: 'none',
    borderRadius: 9,
    padding: '0.55rem 0.35rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
  },
  chipActive: {
    border: 'none',
    borderRadius: 9,
    padding: '0.55rem 0.35rem',
    background: 'var(--bg-elevated)',
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 40,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    pointerEvents: 'none',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.65rem 0.75rem 0.65rem 2.1rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  list: { display: 'grid', gap: '0.7rem' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' },
  empty: {
    padding: '1.25rem 1rem',
    borderRadius: 14,
    background: 'var(--bg-muted)',
    border: '1px dashed var(--border)',
    textAlign: 'center',
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  emptyBody: { margin: '0.35rem 0 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem' },
};
