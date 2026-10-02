import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { CodCustodianReceivables } from '../api/codHandoverApi';
import { codMoney, formatCodDate, formatDeliveredIst } from '../lib/codFormat';

type Props = {
  data: CodCustodianReceivables | null;
  loading?: boolean;
  custodianLabel: string;
};

export function CodReceivablesPanel({ data, loading, custodianLabel }: Props) {
  const [openAgent, setOpenAgent] = useState<string | null>(null);

  const hasWork = useMemo(() => {
    if (!data) return false;
    return (data.ordersStillWithAgents ?? 0) > 0 || (data.handoversAwaitingConfirm ?? 0) > 0;
  }, [data]);

  const agentsWithWork = useMemo(() => {
    if (!data?.agents?.length) return [];
    return data.agents.filter(
      (a) => (a.stillWithAgentOrderCount ?? 0) > 0 || (a.declaredAwaitingOrderCount ?? 0) > 0,
    );
  }, [data]);

  useEffect(() => {
    if (agentsWithWork.length === 1) {
      setOpenAgent(agentsWithWork[0].agentId);
    }
  }, [agentsWithWork]);

  if (loading) {
    return (
      <Card elevated padding="sm" style={styles.shell}>
        <p style={styles.loading}>Loading day summary…</p>
      </Card>
    );
  }

  if (!data) return null;

  const collect = Number(data.totalStillWithAgents ?? 0);
  const declared = Number(data.totalDeclaredAwaitingConfirm ?? 0);
  const multiAgent = agentsWithWork.length > 1;

  return (
    <Card elevated padding="sm" style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerText}>
          <h2 style={styles.title}>Shop agent COD</h2>
          <p style={styles.subtitle}>
            {formatCodDate(data.date)} · {custodianLabel}
          </p>
        </div>
        <span style={styles.dateBadge}>{data.date}</span>
      </header>

      <div style={styles.stats}>
        <Metric
          label="With agents"
          value={codMoney(collect, true)}
          hint={
            data.ordersStillWithAgents > 0
              ? `${data.ordersStillWithAgents} order${data.ordersStillWithAgents === 1 ? '' : 's'} to collect`
              : 'Nothing out with agents'
          }
          tone="collect"
          hot={collect > 0}
        />
        <Metric
          label="Declared"
          value={codMoney(declared, true)}
          hint={
            data.handoversAwaitingConfirm > 0
              ? `${data.handoversAwaitingConfirm} handover${data.handoversAwaitingConfirm === 1 ? '' : 's'} to confirm`
              : 'No declarations waiting'
          }
          tone="declared"
          hot={declared > 0}
        />
      </div>

      {!hasWork ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>All clear for this day</p>
          <p style={styles.emptyHint}>No COD delivered, or every order is declared and confirmed.</p>
        </div>
      ) : multiAgent ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Agent</th>
                <th style={styles.thNum}>Collect</th>
                <th style={styles.thNum}>Declared</th>
              </tr>
            </thead>
            <tbody>
              {agentsWithWork.map((agent) => (
                <tr key={agent.agentId}>
                  <td style={styles.tdAgent}>{agent.agentName?.trim() || 'Agent'}</td>
                  <td style={styles.tdNumCollect}>
                    {Number(agent.stillWithAgentAmount) > 0 ? codMoney(agent.stillWithAgentAmount, true) : '—'}
                  </td>
                  <td style={styles.tdNumDeclared}>
                    {Number(agent.declaredAwaitingAmount) > 0 ? codMoney(agent.declaredAwaitingAmount, true) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {agentsWithWork.length > 0 ? (
        <div style={styles.agentStack}>
          {multiAgent ? <p style={styles.sectionLabel}>Orders by agent</p> : null}
          {agentsWithWork.map((agent) => {
            const open = openAgent === agent.agentId;
            const hasStill = (agent.stillWithAgentOrderCount ?? 0) > 0;
            const hasDecl = (agent.declaredAwaitingOrderCount ?? 0) > 0;
            const collapsible = multiAgent;

            return (
              <article key={agent.agentId} style={styles.agentCard}>
                {collapsible ? (
                  <button
                    type="button"
                    style={styles.agentToggle}
                    aria-expanded={open}
                    onClick={() => setOpenAgent(open ? null : agent.agentId)}
                  >
                    <span style={styles.agentToggleMain}>
                      <span style={styles.agentName}>{agent.agentName || 'Agent'}</span>
                      <span style={styles.agentBadges}>
                        {hasStill ? (
                          <span style={styles.badgeCollect}>{codMoney(agent.stillWithAgentAmount, true)} out</span>
                        ) : null}
                        {hasDecl ? (
                          <span style={styles.badgeDeclared}>{codMoney(agent.declaredAwaitingAmount, true)} declared</span>
                        ) : null}
                      </span>
                    </span>
                    <span style={styles.chevron} aria-hidden>
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                ) : (
                  <div style={styles.agentToggleStatic}>
                    <span style={styles.agentName}>{agent.agentName || 'Agent'}</span>
                    {hasStill ? (
                      <span style={styles.badgeCollect}>{codMoney(agent.stillWithAgentAmount, true)} to collect</span>
                    ) : null}
                  </div>
                )}

                {(!collapsible || open) && (hasStill || hasDecl) ? (
                  <div style={styles.agentBody}>
                    {hasStill ? (
                      <div style={styles.orderBlock}>
                        <p style={styles.blockLabel}>Collect from agent</p>
                        <table style={styles.orderTable}>
                          <thead>
                            <tr>
                              <th style={styles.thSm}>Order</th>
                              <th style={styles.thSmNum}>Amount</th>
                              <th style={styles.thSmNum}>Delivered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.stillWithAgentOrders.map((o) => (
                              <tr key={o.orderId}>
                                <td style={styles.orderId}>{o.orderNumber}</td>
                                <td style={styles.orderAmt}>{codMoney(o.collectAmount, true)}</td>
                                <td style={styles.orderTime}>{formatDeliveredIst(o.deliveredAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {hasDecl ? (
                      <div style={styles.orderBlock}>
                        <p style={styles.blockLabel}>Confirm declaration</p>
                        {agent.declaredAwaitingConfirm.map((h) => (
                          <ul key={h.handoverId} style={styles.declList}>
                            {h.lines.map((line) => (
                              <li key={line.orderId}>
                                <span style={styles.orderId}>{line.orderNumber}</span>
                                <span style={styles.orderAmtInline}>{codMoney(line.collectAmount, true)}</span>
                              </li>
                            ))}
                          </ul>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  hot,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'collect' | 'declared';
  hot?: boolean;
}) {
  const toneStyle = tone === 'collect' ? styles.metricCollect : styles.metricDeclared;
  return (
    <div style={{ ...styles.metric, ...(hot ? toneStyle : styles.metricNeutral) }}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
      <p style={styles.metricHint}>{hint}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  loading: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  headerText: { display: 'grid', gap: '0.12rem', minWidth: 0 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  subtitle: { margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  dateBadge: {
    fontSize: '0.68rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.45rem',
  },
  metric: {
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    display: 'grid',
    gap: '0.08rem',
  },
  metricNeutral: { background: 'var(--bg)' },
  metricCollect: {
    background: 'color-mix(in srgb, #ea580c 8%, var(--bg-elevated))',
    borderColor: 'color-mix(in srgb, #ea580c 28%, var(--border))',
  },
  metricDeclared: {
    background: 'color-mix(in srgb, #059669 8%, var(--bg-elevated))',
    borderColor: 'color-mix(in srgb, #059669 28%, var(--border))',
  },
  metricLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  metricValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.45rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  metricHint: { margin: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' },
  empty: {
    padding: '0.85rem 0.65rem',
    textAlign: 'center',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border)',
    background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '0.92rem' },
  emptyHint: { margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  tableWrap: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', fontWeight: 700, padding: '0.35rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' },
  thNum: { textAlign: 'right', fontWeight: 700, padding: '0.35rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' },
  tdAgent: { padding: '0.4rem 0', fontWeight: 700 },
  tdNumCollect: { padding: '0.4rem 0', textAlign: 'right', fontWeight: 800, color: '#c2410c', fontVariantNumeric: 'tabular-nums' },
  tdNumDeclared: { padding: '0.4rem 0', textAlign: 'right', fontWeight: 800, color: '#047857', fontVariantNumeric: 'tabular-nums' },
  sectionLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' },
  agentStack: { display: 'grid', gap: '0.4rem' },
  agentCard: {
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  agentToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.5rem 0.6rem',
    border: 'none',
    background: 'color-mix(in srgb, var(--bg-elevated) 90%, var(--bg))',
    cursor: 'pointer',
    textAlign: 'left',
  },
  agentToggleStatic: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.5rem',
    padding: '0.5rem 0.6rem',
    background: 'color-mix(in srgb, var(--bg-elevated) 90%, var(--bg))',
  },
  agentToggleMain: { display: 'grid', gap: '0.2rem', minWidth: 0 },
  agentName: { fontWeight: 800, fontSize: '0.85rem' },
  agentBadges: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  badgeCollect: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.12rem 0.4rem',
    borderRadius: 'var(--radius-full)',
    background: 'color-mix(in srgb, #ea580c 12%, transparent)',
    color: '#c2410c',
    fontVariantNumeric: 'tabular-nums',
  },
  badgeDeclared: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.12rem 0.4rem',
    borderRadius: 'var(--radius-full)',
    background: 'color-mix(in srgb, #059669 12%, transparent)',
    color: '#047857',
    fontVariantNumeric: 'tabular-nums',
  },
  chevron: { color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 },
  agentBody: { padding: '0.45rem 0.6rem 0.55rem', display: 'grid', gap: '0.45rem', borderTop: '1px solid var(--border)' },
  orderBlock: { display: 'grid', gap: '0.25rem' },
  blockLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' },
  orderTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' },
  thSm: { textAlign: 'left', fontWeight: 650, padding: '0.2rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.68rem' },
  thSmNum: { textAlign: 'right', fontWeight: 650, padding: '0.2rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.68rem' },
  orderId: { padding: '0.28rem 0', fontWeight: 700 },
  orderAmt: { padding: '0.28rem 0', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  orderAmtInline: { marginLeft: '0.35rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  orderTime: { padding: '0.28rem 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  declList: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.2rem', fontSize: '0.78rem' },
};
