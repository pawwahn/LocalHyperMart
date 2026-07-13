import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PaginationBar } from '@/shared/components/PaginationBar';
import { AgentShell } from '../layout/AgentShell';
import { BuyerDeliveryCard, VendorPickupCard } from '../components/AssignmentCards';
import { useAgentWorkspace, type AgentLeg } from '../hooks/useAgentWorkspace';

type HistoryLeg = 'all' | AgentLeg;

export function AgentHistoryPage() {
  const [legFilter, setLegFilter] = useState<HistoryLeg>('all');
  const [page, setPage] = useState(0);

  const leg = legFilter === 'all' ? undefined : legFilter;
  const { assignments, loading, totalPages, totalElements, pageSize, error, reload, setSearch, search } =
    useAgentWorkspace({ scope: 'completed', leg, page });

  return (
    <AgentShell title="Done jobs" subtitle="Jobs you already finished" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.filters}>
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

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type order number…"
        style={styles.search}
      />

      {loading && assignments.length === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : assignments.length === 0 ? (
        <p style={styles.empty}>No finished jobs yet.</p>
      ) : (
        <div style={styles.list}>
          {assignments.map((task) =>
            task.legType === 'PICKUP' ? (
              <VendorPickupCard key={task.id} task={task} busy onPickVendor={() => undefined} />
            ) : (
              <BuyerDeliveryCard
                key={task.id}
                task={task}
                busy
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
    <button type="button" style={active ? styles.chipActive : styles.chip} onClick={onClick}>
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
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
    border: '2px solid var(--accent)',
    borderRadius: 999,
    padding: '0.55rem 0.9rem',
    background: 'rgba(66, 165, 245, 0.18)',
    color: 'var(--accent)',
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
  list: { display: 'grid', gap: '0.75rem' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
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
