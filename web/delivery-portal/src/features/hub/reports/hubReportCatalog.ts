export type HubReportKind =
  | 'operations'
  | 'daily-orders'
  | 'trips'
  | 'payment-mix'
  | 'order-quality'
  | 'hub-account'
  | 'cod-closes'
  | 'cod-ledger'
  | 'cod-pending'
  | 'cod-outstanding';

export type HubReportDefinition = {
  id: HubReportKind;
  title: string;
  subtitle: string;
  usesDateRange: boolean;
  usesAgentFilter: boolean;
  /** Snapshot as of today — date range optional / ignored for load */
  snapshot?: boolean;
};

export const HUB_REPORT_CATALOG: HubReportDefinition[] = [
  {
    id: 'operations',
    title: 'Operations summary',
    subtitle: 'Orders, GMV, bags ready, and agent trip counts for the hub town.',
    usesDateRange: true,
    usesAgentFilter: true,
  },
  {
    id: 'daily-orders',
    title: 'Daily order volume',
    subtitle: 'Placed, delivered, cancelled, and COD GMV by calendar day (IST).',
    usesDateRange: true,
    usesAgentFilter: false,
  },
  {
    id: 'trips',
    title: 'Completed trips log',
    subtitle: 'Every shop pickup and home delivery leg completed in the period.',
    usesDateRange: true,
    usesAgentFilter: true,
  },
  {
    id: 'payment-mix',
    title: 'Payment mix (delivered)',
    subtitle: 'COD vs online orders and GMV for your hub town.',
    usesDateRange: true,
    usesAgentFilter: false,
  },
  {
    id: 'order-quality',
    title: 'Cancellations & shop rejects',
    subtitle: 'Cancel reasons and vendor bag reject rate for the town.',
    usesDateRange: true,
    usesAgentFilter: false,
  },
  {
    id: 'hub-account',
    title: 'Hub account & settlements',
    subtitle: 'Delivery commission due/paid, franchise, COD remittance balance.',
    usesDateRange: true,
    usesAgentFilter: false,
  },
  {
    id: 'cod-closes',
    title: 'COD close days',
    subtitle: 'Agent close-day records: expected vs received cash and match status.',
    usesDateRange: true,
    usesAgentFilter: true,
  },
  {
    id: 'cod-ledger',
    title: 'Hub COD ledger',
    subtitle: 'Cash received from agents and remittances sent to company in the period.',
    usesDateRange: true,
    usesAgentFilter: false,
  },
  {
    id: 'cod-pending',
    title: 'Unsettled COD detail',
    subtitle: 'Cash still with agents or declared awaiting hub confirm, by delivery date.',
    usesDateRange: true,
    usesAgentFilter: true,
  },
  {
    id: 'cod-outstanding',
    title: 'COD outstanding (now)',
    subtitle: 'Live snapshot of unsettled hub COD across the lookback window.',
    usesDateRange: false,
    usesAgentFilter: true,
    snapshot: true,
  },
];

export function hubReportById(id: HubReportKind): HubReportDefinition {
  return HUB_REPORT_CATALOG.find((r) => r.id === id) ?? HUB_REPORT_CATALOG[0];
}
