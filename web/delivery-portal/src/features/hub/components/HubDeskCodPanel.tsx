import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { CodCustodianOutstanding, CodHubLedger } from '../api/codApi';
import { codMoney } from '../lib/codFormat';

type Props = {
  data: CodCustodianOutstanding | null;
  ledger?: CodHubLedger | null;
  loading?: boolean;
  error?: string | null;
};

export function HubDeskCodPanel({ data, ledger, loading, error }: Props) {
  if (loading && !data) {
    return (
      <section style={styles.wrap} aria-label="COD with agents" aria-busy="true">
        <p style={styles.muted}>Loading COD with agents…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section style={{ ...styles.wrap, ...styles.wrapError }} aria-label="COD with agents" role="alert">
        <p style={styles.muted}>COD totals unavailable — {error}</p>
      </section>
    );
  }

  if (!data && !ledger) return null;

  const withAgents = Number(data?.totalStillWithAgents ?? 0);
  const declared = Number(data?.totalDeclaredAwaitingConfirm ?? 0);
  const total = withAgents + declared;
  const ordersWithAgent = Number(data?.ordersStillWithAgents ?? 0);
  const handoversWaiting = Number(data?.handoversAwaitingConfirm ?? 0);

  const agentLines = (data?.agents ?? [])
    .map((a) => ({
      name: a.agentName?.trim() || 'Agent',
      amount: Number(a.stillWithAgentAmount ?? 0) + Number(a.declaredAwaitingAmount ?? 0),
      orders:
        Number(a.stillWithAgentOrderCount ?? 0) + Number(a.declaredAwaitingOrderCount ?? 0),
    }))
    .filter((a) => a.amount > 0 || a.orders > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return (
    <section style={styles.wrap} aria-label="COD with agents">
      <div style={styles.headRow}>
        <span style={styles.icon} aria-hidden>
          💵
        </span>
        <div style={styles.metrics}>
          <span style={styles.metricBlock}>
            <span style={styles.metricLabel}>Still with agents</span>
            <strong style={styles.metricValue}>{codMoney(withAgents, true)}</strong>
            <span style={styles.metricSub}>
              {ordersWithAgent} order{ordersWithAgent === 1 ? '' : 's'}
            </span>
          </span>
          <span style={styles.sep} aria-hidden>
            ·
          </span>
          <span style={styles.metricBlock}>
            <span style={styles.metricLabel}>Declared, not confirmed</span>
            <strong style={styles.metricValue}>{codMoney(declared, true)}</strong>
            <span style={styles.metricSub}>
              {handoversWaiting} handover{handoversWaiting === 1 ? '' : 's'}
            </span>
          </span>
          <span style={styles.sep} aria-hidden>
            ·
          </span>
          <span style={styles.metricBlock}>
            <span style={styles.metricLabel}>Total unsettled</span>
            <strong style={{ ...styles.metricValue, ...styles.metricTotal }}>{codMoney(total, true)}</strong>
          </span>
        </div>
        <Link to="/hub/accounts" style={styles.link}>
          Accounts
        </Link>
      </div>
      {ledger ? (
        <p style={styles.accountLine}>
          Confirmed from agents (all time): <strong>{codMoney(Number(ledger.totalReceivedAllTime ?? 0), true)}</strong>
          {' · '}
          Owed to company:{' '}
          <strong>{codMoney(Number(ledger.balanceOwedToCompany ?? 0), true)}</strong>
          {' · '}
          <Link to="/hub/accounts" style={styles.linkInline}>
            Accounts
          </Link>
        </p>
      ) : null}
      {agentLines.length > 0 ? (
        <p style={styles.agentLine}>
          {agentLines.map((a, i) => (
            <span key={`${a.name}-${i}`}>
              {i > 0 ? ' · ' : ''}
              <strong>{a.name}</strong> {codMoney(a.amount, true)}
              {a.orders > 0 ? ` (${a.orders})` : ''}
            </span>
          ))}
        </p>
      ) : total <= 0 ? (
        <p style={styles.muted}>No unsettled hub-route COD with agents right now.</p>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    background: 'color-mix(in srgb, var(--accent-soft) 40%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
    borderRadius: 8,
    padding: '0.45rem 0.55rem',
    display: 'grid',
    gap: '0.3rem',
  },
  wrapError: {
    borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border))',
    background: 'var(--bg-elevated)',
  },
  headRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.65rem',
  },
  icon: { fontSize: '1rem', lineHeight: 1 },
  metrics: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.25rem 0.45rem',
    flex: '1 1 12rem',
    minWidth: 0,
  },
  metricBlock: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.2rem 0.35rem',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  metricLabel: { color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.68rem' },
  metricValue: { fontVariantNumeric: 'tabular-nums', fontWeight: 800 },
  metricTotal: { color: 'var(--accent-strong, var(--accent))' },
  metricSub: { color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 },
  sep: { color: 'var(--text-muted)', opacity: 0.55 },
  link: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  agentLine: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  muted: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  accountLine: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  linkInline: { fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' },
};
