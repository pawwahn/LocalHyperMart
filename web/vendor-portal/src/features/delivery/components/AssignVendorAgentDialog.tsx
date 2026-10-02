import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Button } from '@/shared/ui';
import { fetchVendorDeliveryAgents, type VendorAgentDto } from '../api/deliveryAgentsApi';

type ShopScope = {
  token: string;
  vendorId: string;
  shopId: string;
  townId: string;
};

type Props = {
  open: boolean;
  subOrderLabel: string;
  scope: ShopScope | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (agentId: string) => void;
};

export function AssignVendorAgentDialog({
  open,
  subOrderLabel,
  scope,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const [agents, setAgents] = useState<VendorAgentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState('');

  const activeAgents = useMemo(
    () => agents.filter((a) => a.status === 'ACTIVE'),
    [agents],
  );

  useEffect(() => {
    if (!open || !scope) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAgentId('');
    void fetchVendorDeliveryAgents(scope)
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load agents');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope]);

  if (!open) return null;

  return (
    <div style={styles.backdrop} role="presentation" onClick={() => !busy && onClose()}>
      <div
        style={styles.panel}
        role="dialog"
        aria-labelledby="assign-agent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="assign-agent-title" style={styles.title}>
          Assign delivery agent
        </h2>
        <p style={styles.sub}>{subOrderLabel}</p>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {loading ? (
          <p style={styles.muted}>Loading agents…</p>
        ) : activeAgents.length === 0 ? (
          <p style={styles.muted}>
            No active agents.{' '}
            <Link to="/delivery-agents" onClick={onClose}>
              Add a delivery agent
            </Link>{' '}
            first.
          </p>
        ) : (
          <label style={styles.field}>
            Agent
            <select
              style={styles.select}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={busy}
            >
              <option value="">Choose…</option>
              {activeAgents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.name} · {a.phone}
                </option>
              ))}
            </select>
          </label>
        )}
        <div style={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !agentId || loading}
            onClick={() => onConfirm(agentId)}
          >
            {busy ? 'Assigning…' : 'Assign & notify buyer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  panel: {
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem 1.1rem',
    maxWidth: 400,
    width: '100%',
    display: 'grid',
    gap: '0.55rem',
  },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  sub: { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' },
  muted: { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' },
  field: { display: 'grid', gap: '0.25rem', fontSize: '0.82rem', fontWeight: 700 },
  select: {
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontWeight: 500,
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' },
};
