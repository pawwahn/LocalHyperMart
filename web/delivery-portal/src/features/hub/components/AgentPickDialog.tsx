import { useEffect, useState, type CSSProperties } from 'react';
import type { AgentDto } from '../api/hubApi';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  agents: AgentDto[];
  /** Prefill selection (last used / current). */
  preferredAgentId?: string | null;
  /** Hide this agent (e.g. current agent when reassigning). */
  excludeAgentId?: string | null;
  busy?: boolean;
  onConfirm: (agentId: string) => void;
  onClose: () => void;
};

export function AgentPickDialog({
  open,
  title,
  description,
  confirmLabel,
  agents,
  preferredAgentId,
  excludeAgentId,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const options = agents.filter(
    (a) => a.status === 'ACTIVE' && (!excludeAgentId || a.agentId !== excludeAgentId),
  );
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const preferred =
      preferredAgentId && options.some((a) => a.agentId === preferredAgentId)
        ? preferredAgentId
        : options[0]?.agentId ?? '';
    setSelectedId(preferred);
  }, [open, preferredAgentId, excludeAgentId, agents]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.description}>{description}</p>

        {options.length === 0 ? (
          <p style={styles.empty}>No delivery agents available right now.</p>
        ) : (
          <div style={styles.list} role="listbox" aria-label="Delivery agents">
            {options.map((agent) => {
              const selected = selectedId === agent.agentId;
              return (
                <button
                  key={agent.agentId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  style={selected ? styles.agentActive : styles.agent}
                  disabled={busy}
                  onClick={() => setSelectedId(agent.agentId)}
                >
                  <strong style={styles.agentName}>{agent.name}</strong>
                  <span style={styles.agentPhone}>{agent.phone}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={styles.confirmBtn}
            disabled={busy || !selectedId || options.length === 0}
            onClick={() => {
              if (selectedId) onConfirm(selectedId);
            }}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(12, 18, 24, 0.55)',
  },
  dialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.15rem',
    display: 'grid',
    gap: '0.85rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.2rem',
  },
  description: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  empty: {
    margin: 0,
    padding: '0.85rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
  list: { display: 'grid', gap: '0.5rem' },
  agent: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.15rem',
    padding: '0.85rem 1rem',
    borderRadius: 12,
    border: '2px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min)',
  },
  agentActive: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.15rem',
    padding: '0.85rem 1rem',
    borderRadius: 12,
    border: '2px solid var(--accent)',
    background: 'rgba(66, 165, 245, 0.12)',
    color: 'var(--text)',
    cursor: 'pointer',
    minHeight: 'var(--touch-min)',
  },
  agentName: { fontSize: '1.05rem', fontFamily: 'var(--font-display)' },
  agentPhone: { fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.55rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  cancelBtn: {
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.7rem 1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  confirmBtn: {
    border: 'none',
    borderRadius: 12,
    padding: '0.7rem 1.1rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent)',
    color: '#0c1218',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
