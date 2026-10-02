import { useMemo, useState, type CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { CodCustodianReceivables } from '../api/codApi';

type Props = {
  data: CodCustodianReceivables | null;
  loading?: boolean;
  custodianLabel: string;
  emptyHint?: string;
};

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function formatDelivered(at?: string | null): string {
  if (!at) return '';
  try {
    return new Date(at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function CodReceivablesPanel({ data, loading, custodianLabel, emptyHint }: Props) {
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  const hasWork = useMemo(() => {
    if (!data) return false;
    return (
      (data.ordersStillWithAgents ?? 0) > 0 ||
      (data.handoversAwaitingConfirm ?? 0) > 0
    );
  }, [data]);

  if (loading) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>Cash to receive from agents</p>
        <p style={styles.muted}>Loading receivables…</p>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card style={styles.card}>
      <p style={styles.title}>Cash to receive from agents</p>
      <p style={styles.lead}>
        COD delivered on <strong>{data.date}</strong> (IST) for {custodianLabel}. Collect full buyer payable per
        order — not bag subtotal alone. Agents should declare handover in the delivery app; you confirm below.
      </p>

      <div style={styles.heroRow}>
        <div style={styles.heroBox}>
          <p style={styles.heroLabel}>Still with agents</p>
          <p style={styles.heroAmount}>{money(data.totalStillWithAgents)}</p>
          <p style={styles.heroMeta}>{data.ordersStillWithAgents} order(s) · not declared yet</p>
        </div>
        <div style={{ ...styles.heroBox, ...styles.heroAwaiting }}>
          <p style={styles.heroLabel}>Declared — confirm receipt</p>
          <p style={styles.heroAmount}>{money(data.totalDeclaredAwaitingConfirm)}</p>
          <p style={styles.heroMeta}>{data.handoversAwaitingConfirm} handover(s) waiting on you</p>
        </div>
      </div>

      {!hasWork ? (
        <p style={styles.muted}>
          {emptyHint ??
            'No COD receivables for this date — nothing delivered or all remitted.'}
        </p>
      ) : (
        <ul style={styles.agentList}>
          {data.agents.map((agent) => {
            const open = openAgent === agent.agentId;
            const hasStill = (agent.stillWithAgentOrderCount ?? 0) > 0;
            const hasDecl = (agent.declaredAwaitingOrderCount ?? 0) > 0;
            return (
              <li key={agent.agentId} style={styles.agentItem}>
                <button
                  type="button"
                  style={styles.agentHead}
                  onClick={() => setOpenAgent(open ? null : agent.agentId)}
                >
                  <span>
                    <strong>{agent.agentName || 'Agent'}</strong>
                    <span style={styles.muted}>
                      {hasStill ? ` · ${money(agent.stillWithAgentAmount)} with agent (${agent.stillWithAgentOrderCount} orders)` : ''}
                      {hasDecl
                        ? ` · ${money(agent.declaredAwaitingAmount)} declared (${agent.declaredAwaitingOrderCount} orders)`
                        : ''}
                    </span>
                  </span>
                  <span aria-hidden>{open ? '▾' : '▸'}</span>
                </button>
                {open ? (
                  <div style={styles.agentBody}>
                    {hasStill ? (
                      <>
                        <p style={styles.subTitle}>With agent (collect from them)</p>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Order</th>
                              <th style={styles.thRight}>Collect</th>
                              <th style={styles.thRight}>Delivered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.stillWithAgentOrders.map((o) => (
                              <tr key={o.orderId}>
                                <td style={styles.td}>{o.orderNumber}</td>
                                <td style={styles.tdRight}>{money(o.collectAmount)}</td>
                                <td style={styles.tdRightMuted}>{formatDelivered(o.deliveredAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}
                    {hasDecl ? (
                      <>
                        <p style={styles.subTitle}>Agent declared — confirm in section below</p>
                        {agent.declaredAwaitingConfirm.map((h) => (
                          <ul key={h.handoverId} style={styles.miniList}>
                            {h.lines.map((line) => (
                              <li key={line.orderId}>
                                {line.orderNumber} · {money(line.collectAmount)}
                              </li>
                            ))}
                          </ul>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.65rem 0.75rem', display: 'grid', gap: '0.5rem' },
  title: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  lead: { margin: 0, fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-muted)', fontWeight: 650 },
  muted: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 650 },
  heroRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' },
  heroBox: {
    padding: '0.5rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    background: '#fffbeb',
    border: '1px solid #fbbf24',
  },
  heroAwaiting: { background: '#ecfdf5', borderColor: '#34d399' },
  heroLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#92400e' },
  heroAmount: { margin: '0.1rem 0', fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  heroMeta: { margin: 0, fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-muted)' },
  agentList: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  agentItem: { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  agentHead: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.55rem',
    border: 'none',
    background: 'var(--bg-elevated)',
    textAlign: 'left',
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  agentBody: { padding: '0.45rem 0.55rem', display: 'grid', gap: '0.4rem', fontSize: '0.8rem' },
  subTitle: { margin: 0, fontWeight: 800, fontSize: '0.78rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', fontWeight: 700, padding: '0.2rem 0', borderBottom: '1px solid var(--border)' },
  thRight: { textAlign: 'right', fontWeight: 700, padding: '0.2rem 0', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.25rem 0', verticalAlign: 'top' },
  tdRight: { padding: '0.25rem 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  tdRightMuted: { padding: '0.25rem 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.72rem' },
  miniList: { margin: '0.15rem 0 0', paddingLeft: '1rem', color: 'var(--text-muted)' },
};
