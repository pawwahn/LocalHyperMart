import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatMoney, type SalesReport } from './reportsApi';

export type PayoutExportInfo = {
  paid?: boolean;
  paidAt?: string | null;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  transactionNotes?: string | null;
};

export type ReportExportSummary = {
  paidAmount: number;
  unpaidAmount: number;
  paidOrders: number;
  unpaidOrders: number;
};

type ExportRow = {
  placedAt: string;
  orderNumber: string;
  subOrderNumber: string;
  status: string;
  yourAmount: number;
  itemCount: number;
  payoutStatus: string;
  paidAt: string;
  payoutMode: string;
  transactionReference: string;
  transactionNotes: string;
  itemName: string;
  unit: string;
  qty: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
};

const HEADERS = [
  'Placed at',
  'Order',
  'Sub-order',
  'Status',
  'Your amount',
  'Items',
  'Payout',
  'Paid at',
  'Mode',
  'Txn ref',
  'Notes',
  'Item',
  'Unit',
  'Qty',
  'Unit price',
  'Line total',
] as const;

function fileBase(report: SalesReport): string {
  return `vendor-sales-${report.from}_to_${report.to}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRows(
  report: SalesReport,
  payoutsBySubOrder: Record<string, PayoutExportInfo>,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const row of report.rows) {
    const payout = payoutsBySubOrder[row.subOrderId];
    const base = {
      placedAt: row.placedAt ? new Date(row.placedAt).toLocaleString() : '',
      orderNumber: row.orderNumber,
      subOrderNumber: row.subOrderNumber,
      status: row.status,
      yourAmount: Number(row.subtotal ?? 0),
      itemCount: row.itemCount,
      payoutStatus: payout?.paid
        ? 'SETTLED'
        : row.status === 'DELIVERED'
          ? 'AWAITING'
          : row.status === 'VENDOR_REJECTED' || row.status === 'REJECTED'
            ? 'NOT PAYABLE'
            : 'NOT DUE YET',
      paidAt: payout?.paidAt ? new Date(payout.paidAt).toLocaleString() : '',
      payoutMode: payout?.payoutMethod ?? '',
      transactionReference: payout?.transactionReference ?? '',
      transactionNotes: payout?.transactionNotes ?? '',
    };
    if (report.includeItems && row.items && row.items.length > 0) {
      for (const item of row.items) {
        rows.push({
          ...base,
          itemName: item.name,
          unit: item.unit ?? '',
          qty: item.quantity,
          unitPrice: Number(item.unitPrice ?? 0),
          lineTotal: Number(item.lineTotal ?? 0),
        });
      }
    } else {
      rows.push({
        ...base,
        itemName: '',
        unit: '',
        qty: '',
        unitPrice: '',
        lineTotal: '',
      });
    }
  }
  return rows;
}

function toMatrix(rows: ExportRow[]): (string | number)[][] {
  return [
    [...HEADERS],
    ...rows.map((r) => [
      r.placedAt,
      r.orderNumber,
      r.subOrderNumber,
      r.status,
      r.yourAmount,
      r.itemCount,
      r.payoutStatus,
      r.paidAt,
      r.payoutMode,
      r.transactionReference,
      r.transactionNotes,
      r.itemName,
      r.unit,
      r.qty,
      r.unitPrice,
      r.lineTotal,
    ]),
  ];
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function exportSalesReportCsv(
  report: SalesReport,
  payoutsBySubOrder: Record<string, PayoutExportInfo> = {},
): void {
  const matrix = toMatrix(buildRows(report, payoutsBySubOrder));
  const body = matrix.map((row) => row.map(csvEscape).join(',')).join('\n');
  downloadBlob(new Blob([body], { type: 'text/csv;charset=utf-8' }), `${fileBase(report)}.csv`);
}

export function exportSalesReportExcel(
  report: SalesReport,
  payoutsBySubOrder: Record<string, PayoutExportInfo> = {},
  summary?: ReportExportSummary,
): void {
  const wb = XLSX.utils.book_new();

  const summaryAoA: (string | number)[][] = [
    ['HyperLocalMart — Vendor sales report'],
    ['From', report.from],
    ['To', report.to],
    ['Orders', report.orderCount],
    ['Your sales', Number(report.grossSales ?? 0)],
    ['Settled to you', summary?.paidAmount ?? 0],
    ['Awaiting payout', summary?.unpaidAmount ?? 0],
    ['Units sold', report.itemQuantityTotal],
    [],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoA);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const detailSheet = XLSX.utils.aoa_to_sheet(toMatrix(buildRows(report, payoutsBySubOrder)));
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Orders');

  XLSX.writeFile(wb, `${fileBase(report)}.xlsx`);
}

export function exportSalesReportPdf(
  report: SalesReport,
  payoutsBySubOrder: Record<string, PayoutExportInfo> = {},
  summary?: ReportExportSummary,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 36;

  doc.setFontSize(14);
  doc.text('HyperLocalMart — Vendor sales report', margin, 40);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Period: ${report.from} → ${report.to}`, margin, 58);
  doc.text(
    [
      `Orders: ${report.orderCount}`,
      `Your sales: ${formatMoney(report.grossSales)}`,
      `Settled: ${formatMoney(summary?.paidAmount ?? 0)} (${summary?.paidOrders ?? 0})`,
      `Awaiting: ${formatMoney(summary?.unpaidAmount ?? 0)} (${summary?.unpaidOrders ?? 0})`,
    ].join('   ·   '),
    margin,
    74,
  );
  doc.setTextColor(0);

  const rows = buildRows(report, payoutsBySubOrder);
  autoTable(doc, {
    startY: 88,
    head: [[
      'Placed',
      'Order',
      'Status',
      'Amount',
      'Payout',
      'Paid at',
      'Mode',
      'Txn',
      ...(report.includeItems ? ['Item'] : []),
    ]],
    body: rows.map((r) => {
      const base = [
        r.placedAt || '—',
        `${r.orderNumber}\n${r.subOrderNumber}`,
        r.status,
        formatMoney(r.yourAmount),
        r.payoutStatus,
        r.paidAt || '—',
        r.payoutMode || '—',
        r.transactionReference || '—',
      ];
      if (report.includeItems) {
        base.push(
          r.itemName
            ? `${r.qty}× ${r.itemName}${r.unit ? ` (${r.unit})` : ''} · ${formatMoney(Number(r.lineTotal || 0))}`
            : '—',
        );
      }
      return base;
    }),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    margin: { left: margin, right: margin },
  });

  doc.save(`${fileBase(report)}.pdf`);
}
