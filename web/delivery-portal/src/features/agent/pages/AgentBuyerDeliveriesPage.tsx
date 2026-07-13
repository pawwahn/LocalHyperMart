import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AgentShell } from '../layout/AgentShell';
import { BuyerDeliveryCard } from '../components/AssignmentCards';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';

type DeliveryFilter = 'all' | 'at_hub' | 'en_route';

export function AgentBuyerDeliveriesPage() {
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const {
    deliveryTasks,
    loading,
    actionId,
    error,
    notice,
    reload,
    setSearch,
    search,
    doPickHub,
    doDeliver,
  } = useAgentWorkspace({ scope: 'active', leg: 'LAST_MILE' });

  const filtered = useMemo(() => {
    if (filter === 'at_hub') return deliveryTasks.filter((t) => t.status === 'ASSIGNED');
    if (filter === 'en_route') return deliveryTasks.filter((t) => t.status === 'IN_PROGRESS');
    return deliveryTasks;
  }, [deliveryTasks, filter]);

  const atHubCount = deliveryTasks.filter((t) => t.status === 'ASSIGNED').length;
  const enRouteCount = deliveryTasks.filter((t) => t.status === 'IN_PROGRESS').length;

  return (
    <AgentShell title="To home" subtitle="Take from hub → give to customer" onRefresh={() => void reload()}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <div style={styles.howto}>
        <p style={styles.howtoLine}>1️⃣ Take order from hub</p>
        <p style={styles.howtoLine}>2️⃣ Go to customer home</p>
        <p style={styles.howtoLine}>3️⃣ Ask phone code · give bag</p>
      </div>

      <div style={styles.filters}>
        <FilterChip active={filter === 'all'} label={`All ${deliveryTasks.length}`} onClick={() => setFilter('all')} />
        <FilterChip
          active={filter === 'at_hub'}
          label={`At hub ${atHubCount}`}
          onClick={() => setFilter('at_hub')}
        />
        <FilterChip
          active={filter === 'en_route'}
          label={`Going home ${enRouteCount}`}
          onClick={() => setFilter('en_route')}
        />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type order number…"
        style={styles.search}
      />

      {loading && filtered.length === 0 ? (
        <p style={styles.muted}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={styles.empty}>
          {filter === 'at_hub'
            ? 'No order waiting at hub.'
            : filter === 'en_route'
              ? 'No delivery on the way.'
              : 'No home job. Wait for hub uncle.'}
        </p>
      ) : (
        <div style={styles.list}>
          {filtered.map((task) => (
            <BuyerDeliveryCard
              key={task.id}
              task={task}
              busy={actionId === task.id}
              onPickHub={doPickHub}
              onDeliver={doDeliver}
            />
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
    background: 'rgba(66, 165, 245, 0.12)',
    border: '2px solid rgba(66, 165, 245, 0.35)',
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
  list: { display: 'grid', gap: '0.85rem' },
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
