import { useMemo, type CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import { CallPhoneLink } from '@/shared/ui/CallPhoneLink';
import type { CodCustodianPendingDetail } from '../api/codApi';
import type { AgentDto } from '../api/hubApi';
import { codMoney, formatCodDate, formatDeliveredIst } from '../lib/codFormat';

type Props = {
  data: CodCustodianPendingDetail | null;
  roster: AgentDto[];
  selectedAgentId: string;
  onSelectAgentId: (agentId: string) => void;
  loading?: boolean;
};

type Row = {
  key: string;
  deliveryDay: string;
  orderNumber: string;
  amount: number;
  status: 'With agent' | 'Declared';
  deliveredAt?: string | null;
};

function money(v: number): string {
  return `₹${v.toFixed(2)}`;
}

export function CodPendingByAgentPanel({
  data,
  roster,
  selectedAgentId,
  onSelectAgentId,
  loading,
}: Props) {
  const rollupByAgent = useMemo(() => {
    const map = new Map<
      string,
      { name: string; still: number; declared: number; orders: number }
    >();
    for (const day of data?.days ?? []) {
      for (const agent of day.agents) {
        const stillAmt = Number(agent.stillWithAgentAmount ?? 0);
        const declAmt = Number(agent.declaredAwaitingAmount ?? 0);
        const orders =
          (agent.stillWithAgentOrderCount ?? 0) + (agent.declaredAwaitingOrderCount ?? 0);
        if (orders <= 0 && stillAmt + declAmt <= 0) continue;
        const prev = map.get(agent.agentId);
        map.set(agent.agentId, {
          name: agent.agentName || prev?.name || 'Agent',
          still: (prev?.still ?? 0) + stillAmt,
          declared: (prev?.declared ?? 0) + declAmt,
          orders: (prev?.orders ?? 0) + orders,
        });
      }
    }
    return map;
  }, [data]);

  const agentOptions = useMemo(() => {
    const byId = new Map(roster.map((a) => [a.agentId, a]));
    for (const [agentId, rollup] of rollupByAgent) {
      if (!byId.has(agentId)) {
        byId.set(agentId, {
          agentId,
          name: rollup.name,
          phone: '',
          status: 'ACTIVE',
        });
      }
    }
    const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    return list.map((a) => ({
      ...a,
      rollup: rollupByAgent.get(a.agentId),
      hasPending: (rollupByAgent.get(a.agentId)?.orders ?? 0) > 0,
    }));
  }, [roster, rollupByAgent]);

  const selectedMeta = useMemo(() => {
    const rosterAgent = roster.find((a) => a.agentId === selectedAgentId);
    let agentPhone = rosterAgent?.phone ?? null;
    let agentName = rosterAgent?.name ?? 'Agent';

    const rows: Row[] = [];
    let stillTotal = 0;
    let declaredTotal = 0;
    let stillCount = 0;
    let declaredCount = 0;

    for (const day of data?.days ?? []) {
      for (const agent of day.agents) {
        if (agent.agentId !== selectedAgentId) continue;
        if (agent.agentPhone) agentPhone = agent.agentPhone;
        if (agent.agentName) agentName = agent.agentName;

        for (const o of agent.stillWithAgentOrders) {
          const amt = Number(o.collectAmount ?? 0);
          stillTotal += amt;
          stillCount += 1;
          rows.push({
            key: `s-${day.date}-${o.orderId}`,
            deliveryDay: day.date,
            orderNumber: o.orderNumber,
            amount: amt,
            status: 'With agent',
            deliveredAt: o.deliveredAt,
          });
        }
        for (const h of agent.declaredAwaiting) {
          for (const line of h.lines) {
            const amt = Number(line.collectAmount ?? 0);
            declaredTotal += amt;
            declaredCount += 1;
            rows.push({
              key: `d-${day.date}-${h.handoverId}-${line.orderId}`,
              deliveryDay: day.date,
              orderNumber: line.orderNumber,
              amount: amt,
              status: 'Declared',
              deliveredAt: line.deliveredAt,
            });
          }
        }
      }
    }

    rows.sort((a, b) => {
      const dayCmp = b.deliveryDay.localeCompare(a.deliveryDay);
      if (dayCmp !== 0) return dayCmp;
      return a.orderNumber.localeCompare(b.orderNumber);
    });

    return { agentName, agentPhone, rows, stillTotal, declaredTotal, stillCount, declaredCount };
  }, [data, roster, selectedAgentId]);

  const rangeLabel = useMemo(() => {
    if (!data?.lookbackFrom || !data?.lookbackTo) return 'this period';
    if (data.lookbackFrom === data.lookbackTo) return formatCodDate(data.lookbackFrom);
    return `${formatCodDate(data.lookbackFrom)} → ${formatCodDate(data.lookbackTo)} (IST)`;
  }, [data?.lookbackFrom, data?.lookbackTo]);

  if (loading) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>By agent</p>
        <p style={styles.muted}>Loading pending COD by agent…</p>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <p style={styles.title}>By agent</p>
      <p style={styles.lead}>
        All unsettled COD with your agents — cash still with them or declared and waiting for you to confirm.
        Pick an agent to see every pending order by delivery day (IST).
      </p>

      <label style={styles.selectField}>
        <span style={styles.selectLabel}>Delivery agent</span>
        <select
          value={selectedAgentId}
          onChange={(e) => onSelectAgentId(e.target.value)}
          style={styles.select}
        >
          <option value="">Choose an agent…</option>
          {agentOptions.map((a) => (
            <option key={a.agentId} value={a.agentId}>
              {a.name}
              {a.rollup && a.hasPending
                ? ` · ${codMoney(a.rollup.still + a.rollup.declared, true)} pending (${a.rollup.orders} orders)`
                : ''}
            </option>
          ))}
        </select>
      </label>

      {!selectedAgentId ? (
        <p style={styles.muted}>Select an agent to see every pending order by delivery day.</p>
      ) : (
        <>
          <div style={styles.agentHead}>
            <div>
              <p style={styles.agentName}>{selectedMeta.agentName}</p>
              {selectedMeta.agentPhone ? (
                <CallPhoneLink phone={selectedMeta.agentPhone} label={selectedMeta.agentPhone} style={styles.phone} />
              ) : (
                <span style={styles.muted}>No phone on file</span>
              )}
            </div>
          </div>

          <div style={styles.stats}>
            <div
              style={{
                ...styles.metric,
                ...(selectedMeta.stillTotal > 0 ? styles.metricCollect : styles.metricNeutral),
              }}
            >
              <p style={styles.metricLabel}>With agent</p>
              <p style={styles.metricValue}>{money(selectedMeta.stillTotal)}</p>
              <p style={styles.metricHint}>
                {selectedMeta.stillCount > 0
                  ? `${selectedMeta.stillCount} order${selectedMeta.stillCount === 1 ? '' : 's'}`
                  : 'None'}
              </p>
            </div>
            <div
              style={{
                ...styles.metric,
                ...(selectedMeta.declaredTotal > 0 ? styles.metricDeclared : styles.metricNeutral),
              }}
            >
              <p style={styles.metricLabel}>Declared</p>
              <p style={styles.metricValue}>{money(selectedMeta.declaredTotal)}</p>
              <p style={styles.metricHint}>
                {selectedMeta.declaredCount > 0
                  ? `${selectedMeta.declaredCount} order${selectedMeta.declaredCount === 1 ? '' : 's'} to confirm`
                  : 'None'}
              </p>
            </div>
          </div>

          {selectedMeta.rows.length === 0 ? (
            <div style={styles.emptyAgent} role="status">
              <p style={styles.emptyTitle}>All clear for this agent</p>
              <p style={styles.emptyHint}>
                No cash still with {selectedMeta.agentName} and nothing declared awaiting hub confirm in{' '}
                {rangeLabel}.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Delivery day</th>
                    <th style={styles.th}>Order</th>
                    <th style={styles.thRight}>Amount</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.thRight}>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMeta.rows.map((r) => (
                    <tr key={r.key}>
                      <td style={styles.tdDay}>
                        <span style={styles.dayIso}>{r.deliveryDay}</span>
                        <span style={styles.dayHuman}>{formatCodDate(r.deliveryDay)}</span>
                      </td>
                      <td style={styles.tdStrong}>{r.orderNumber}</td>
                      <td style={styles.tdRight}>{money(r.amount)}</td>
                      <td style={styles.td}>
                        <span style={r.status === 'Declared' ? styles.badgeDeclared : styles.badgeWithAgent}>
                          {r.status}
                        </span>
                      </td>
                      <td style={styles.tdRightMuted}>{formatDeliveredIst(r.deliveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.65rem 0.75rem', display: 'grid', gap: '0.55rem' },
  title: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  lead: { margin: 0, fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-muted)', fontWeight: 650 },
  muted: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 650 },
  selectField: { display: 'grid', gap: '0.22rem', maxWidth: '100%' },
  selectLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  },
  select: {
    padding: '0.42rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.85rem',
    fontWeight: 600,
    maxWidth: '100%',
  },
  agentHead: {
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
  },
  agentName: { margin: 0, fontWeight: 800, fontSize: '0.92rem' },
  phone: { fontSize: '0.78rem', fontWeight: 650 },
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
    background: 'var(--warning-soft)',
    borderColor: 'color-mix(in srgb, var(--warning) 35%, var(--border))',
  },
  metricDeclared: {
    background: 'var(--success-soft)',
    borderColor: 'color-mix(in srgb, var(--success) 35%, var(--border))',
  },
  metricLabel: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  metricValue: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  metricHint: { margin: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' },
  emptyAgent: {
    padding: '0.65rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border))',
    background: 'var(--success-soft)',
    display: 'grid',
    gap: '0.2rem',
  },
  emptyTitle: { margin: 0, fontWeight: 800, fontSize: '0.88rem' },
  emptyHint: { margin: 0, fontSize: '0.78rem', fontWeight: 650, lineHeight: 1.45, color: 'var(--text-muted)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  thRight: { textAlign: 'right', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.35rem 0.45rem', verticalAlign: 'top' },
  tdDay: { padding: '0.35rem 0.45rem', verticalAlign: 'top', display: 'grid', gap: '0.06rem' },
  dayIso: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  dayHuman: { fontSize: '0.76rem', fontWeight: 700 },
  tdStrong: { padding: '0.35rem 0.45rem', fontWeight: 800, verticalAlign: 'top' },
  tdRight: {
    padding: '0.35rem 0.45rem',
    textAlign: 'right',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  tdRightMuted: {
    padding: '0.35rem 0.45rem',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  badgeWithAgent: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: 'var(--warning-soft)',
    border: '1px solid color-mix(in srgb, var(--warning) 45%, var(--border))',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
  badgeDeclared: {
    display: 'inline-block',
    padding: '0.1rem 0.35rem',
    borderRadius: 6,
    background: 'var(--success-soft)',
    border: '1px solid color-mix(in srgb, var(--success) 45%, var(--border))',
    fontWeight: 700,
    fontSize: '0.68rem',
  },
};
