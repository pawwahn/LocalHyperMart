import type { CSSProperties } from 'react';
import type {
  HubReportDto,
  HubDailyOrdersReportDto,
  HubAssignmentReportDto,
  HubPaymentMixReportDto,
  HubQualityReportDto,
} from '../api/hubApi';
import { payoutsReceivedTotal, type HubAccountSummary } from '../api/hubAccountApi';
import type {
  CodCloseDayResponse,
  CodCustodianOutstanding,
  CodCustodianPendingDetail,
  CodHubLedger,
} from '../api/codApi';
import { formatIsoDateRange } from '../lib/codFormat';
export type LoadedHubReport =
  | { kind: 'operations'; data: HubReportDto }
  | { kind: 'daily-orders'; data: HubDailyOrdersReportDto }
  | { kind: 'trips'; data: HubAssignmentReportDto }
  | { kind: 'payment-mix'; data: HubPaymentMixReportDto }
  | { kind: 'order-quality'; data: HubQualityReportDto }
  | { kind: 'hub-account'; data: HubAccountSummary }
  | { kind: 'cod-closes'; data: CodCloseDayResponse[] }
  | { kind: 'cod-ledger'; data: CodHubLedger }
  | { kind: 'cod-pending'; data: CodCustodianPendingDetail }
  | { kind: 'cod-outstanding'; data: CodCustodianOutstanding };

type Props = {
  loaded: LoadedHubReport;
  agentId: string;
  isMobile: boolean;
  onSelectAgent: (id: string) => void;
};

export function HubReportContent({ loaded, agentId, isMobile, onSelectAgent }: Props) {
  switch (loaded.kind) {
    case 'operations':
      return (
        <OperationsBody
          report={loaded.data}
          agentId={agentId}
          isMobile={isMobile}
          onSelectAgent={onSelectAgent}
        />
      );
    case 'daily-orders':
      return <DailyOrdersBody data={loaded.data} />;
    case 'trips':
      return <TripsBody data={loaded.data} isMobile={isMobile} />;
    case 'payment-mix':
      return <PaymentMixBody data={loaded.data} />;
    case 'order-quality':
      return <QualityBody data={loaded.data} />;
    case 'hub-account':
      return <HubAccountBody data={loaded.data} isMobile={isMobile} />;
    case 'cod-closes':
      return <CodClosesBody closes={loaded.data} agentId={agentId} isMobile={isMobile} />;
    case 'cod-ledger':
      return <CodLedgerBody ledger={loaded.data} isMobile={isMobile} />;
    case 'cod-pending':
      return <CodPendingBody detail={loaded.data} agentId={agentId} isMobile={isMobile} />;
    case 'cod-outstanding':
      return <CodOutstandingBody out={loaded.data} agentId={agentId} isMobile={isMobile} />;
    default:
      return null;
  }
}

