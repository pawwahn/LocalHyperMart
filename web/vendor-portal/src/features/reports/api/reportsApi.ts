import { apiRequest } from '@/shared/api/http';

export type SalesReportItem = {
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountPrice?: number | null;
  lineTotal: number;
};

export type ItemPerformance = {
  name: string;
  unit?: string | null;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

export type SalesReportRow = {
  subOrderId: string;
  subOrderNumber: string;
  orderId: string;
  orderNumber: string;
  placedAt?: string | null;
  status: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  subtotal: number;
  itemCount: number;
  items?: SalesReportItem[] | null;
};

export type SalesReport = {
  from: string;
  to: string;
  includeItems: boolean;
  orderCount: number;
  itemQuantityTotal: number;
  grossSales: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  rejectedAmount: number;
  statusCounts: Record<string, number>;
  paymentStatusCounts: Record<string, number>;
  paymentMethodCounts: Record<string, number>;
  rows: SalesReportRow[];
  topSellingItems?: ItemPerformance[];
  leastSellingItems?: ItemPerformance[];
};

export type SalesReportFilters = {
  from: string;
  to: string;
  includeItems: boolean;
};

function money(value: number | null | undefined): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export function formatMoney(value: number | null | undefined): string {
  return money(value);
}

export async function fetchSalesReport(
  token: string,
  vendorId: string,
  filters: SalesReportFilters,
): Promise<SalesReport> {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  params.set('includeItems', String(filters.includeItems));
  return apiRequest<SalesReport>(`/api/v1/orders/vendor/sales-report?${params.toString()}`, {
    token,
    vendorId,
  });
}

export {
  exportSalesReportCsv,
  exportSalesReportExcel,
  exportSalesReportPdf,
  type PayoutExportInfo,
  type ReportExportSummary,
} from './reportExport';
