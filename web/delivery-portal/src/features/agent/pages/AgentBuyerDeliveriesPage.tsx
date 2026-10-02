import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Banner, Card } from '@/shared/ui';
import { AgentShell } from '../layout/AgentShell';
import { BuyerDeliveryCard } from '../components/AssignmentCards';
import { ConfirmTookFromHubDialog } from '../components/ConfirmTookFromHubDialog';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { useDeliveryManifests } from '../hooks/useDeliveryManifests';
import { useAgentKind } from '../hooks/useAgentKind';

type DeliveryFilter = 'all' | 'at_hub' | 'en_route';

type TookHubPrompt = {
  id: string;
  status: string;
  orderNumber: string;
} | null;

export function AgentBuyerDeliveriesPage() {
  const { vendorShop } = useAgentKind();
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const [tookHubPrompt, setTookHubPrompt] = useState<TookHubPrompt>(null);
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
    doPickVendor,
    doDeliver,
  } = useAgentWorkspace({ scope: 'active', leg: 'LAST_MILE' });

  const filtered = useMemo(() => {
    if (filter === 'at_hub') return deliveryTasks.filter((t) => t.status === 'ASSIGNED');
    if (filter === 'en_route') return deliveryTasks.filter((t) => t.status === 'IN_PROGRESS');
    return deliveryTasks;
  }, [deliveryTasks, filter]);

  const { manifests, failedIds, loadingManifests, retryManifest } = useDeliveryManifests(filtered);

  const atHubCount = deliveryTasks.filter((t) => t.status === 'ASSIGNED').length;
  const enRouteCount = deliveryTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const promptBusy = Boolean(tookHubPrompt && actionId === tookHubPrompt.id);

  return (
    <AgentShell
      title={vendorShop ? 'Deliveries' : 'To home'}
      subtitle={
        vendorShop ? 'Shop → customer · OTP when delivered' : 'Hub → customer · OTP when delivered'
      }
      onRefresh={() => void reload()}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.segment} role="tablist" aria-label="Filter deliveries">
        <FilterChip active={filter === 'all'} label={`All ${deliveryTasks.length}`} onClick={() => setFilter('all')} />
        <FilterChip
          active={filter === 'at_hub'}
          label={`${vendorShop ? 'At shop' : 'At hub'} ${atHubCount}`}
          onClick={() => setFilter('at_hub')}
        />
        <FilterChip
          active={filter === 'en_route'}
          label={`Going ${enRouteCount}`}
          onClick={() => setFilter('en_route')}
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

      {loading && filtered.length === 0 ? (
        <Card style={styles.stateCard}>
          <p style={styles.emptyTitle}>Loading trips…</p>
          <p style={styles.emptyBody}>Fetching your home-delivery assignments.</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={styles.stateCard}>
          <p style={styles.emptyTitle}>No trips right now</p>
          <p style={styles.emptyBody}>
            {filter === 'at_hub'
              ? vendorShop
                ? 'Nothing waiting at the shop.'
                : 'Nothing waiting at hub.'
              : filter === 'en_route'
                ? 'No delivery on the way.'
                : vendorShop
                  ? 'Your shop will assign deliveries here when orders are ready.'
                  : 'When hub assigns a home delivery, it appears here. Check Home for open job counts.'}
          </p>
          <Link to="/agent" style={styles.homeLink}>
            Back to Home
          </Link>
        </Card>
      ) : (
        <div style={styles.list}>
          {filtered.map((task) => (
            <BuyerDeliveryCard
              key={task.id}
              task={task}
              busy={actionId === task.id}
              manifest={manifests[task.id]}
              manifestLoading={loadingManifests}
              manifestFailed={Boolean(failedIds[task.id])}
              onRetryManifest={() => retryManifest(task.id)}
              onPickHub={(id, status) => {
                if (task.legType === 'VENDOR_DIRECT') {
                  void doPickVendor(id, status);
                  return;
                }
                setTookHubPrompt({
                  id,
                  status,
                  orderNumber: task.orderNumber,
                });
              }}
              onPickVendor={doPickVendor}
              onDeliver={doDeliver}
            />
          ))}
        </div>
      )}

      <ConfirmTookFromHubDialog
        open={Boolean(tookHubPrompt)}
        orderNumber={tookHubPrompt?.orderNumber}
        busy={promptBusy}
        onClose={() => {
          if (!promptBusy) setTookHubPrompt(null);
        }}
        onConfirm={() => {
          if (!tookHubPrompt) return;
          const { id, status } = tookHubPrompt;
          void (async () => {
            await doPickHub(id, status);
            setTookHubPrompt(null);
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
  stateCard: {
    padding: '1.1rem 0.85rem',
    display: 'grid',
    gap: '0.4rem',
    textAlign: 'center',
    minHeight: 120,
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' },
  emptyBody: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.45 },
  homeLink: {
    marginTop: '0.35rem',
    fontWeight: 800,
    fontSize: '0.85rem',
    color: 'var(--accent)',
  },
};