function OperationsBody({
  report,
  agentId,
  isMobile,
  onSelectAgent,
}: {
  report: HubReportDto;
  agentId: string;
  isMobile: boolean;
  onSelectAgent: (id: string) => void;
}) {
  const selectedAgent =
    agentId === 'all' ? null : report.agents.find((a) => a.agentId === agentId) ?? null;
  const visibleAgents =
    agentId === 'all' ? report.agents : report.agents.filter((a) => a.agentId === agentId);
  const rangeLabel = report.from === report.to ? report.from : `${report.from} → ${report.to}`;

  return (
    <>
      {selectedAgent ? (
        <section style={styles.agentHero}>
          <p style={styles.agentHeroEyebrow}>Selected delivery agent</p>
          <h2 style={styles.agentHeroTitle}>🛵 {selectedAgent.name}</h2>
          <p style={styles.agentHeroPhone}>Phone: {selectedAgent.phone}</p>
          <div style={styles.stats}>
            <Stat label="Shop → Hub pickups" value={selectedAgent.shopPickupsCompleted} help="Bags brought to hub" tone="go" />
            <Stat label="Hub → Home deliveries" value={selectedAgent.homeDeliveriesCompleted} help="Orders to customers" tone="info" />
            <Stat label="Total trips" value={selectedAgent.totalCompleted} help={rangeLabel} />
          </div>
        </section>
      ) : (
        <>
          <section>
            <h2 style={styles.h2}>Town orders & bags (whole hub)</h2>
            <div style={styles.stats}>
              <Stat label="Orders placed" value={report.ordersPlaced} help="Customers placed order" />
              <Stat label="Orders delivered" value={report.ordersDelivered} help="Reached customer home" />
              <Stat label="Orders cancelled" value={report.ordersCancelled} help="Cancelled in period" />
              <Stat label="Shop bags (sub-orders)" value={report.subOrdersPlaced} help="Bags from shops" />
              <Stat label="Bags marked ready" value={report.bagsMarkedReady} help="Shops packed" />
              <Stat label="GMV placed" value={Number(report.placedGmv ?? 0)} help="₹ order value placed" money />
              <Stat label="GMV delivered" value={Number(report.deliveredGmv ?? 0)} help="₹ reached buyer" money />
              <Stat label="COD collected" value={Number(report.codGmv ?? 0)} help="₹ COD delivered" money />
            </div>
          </section>
          <section>
            <h2 style={styles.h2}>All hub trips completed</h2>
            <div style={styles.stats}>
              <Stat label="Shop → Hub pickups" value={report.shopPickupsCompleted} help="Bags to hub" tone="go" />
              <Stat label="Hub → Home deliveries" value={report.homeDeliveriesCompleted} help="To customers" tone="info" />
            </div>
          </section>
        </>
      )}
      <section>
        <h2 style={styles.h2}>{selectedAgent ? 'This agent — trips' : 'Delivery agents comparison'}</h2>
        {visibleAgents.length === 0 ? (
          <p style={styles.empty}>No trips for the selected filters.</p>
        ) : isMobile ? (
          <div style={styles.agentCards}>
            {visibleAgents.map((a) => (
              <button
                key={a.agentId}
                type="button"
                style={agentId === a.agentId ? styles.agentCardActive : styles.agentCard}
                onClick={() => onSelectAgent(a.agentId)}
              >
                <strong>{a.name}</strong>
                <span style={styles.meta}>{a.phone}</span>
                <div style={styles.agentCardNums}>
                  <span>Pickups <strong>{a.shopPickupsCompleted}</strong></span>
                  <span>Home <strong>{a.homeDeliveriesCompleted}</strong></span>
                  <span>Total <strong>{a.totalCompleted}</strong></span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Agent</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.thNum}>Pickups</th>
                  <th style={styles.thNum}>Home</th>
                  <th style={styles.thNum}>Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((a) => (
                  <tr key={a.agentId}>
                    <td style={styles.td}><strong>{a.name}</strong></td>
                    <td style={styles.td}>
                      <button type="button" style={styles.phoneBtn} onClick={() => onSelectAgent(a.agentId)}>
                        {a.phone}
                      </button>
                    </td>
                    <td style={styles.tdNum}>{a.shopPickupsCompleted}</td>
                    <td style={styles.tdNum}>{a.homeDeliveriesCompleted}</td>
                    <td style={styles.tdNum}><strong>{a.totalCompleted}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedAgent ? (
          <button type="button" style={styles.clearBtn} onClick={() => onSelectAgent('all')}>
            ← Show all agents
          </button>
        ) : null}
      </section>
    </>
  );
}

function DailyOrdersBody({ data }: { data: HubDailyOrdersReportDto }) {
  const totals = data.days.reduce(
    (acc, d) => ({
      placed: acc.placed + d.ordersPlaced,
      delivered: acc.delivered + d.ordersDelivered,
      cancelled: acc.cancelled + d.ordersCancelled,
      gmv: acc.gmv + Number(d.deliveredGmv ?? 0),
      cod: acc.cod + Number(d.codDeliveredGmv ?? 0),
    }),
    { placed: 0, delivered: 0, cancelled: 0, gmv: 0, cod: 0 },
  );
  return (
    <section>
      <h2 style={styles.h2}>Daily breakdown</h2>
      <div style={styles.stats}>
        <Stat label="Total placed" value={totals.placed} help="Sum of daily placed" />
        <Stat label="Total delivered" value={totals.delivered} help="Sum of daily delivered" />
        <Stat label="Delivered GMV" value={totals.gmv} help="₹ in period" money />
        <Stat label="COD delivered GMV" value={totals.cod} help="₹ COD in period" money />
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.thNum}>Placed</th>
              <th style={styles.thNum}>Delivered</th>
              <th style={styles.thNum}>Cancelled</th>
              <th style={styles.thNum}>Delivered ₹</th>
              <th style={styles.thNum}>COD ₹</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date}>
                <td style={styles.td}>{d.date}</td>
                <td style={styles.tdNum}>{d.ordersPlaced}</td>
                <td style={styles.tdNum}>{d.ordersDelivered}</td>
                <td style={styles.tdNum}>{d.ordersCancelled}</td>
                <td style={styles.tdNum}>{Number(d.deliveredGmv ?? 0).toFixed(0)}</td>
                <td style={styles.tdNum}>{Number(d.codDeliveredGmv ?? 0).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentMixBody({ data }: { data: HubPaymentMixReportDto }) {
  const codPct =
    data.deliveredOrders > 0 ? Math.round((100 * data.codDeliveredOrders) / data.deliveredOrders) : 0;
  return (
    <section>
      <h2 style={styles.h2}>Delivered payment mix</h2>
      <div style={styles.stats}>
        <Stat label="Delivered orders" value={data.deliveredOrders} help="Reached buyer" />
        <Stat label="COD orders" value={data.codDeliveredOrders} help={`${codPct}% of delivered`} />
        <Stat label="Online orders" value={data.onlineDeliveredOrders} help="UPI / card / wallet" />
        <Stat label="Delivered GMV" value={Number(data.deliveredGmv ?? 0)} help="₹ total" money />
        <Stat label="COD GMV" value={Number(data.codDeliveredGmv ?? 0)} help="₹ COD" money />
        <Stat label="Online GMV" value={Number(data.onlineDeliveredGmv ?? 0)} help="₹ prepaid" money />
      </div>
    </section>
  );
}

function QualityBody({ data }: { data: HubQualityReportDto }) {
  return (
    <section>
      <h2 style={styles.h2}>Cancellations & shop quality</h2>
      <div style={styles.stats}>
        <Stat label="Orders cancelled" value={data.ordersCancelled} help="In period" tone="info" />
        <Stat label="Shop bags placed" value={data.shopBagsPlaced} help="Sub-orders" />
        <Stat label="Bags rejected" value={data.shopBagsRejected} help="Vendor rejected" tone="info" />
        <Stat label="Reject rate" value={data.rejectRatePercent} help="% of bags placed" />
      </div>
      <h3 style={styles.h3}>Cancel reasons</h3>
      {data.cancelReasons.length === 0 ? (
        <p style={styles.empty}>No cancellations in this period.</p>
      ) : (
        <MiniTable
          isMobile={false}
          headers={['Reason', 'Count']}
          rows={data.cancelReasons.map((r) => [r.reason, String(r.count)])}
        />
      )}
    </section>
  );
}

function HubAccountBody({ data, isMobile }: { data: HubAccountSummary; isMobile: boolean }) {
  return (
    <section>
      <h2 style={styles.h2}>Hub account ({data.from} → {data.to})</h2>
      <div style={styles.stats}>
        <Stat label="Commission earned" value={data.commissionEarned} help="₹ in range" money />
        <Stat label="Commission paid" value={payoutsReceivedTotal(data)} help="₹ received" money />
        <Stat label="Commission due" value={data.commissionDue} help="₹ unpaid" money tone="info" />
        <Stat label="Delivered (range)" value={data.deliveredOrdersInRange} help="Orders" />
        <Stat label="COD owed to company" value={data.codOwedToCompany} help="All-time balance" money />
        <Stat label="COD with agents" value={data.codStillWithAgents} help="₹ unsettled" money />
        {data.franchiseEnabled ? (
          <Stat
            label="Franchise"
            value={data.franchiseCollected ? data.franchiseAmount : 0}
            help={data.franchiseCollected ? 'Collected' : `Due ₹${data.franchiseAmount}`}
            money
          />
        ) : null}
      </div>
      <h3 style={styles.h3}>Payouts from platform</h3>
      {data.payoutsFromPlatform.length === 0 ? (
        <p style={styles.muted}>No payouts recorded in range.</p>
      ) : (
        <MiniTable
          isMobile={isMobile}
          headers={['Date', '₹', 'Period', 'Ref']}
          rows={data.payoutsFromPlatform.map((p) => [
            p.recordedAt?.slice(0, 10) ?? '',
            String(p.amount),
            p.periodStart && p.periodEnd ? `${p.periodStart} → ${p.periodEnd}` : '',
            p.reference ?? '',
          ])}
        />
      )}
      <h3 style={styles.h3}>Collections by platform</h3>
      {data.collectionsByPlatform.length === 0 ? (
        <p style={styles.muted}>No collections in range.</p>
      ) : (
        <MiniTable
          isMobile={isMobile}
          headers={['Date', '₹', 'Kind', 'Ref']}
          rows={data.collectionsByPlatform.map((p) => [
            p.recordedAt?.slice(0, 10) ?? '',
            String(p.amount),
            p.kind,
            p.reference ?? '',
          ])}
        />
      )}
    </section>
  );
}

function TripsBody({ data, isMobile }: { data: HubAssignmentReportDto; isMobile: boolean }) {
  if (data.trips.length === 0) {
    return <p style={styles.empty}>No completed trips in this period.</p>;
  }
  return (
    <section>
      <h2 style={styles.h2}>Completed trips ({data.trips.length})</h2>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Completed</th>
              <th style={styles.th}>Leg</th>
              <th style={styles.th}>Agent</th>
              {!isMobile ? <th style={styles.th}>Order</th> : null}
              <th style={styles.th}>Sub-order</th>
            </tr>
          </thead>
          <tbody>
            {data.trips.slice(0, 500).map((t) => (
              <tr key={t.assignmentId}>
                <td style={styles.td}>{formatInstantIst(t.completedAt)}</td>
                <td style={styles.td}>{legLabel(t.legType)}</td>
                <td style={styles.td}>
                  <strong>{t.agentName ?? '—'}</strong>
                  <div style={styles.meta}>{t.agentPhone}</div>
                </td>
                {!isMobile ? <td style={styles.td}>{t.orderNumber ?? '—'}</td> : null}
                <td style={styles.td}>{t.subOrderNumber ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.trips.length > 500 ? (
        <p style={styles.muted}>Showing first 500 trips. Export CSV for the full list.</p>
      ) : null}
    </section>
  );
}

function CodClosesBody({
  closes,
  agentId,
  isMobile,
}: {
  closes: CodCloseDayResponse[];
  agentId: string;
  isMobile: boolean;
}) {
  const filtered =
    agentId === 'all' ? closes : closes.filter((c) => c.agentId === agentId);
  const matched = filtered.filter((c) => c.status === 'MATCHED').length;
  const disc = filtered.filter((c) => c.status === 'DISCREPANCY').length;
  const received = filtered.reduce((s, c) => s + c.receivedAmount, 0);
  if (filtered.length === 0) {
    return <p style={styles.empty}>No COD close days in this period.</p>;
  }
  return (
    <section>
      <h2 style={styles.h2}>COD close days</h2>
      <div style={styles.stats}>
        <Stat label="Close records" value={filtered.length} help="Agent close days" />
        <Stat label="Matched" value={matched} help="Expected = received" tone="go" />
        <Stat label="Discrepancy" value={disc} help="Needs review" tone={disc > 0 ? 'info' : 'neutral'} />
        <Stat label="Cash received" value={received} help="₹ total received" money />
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Agent</th>
              <th style={styles.thNum}>Expected</th>
              <th style={styles.thNum}>Received</th>
              <th style={styles.thNum}>Orders</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.closeDate}</td>
                <td style={styles.tdAgent}>
                  <strong>{c.agentName?.trim() || 'Delivery agent'}</strong>
                  {c.agentPhone ? <div style={styles.meta}>{c.agentPhone}</div> : null}
                </td>
                <td style={styles.tdNum}>₹{c.expectedAmount}</td>
                <td style={styles.tdNum}>₹{c.receivedAmount}</td>
                <td style={styles.tdNum}>{c.orderCount}</td>
                <td style={styles.td}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isMobile && filtered.some((c) => c.lines.length > 0) ? (
        <p style={styles.muted}>Export CSV includes order-level lines.</p>
      ) : null}
    </section>
  );
}

function CodLedgerBody({ ledger, isMobile }: { ledger: CodHubLedger; isMobile: boolean }) {
  return (
    <section>
      <h2 style={styles.h2}>Hub COD ledger</h2>
      <div style={styles.stats}>
        <Stat label="Received (range)" value={ledger.totalReceivedInRange} help="₹ from agents" money />
        <Stat label="Remitted (range)" value={ledger.totalRemittedInRange} help="₹ to company" money />
        <Stat label="Balance owed" value={ledger.balanceOwedToCompany} help="All-time balance" money />
      </div>
      <h3 style={styles.h3}>Receipts</h3>
      {ledger.receipts.length === 0 ? (
        <p style={styles.empty}>No receipts in range.</p>
      ) : (
        <MiniTable
          isMobile={isMobile}
          headers={['Date', 'Agent', '₹', 'Orders', 'Status']}
          rows={ledger.receipts.map((r) => [
            r.closeDate,
            r.agentName,
            String(r.receivedAmount),
            String(r.orderCount),
            r.status,
          ])}
        />
      )}
      <h3 style={styles.h3}>Remittances</h3>
      {ledger.remittances.length === 0 ? (
        <p style={styles.empty}>No remittances in range.</p>
      ) : (
        <MiniTable
          isMobile={isMobile}
          headers={['Date', '₹', 'Reference']}
          rows={ledger.remittances.map((r) => [
            r.remittanceDate,
            String(r.amount),
            r.reference ?? '',
          ])}
        />
      )}
    </section>
  );
}

function CodPendingBody({
  detail,
  agentId,
  isMobile,
}: {
  detail: CodCustodianPendingDetail;
  agentId: string;
  isMobile: boolean;
}) {
  const days = detail.days.filter((day) =>
    agentId === 'all' ? true : day.agents.some((a) => a.agentId === agentId),
  );
  return (
    <section>
      <h2 style={styles.h2}>Unsettled COD by delivery date</h2>
      <div style={styles.stats}>
        <Stat label="Still with agents" value={detail.totalStillWithAgents} help="₹ unsettled" money />
        <Stat label="Declared awaiting hub" value={detail.totalDeclaredAwaitingConfirm} help="₹ not confirmed" money />
        <Stat label="Orders with agents" value={detail.ordersStillWithAgents} help="Count" />
      </div>
      {days.length === 0 ? (
        <p style={styles.empty}>No unsettled COD in this date range.</p>
      ) : (
        days.map((day) => {
          const agents =
            agentId === 'all' ? day.agents : day.agents.filter((a) => a.agentId === agentId);
          if (agents.length === 0) return null;
          return (
            <div key={day.date} style={{ marginBottom: '1rem' }}>
              <h3 style={styles.h3}>{day.date}</h3>
              <MiniTable
                isMobile={isMobile}
                headers={['Agent', 'With agent ₹', 'Orders', 'Awaiting ₹']}
                rows={agents.map((a) => [
                  a.agentName,
                  String(a.stillWithAgentAmount),
                  String(a.stillWithAgentOrderCount),
                  String(a.declaredAwaitingAmount),
                ])}
              />
            </div>
          );
        })
      )}
    </section>
  );
}

function CodOutstandingBody({
  out,
  agentId,
  isMobile,
}: {
  out: CodCustodianOutstanding;
  agentId: string;
  isMobile: boolean;
}) {
  const agents = agentId === 'all' ? out.agents : out.agents.filter((a) => a.agentId === agentId);
  return (
    <section>
      <h2 style={styles.h2}>Outstanding COD snapshot</h2>
      <p style={styles.muted}>
        Lookback {formatIsoDateRange(out.lookbackFrom, out.lookbackTo)} (as of now)
      </p>
      <div style={styles.stats}>
        <Stat label="With agents" value={out.totalStillWithAgents} help="₹ total" money />
        <Stat label="Awaiting confirm" value={out.totalDeclaredAwaitingConfirm} help="₹ declared" money />
        <Stat label="Handovers pending" value={out.handoversAwaitingConfirm} help="Count" />
      </div>
      {agents.length === 0 ? (
        <p style={styles.empty}>All clear — no unsettled COD for this filter.</p>
      ) : (
        <MiniTable
          isMobile={isMobile}
          headers={['Agent', 'With agent ₹', 'Orders', 'Awaiting ₹', 'Handovers']}
          rows={agents.map((a) => [
            a.agentName,
            String(a.stillWithAgentAmount),
            String(a.stillWithAgentOrderCount),
            String(a.declaredAwaitingAmount),
            String(a.declaredAwaitingOrderCount),
          ])}
        />
      )}
    </section>
  );
}

function MiniTable({
  headers,
  rows,
  isMobile,
}: {
  headers: string[];
  rows: string[][];
  isMobile: boolean;
}) {
  return (
    <div style={styles.tableWrap}>
      <table style={{ ...styles.table, minWidth: isMobile ? 320 : 480 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={styles.td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function legLabel(leg: string): string {
  if (leg === 'PICKUP') return 'Shop → Hub';
  if (leg === 'LAST_MILE') return 'Hub → Home';
  if (leg === 'VENDOR_DIRECT') return 'Vendor direct';
  return leg;
}

function formatInstantIst(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return iso;
  }
}

function Stat({
  label,
  value,
  help,
  tone = 'neutral',
  money = false,
}: {
  label: string;
  value: number;
  help: string;
  tone?: 'neutral' | 'go' | 'info';
  money?: boolean;
}) {
  const toneStyle =
    tone === 'go' ? styles.statGo : tone === 'info' ? styles.statInfo : styles.stat;
  return (
    <div style={toneStyle}>
      <p style={styles.statValue}>{money ? `₹${value.toFixed(0)}` : value}</p>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statHelp}>{help}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  h2: { margin: '0 0 0.65rem', fontSize: '1.1rem', fontWeight: 800 },
  h3: { margin: '0.75rem 0 0.4rem', fontSize: '0.95rem', fontWeight: 800 },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    marginTop: '0.5rem',
  },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statGo: {
    background: 'rgba(129, 199, 132, 0.1)',
    border: '1px solid rgba(129, 199, 132, 0.45)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statInfo: {
    background: 'rgba(66, 165, 245, 0.1)',
    border: '1px solid rgba(66, 165, 245, 0.45)',
    borderRadius: 14,
    padding: '0.9rem',
  },
  statValue: { margin: 0, fontSize: '1.7rem', fontWeight: 800, fontFamily: 'var(--font-display)' },
  statLabel: { margin: '0.2rem 0 0', fontWeight: 800, fontSize: '0.92rem' },
  statHelp: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 640 },
  th: {
    textAlign: 'left',
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  thNum: {
    textAlign: 'right',
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  td: { padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdAgent: {
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    minWidth: 120,
    maxWidth: 200,
  },
  tdNum: {
    padding: '0.75rem 0.85rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 700,
  },
  agentHero: {
    background: 'rgba(66, 165, 245, 0.1)',
    border: '2px solid rgba(66, 165, 245, 0.45)',
    borderRadius: 16,
    padding: '1.1rem',
    display: 'grid',
    gap: '0.45rem',
  },
  agentHeroEyebrow: { margin: 0, fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent)' },
  agentHeroTitle: { margin: 0, fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-display)' },
  agentHeroPhone: { margin: 0, fontWeight: 700, fontSize: '1.05rem' },
  agentCards: { display: 'grid', gap: '0.65rem' },
  agentCard: {
    textAlign: 'left',
    border: '2px solid var(--border)',
    borderRadius: 14,
    padding: '0.9rem 1rem',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.3rem',
  },
  agentCardActive: {
    textAlign: 'left',
    border: '2px solid var(--accent)',
    borderRadius: 14,
    padding: '0.9rem 1rem',
    background: 'var(--accent-soft)',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.3rem',
  },
  agentCardNums: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.35rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  phoneBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  },
  clearBtn: {
    marginTop: '0.75rem',
    border: '2px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.9rem',
    background: 'var(--bg-elevated)',
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 },
  empty: {
    margin: 0,
    padding: '1rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
  muted: { color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' },
};
