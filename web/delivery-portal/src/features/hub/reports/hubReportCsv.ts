import type {
  HubReportDto,
  HubAssignmentReportDto,
  HubDailyOrdersReportDto,
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

/** Escape a CSV field (RFC-style). */
function cell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map(cell).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvOperationsSummary(report: HubReportDto, agentId: string): void {
  const agents =
    agentId === 'all' ? report.agents : report.agents.filter((a) => a.agentId === agentId);
  downloadCsv(`hub-operations-${report.from}-${report.to}.csv`, [
    ['Agent', 'Phone', 'Shop pickups', 'Home deliveries', 'Total'],
    ...agents.map((a) => [
      a.name,
      a.phone,
      a.shopPickupsCompleted,
      a.homeDeliveriesCompleted,
      a.totalCompleted,
    ]),
    [],
    ['Metric', 'Value'],
    ['Orders placed', report.ordersPlaced],
    ['Orders delivered', report.ordersDelivered],
    ['Orders cancelled', report.ordersCancelled],
    ['Shop bags placed', report.subOrdersPlaced],
    ['Bags marked ready', report.bagsMarkedReady],
    ['GMV placed', report.placedGmv ?? 0],
    ['GMV delivered', report.deliveredGmv ?? 0],
    ['COD GMV delivered', report.codGmv ?? 0],
    ['Hub shop pickups', report.shopPickupsCompleted],
    ['Hub home deliveries', report.homeDeliveriesCompleted],
  ]);
}

export function csvDailyOrders(data: HubDailyOrdersReportDto): void {
  downloadCsv(`hub-daily-orders-${data.from}-${data.to}.csv`, [
    ['Date', 'Placed', 'Delivered', 'Cancelled', 'Delivered GMV', 'COD delivered GMV'],
    ...data.days.map((d) => [
      d.date,
      d.ordersPlaced,
      d.ordersDelivered,
      d.ordersCancelled,
      d.deliveredGmv,
      d.codDeliveredGmv,
    ]),
  ]);
}

export function csvPaymentMix(data: HubPaymentMixReportDto): void {
  downloadCsv(`hub-payment-mix-${data.from}-${data.to}.csv`, [
    ['Metric', 'Value'],
    ['Delivered orders', data.deliveredOrders],
    ['COD orders', data.codDeliveredOrders],
    ['Online orders', data.onlineDeliveredOrders],
    ['Delivered GMV', data.deliveredGmv ?? 0],
    ['COD GMV', data.codDeliveredGmv ?? 0],
    ['Online GMV', data.onlineDeliveredGmv ?? 0],
  ]);
}

export function csvQuality(data: HubQualityReportDto): void {
  downloadCsv(`hub-quality-${data.from}-${data.to}.csv`, [
    ['Orders cancelled', data.ordersCancelled],
    ['Shop bags placed', data.shopBagsPlaced],
    ['Bags rejected', data.shopBagsRejected],
    ['Reject rate %', data.rejectRatePercent],
    [],
    ['Cancel reason', 'Count'],
    ...data.cancelReasons.map((r) => [r.reason, r.count]),
  ]);
}

export function csvHubAccount(data: HubAccountSummary): void {
  downloadCsv(`hub-account-${data.from}-${data.to}.csv`, [
    ['Commission earned', data.commissionEarned],
    ['Commission paid', payoutsReceivedTotal(data)],
    ['Commission due', data.commissionDue],
    ['COD owed to company', data.codOwedToCompany],
    ['COD still with agents', data.codStillWithAgents],
    [],
    ['Payout date', 'Amount', 'Period start', 'Period end', 'Reference'],
    ...data.payoutsFromPlatform.map((p) => [
      p.recordedAt ?? '',
      p.amount,
      p.periodStart ?? '',
      p.periodEnd ?? '',
      p.reference ?? '',
    ]),
    [],
    ['Collection date', 'Amount', 'Kind', 'Reference'],
    ...data.collectionsByPlatform.map((p) => [
      p.recordedAt ?? '',
      p.amount,
      p.kind,
      p.reference ?? '',
    ]),
  ]);
}

export function csvTrips(data: HubAssignmentReportDto): void {
  downloadCsv(`hub-trips-${data.from}-${data.to}.csv`, [
    ['Completed at (UTC)', 'Leg', 'Agent', 'Phone', 'Order', 'Sub-order', 'Assignment #'],
    ...data.trips.map((t) => [
      t.completedAt ?? '',
      t.legType,
      t.agentName ?? '',
      t.agentPhone ?? '',
      t.orderNumber ?? '',
      t.subOrderNumber ?? '',
      t.assignmentNumber ?? '',
    ]),
  ]);
}

export function csvCodCloses(closes: CodCloseDayResponse[], from: string, to: string): void {
  downloadCsv(`hub-cod-closes-${from}-${to}.csv`, [
    ['Close date', 'Agent', 'Expected', 'Received', 'Orders', 'Status', 'Order #', 'Line amount'],
    ...closes.flatMap((c) =>
      c.lines.length === 0
        ? [[c.closeDate, c.agentName ?? c.agentId, c.expectedAmount, c.receivedAmount, c.orderCount, c.status, '', '']]
        : c.lines.map((line) => [
            c.closeDate,
            c.agentName ?? c.agentId,
            c.expectedAmount,
            c.receivedAmount,
            c.orderCount,
            c.status,
            line.orderNumber,
            line.amount,
          ]),
    ),
  ]);
}

export function csvCodLedger(ledger: CodHubLedger): void {
  downloadCsv(`hub-cod-ledger-${ledger.from}-${ledger.to}.csv`, [
    ['Type', 'Date', 'Agent', 'Amount', 'Orders', 'Status', 'Reference'],
    ...ledger.receipts.map((r) => [
      'Receipt',
      r.closeDate,
      r.agentName,
      r.receivedAmount,
      r.orderCount,
      r.status,
      r.fromAgentHandover ? 'handover' : 'close-day',
    ]),
    ...ledger.remittances.map((r) => [
      'Remittance',
      r.remittanceDate,
      '',
      r.amount,
      '',
      '',
      r.reference ?? '',
    ]),
  ]);
}

export function csvCodPending(detail: CodCustodianPendingDetail, agentId: string): void {
  const days =
    agentId === 'all'
      ? detail.days
      : detail.days.map((day) => ({
          ...day,
          agents: day.agents.filter((a) => a.agentId === agentId),
        }));
  downloadCsv(`hub-cod-pending-${detail.lookbackFrom}-${detail.lookbackTo}.csv`, [
    ['Delivery date', 'Agent', 'Still with agent ₹', 'Orders with agent', 'Declared awaiting ₹', 'Order #', 'Amount'],
    ...days.flatMap((day) =>
      day.agents.flatMap((agent) => {
        const orderRows = agent.stillWithAgentOrders.map((o) => [
          day.date,
          agent.agentName,
          agent.stillWithAgentAmount,
          agent.stillWithAgentOrderCount,
          agent.declaredAwaitingAmount,
          o.orderNumber,
          o.collectAmount,
        ]);
        if (orderRows.length > 0) return orderRows;
        return [
          [
            day.date,
            agent.agentName,
            agent.stillWithAgentAmount,
            agent.stillWithAgentOrderCount,
            agent.declaredAwaitingAmount,
            '',
            '',
          ],
        ];
      }),
    ),
  ]);
}

export function csvCodOutstanding(out: CodCustodianOutstanding, agentId: string): void {
  const agents =
    agentId === 'all' ? out.agents : out.agents.filter((a) => a.agentId === agentId);
  downloadCsv(`hub-cod-outstanding-${out.lookbackFrom}-${out.lookbackTo}.csv`, [
    ['Agent', 'Still with agent ₹', 'Orders', 'Declared awaiting ₹', 'Handovers awaiting'],
    ...agents.map((a) => [
      a.agentName,
      a.stillWithAgentAmount,
      a.stillWithAgentOrderCount,
      a.declaredAwaitingAmount,
      a.declaredAwaitingOrderCount,
    ]),
    [],
    ['Total still with agents', out.totalStillWithAgents],
    ['Total declared awaiting', out.totalDeclaredAwaitingConfirm],
  ]);
}
