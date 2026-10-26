import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatPdfMoney } from '@/features/reports/api/reportExport';
import type { VendorGstReport } from '@/features/reports/api/gstReportsApi';
import {
  SERVICE_SAC,
  SERVICE_GST_PERCENT,
  resolveTaxPlace,
  serviceInvoiceNumber,
  splitInclusiveServiceGst,
  type BillParty,
} from '@/features/payouts/vendorBill';
import {
  collectionFeeBreakdown,
  isSubscriptionSettlement,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';

export type GstFilingMeta = {
  shopName: string;
  gstin: string;
  from: string;
  to: string;
  /** Vendor state code (POS for intra-state B2C). */
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  /** KoyaKart / marketplace operator GSTIN (Table 7 e-commerce column). */
  eCommerceGstin: string;
};

export type Gstr1B2csRow = {
  supplyType: 'INTRA' | 'INTER';
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  rate: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function effectiveRate(taxable: number, cgst: number, sgst: number, igst: number): number {
  if (taxable <= 0) return 0;
  return round2(((cgst + sgst + igst) / taxable) * 100);
}

/** GSTR-1 Table 7 B2CS-style rows (B2C supplies, consolidated by rate & intra/inter). */
export function buildGstr1B2csRows(gst: VendorGstReport, meta: GstFilingMeta): Gstr1B2csRow[] {
  type Acc = { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
  const buckets = new Map<string, Acc & { supplyType: 'INTRA' | 'INTER'; rate: number; posCode: string; posName: string }>();

  function ingest(rate: number, taxable: number, cgst: number, sgst: number, igst: number, cess: number) {
    const inter = igst > 0.005 && cgst + sgst < 0.005;
    const supplyType: 'INTRA' | 'INTER' = inter ? 'INTER' : 'INTRA';
    const posCode = inter ? '97' : meta.placeOfSupplyCode || '—';
    const posName = inter ? 'Other Territory (consolidated — verify POS)' : meta.placeOfSupplyName || '—';
    const key = `${supplyType}|${rate}|${posCode}`;
    const cur = buckets.get(key) ?? {
      supplyType,
      rate,
      posCode,
      posName,
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
    };
    cur.taxable = round2(cur.taxable + taxable);
    cur.igst = round2(cur.igst + igst);
    cur.cgst = round2(cur.cgst + cgst);
    cur.sgst = round2(cur.sgst + sgst);
    cur.cess = round2(cur.cess + cess);
    buckets.set(key, cur);
  }

  if (gst.lineDetails.length > 0) {
    for (const l of gst.lineDetails) {
      ingest(l.gstPercent, l.taxable, l.cgst, l.sgst, l.igst, l.cess);
    }
  } else {
    for (const d of gst.b2cDocuments) {
      const rate = effectiveRate(d.taxable, d.cgst, d.sgst, d.igst);
      ingest(rate, d.taxable, d.cgst, d.sgst, d.igst, d.cess);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.supplyType.localeCompare(b.supplyType) || a.rate - b.rate)
    .map((b) => ({
      supplyType: b.supplyType,
      placeOfSupplyCode: b.posCode,
      placeOfSupplyName: b.posName,
      rate: b.rate,
      taxable: b.taxable,
      igst: b.igst,
      cgst: b.cgst,
      sgst: b.sgst,
      cess: b.cess,
    }));
}

function gstr1B2csMatrix(meta: GstFilingMeta, gst: VendorGstReport): (string | number)[][] {
  const rows = buildGstr1B2csRows(gst, meta);
  return [
    [
      'Supply Type (INTRA/INTER)',
      'Place Of Supply — State code',
      'Place Of Supply — Name',
      'Rate (%)',
      'Taxable Value',
      'Integrated Tax',
      'Central Tax',
      'State/UT Tax',
      'Cess',
      'E-Commerce Operator GSTIN',
      'Supplier GSTIN',
      'Period From',
      'Period To',
    ],
    ...rows.map((r) => [
      r.supplyType,
      r.placeOfSupplyCode,
      r.placeOfSupplyName,
      r.rate,
      r.taxable,
      r.igst,
      r.cgst,
      r.sgst,
      r.cess,
      meta.eCommerceGstin || '',
      meta.gstin || '',
      meta.from,
      meta.to,
    ]),
  ];
}

export function exportGstr1B2cCsv(meta: GstFilingMeta, gst: VendorGstReport): void {
  const matrix = gstr1B2csMatrix(meta, gst);
  const body = matrix.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gstr1-b2cs-${meta.from}_to_${meta.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export type InputTaxRow = {
  invoiceNumber: string;
  paidDate: string;
  period: string;
  kind: string;
  serviceFeeInclGst: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

function serviceFeeForItc(s: VendorSettlement): number {
  if (isSubscriptionSettlement(s)) {
    return Number(s.commissionAmount ?? 0);
  }
  const dir = (s.direction ?? '').toUpperCase();
  if (dir === 'COLLECTION') {
    const b = collectionFeeBreakdown(s);
    return b.commission > 0 ? b.commission : Number(s.commissionAmount ?? 0);
  }
  return Number(s.commissionAmount ?? 0);
}

function settlementPaidDay(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function inRange(day: string, from: string, to: string): boolean {
  if (!day) return false;
  const d = day.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function buildInputTaxRows(
  settlements: VendorSettlement[],
  from: string,
  to: string,
  supplier: BillParty,
  recipient: BillParty,
): InputTaxRow[] {
  const place = resolveTaxPlace(supplier, recipient);
  const out: InputTaxRow[] = [];
  for (const s of settlements) {
    if (s.status !== 'PAID') continue;
    const paidDay = settlementPaidDay(s.paidAt);
    if (!inRange(paidDay, from, to)) continue;
    const fee = serviceFeeForItc(s);
    if (fee <= 0) continue;
    const tax = splitInclusiveServiceGst(fee, place.intraState);
    const kind = isSubscriptionSettlement(s)
      ? 'Subscription'
      : (s.direction ?? '').toUpperCase() === 'COLLECTION'
        ? 'Shop fee (collection)'
        : 'Payout fee';
    out.push({
      invoiceNumber: serviceInvoiceNumber(s),
      paidDate: paidDay,
      period: `${s.periodStart ?? '—'} – ${s.periodEnd ?? '—'}`,
      kind,
      serviceFeeInclGst: fee,
      taxable: tax.taxablePaise / 100,
      cgst: tax.cgstPaise / 100,
      sgst: tax.sgstPaise / 100,
      igst: tax.igstPaise / 100,
    });
  }
  return out.sort((a, b) => a.paidDate.localeCompare(b.paidDate));
}

function fileBase(meta: GstFilingMeta): string {
  return `vendor-gst-filing-${meta.from}_to_${meta.to}`;
}

export function exportVendorGstExcel(
  meta: GstFilingMeta,
  gst: VendorGstReport,
  inputTax: InputTaxRow[],
): void {
  const wb = XLSX.utils.book_new();
  const summary: (string | number)[][] = [
    ['KoyaKart — Vendor GST filing pack'],
    ['Shop', meta.shopName],
    ['GSTIN', meta.gstin || 'Not on file'],
    ['Period', `${meta.from} → ${meta.to}`],
    [],
    ['Outward supplies (delivered bags)', gst.deliveredBagCount],
    ['Taxable value', gst.taxableTotal],
    ['CGST', gst.cgstTotal],
    ['SGST', gst.sgstTotal],
    ['IGST', gst.igstTotal],
    ['Cess', gst.cessTotal],
    ['Total tax', gst.taxTotal],
    ['Invoice value (goods)', gst.invoiceValueTotal],
    [],
    ['Notes'],
    ['Use HSN and B2C sheets for GSTR-1 outward supply working.'],
    ['Use Input tax sheet for KoyaKart marketplace fee invoices (ITC working).'],
    ['Per-order customer tax PDFs: buyer app → order → Download invoice.'],
    ['GSTR-1 B2CS sheet: Table 7 B2C consolidated rows for portal / offline utility.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstr1B2csMatrix(meta, gst)), 'GSTR1 B2CS');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['HSN', 'GST%', 'Lines', 'Taxable', 'CGST', 'SGST', 'IGST', 'Cess', 'Amount'],
      ...gst.gstByHsn.map((r) => [
        r.hsn,
        r.gstPercent,
        r.lines,
        r.taxable,
        r.cgst,
        r.sgst,
        r.igst,
        r.cess,
        r.amount,
      ]),
    ]),
    'HSN summary',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Order', 'Sub-order', 'Delivered', 'Pay', 'Taxable', 'CGST', 'SGST', 'IGST', 'Cess', 'Value'],
      ...gst.b2cDocuments.map((r) => [
        r.orderNumber,
        r.subOrderNumber,
        r.deliveredDate,
        r.paymentMethod,
        r.taxable,
        r.cgst,
        r.sgst,
        r.igst,
        r.cess,
        r.invoiceValue,
      ]),
    ]),
    'B2C documents',
  );

  if (gst.lineDetails.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Order', 'Sub-order', 'Delivered', 'Item', 'HSN', 'GST%', 'Qty', 'Taxable', 'CGST', 'SGST', 'IGST', 'Cess', 'Line total'],
        ...gst.lineDetails.map((r) => [
          r.orderNumber,
          r.subOrderNumber,
          r.deliveredDate,
          r.itemName,
          r.hsn,
          r.gstPercent,
          r.quantity,
          r.taxable,
          r.cgst,
          r.sgst,
          r.igst,
          r.cess,
          r.lineTotal,
        ]),
      ]),
      'Line detail',
    );
  }

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Invoice no', 'Paid', 'Period', 'Type', `Fee incl GST (${SERVICE_GST_PERCENT}%)`, 'Taxable', 'CGST', 'SGST', 'IGST', 'SAC'],
      ...inputTax.map((r) => [
        r.invoiceNumber,
        r.paidDate,
        r.period,
        r.kind,
        r.serviceFeeInclGst,
        r.taxable,
        r.cgst,
        r.sgst,
        r.igst,
        SERVICE_SAC,
      ]),
    ]),
    'Input tax (KoyaKart)',
  );

  XLSX.writeFile(wb, `${fileBase(meta)}.xlsx`);
}

export function exportVendorGstCsv(meta: GstFilingMeta, gst: VendorGstReport, inputTax: InputTaxRow[]): void {
  const b2cs = buildGstr1B2csRows(gst, meta);
  const sections: string[] = [
    `# KoyaKart Vendor GST filing ${meta.from} to ${meta.to}`,
    `# Shop: ${meta.shopName} GSTIN: ${meta.gstin || '—'}`,
    '',
    '[HSN summary]',
    'HSN,GST%,Lines,Taxable,CGST,SGST,IGST,Cess,Amount',
    ...gst.gstByHsn.map((r) =>
      [r.hsn, r.gstPercent, r.lines, r.taxable, r.cgst, r.sgst, r.igst, r.cess, r.amount].join(','),
    ),
    '',
    '[B2C documents]',
    'Order,Sub-order,Delivered,Pay,Taxable,CGST,SGST,IGST,Cess,Value',
    ...gst.b2cDocuments.map((r) =>
      [r.orderNumber, r.subOrderNumber, r.deliveredDate, r.paymentMethod, r.taxable, r.cgst, r.sgst, r.igst, r.cess, r.invoiceValue].join(','),
    ),
    '',
    '[GSTR-1 B2CS (Table 7 B2C)]',
    'Supply Type,POS Code,POS Name,Rate,Taxable,IGST,CGST,SGST,Cess,ECO GSTIN,Supplier GSTIN,From,To',
    ...b2cs.map((r) =>
      [
        r.supplyType,
        r.placeOfSupplyCode,
        r.placeOfSupplyName,
        r.rate,
        r.taxable,
        r.igst,
        r.cgst,
        r.sgst,
        r.cess,
        meta.eCommerceGstin,
        meta.gstin,
        meta.from,
        meta.to,
      ].join(','),
    ),
    '',
    '[Input tax KoyaKart]',
    'Invoice,Paid,Period,Type,Fee incl GST,Taxable,CGST,SGST,IGST,SAC',
    ...inputTax.map((r) =>
      [r.invoiceNumber, r.paidDate, r.period, r.kind, r.serviceFeeInclGst, r.taxable, r.cgst, r.sgst, r.igst, SERVICE_SAC].join(','),
    ),
  ];
  const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase(meta)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportVendorGstPdf(
  meta: GstFilingMeta,
  gst: VendorGstReport,
  inputTax: InputTaxRow[],
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 36;
  doc.setFontSize(14);
  doc.text('KoyaKart — GST filing pack', margin, 40);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`${meta.shopName} · GSTIN ${meta.gstin || '—'} · ${meta.from} → ${meta.to}`, margin, 58);
  doc.text(
    `Outward: taxable ${formatPdfMoney(gst.taxableTotal)} · tax ${formatPdfMoney(gst.taxTotal)} · ${gst.deliveredBagCount} bags`,
    margin,
    74,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 88,
    head: [['HSN', 'GST%', 'Lines', 'Taxable', 'CGST', 'SGST', 'IGST', 'Value']],
    body: gst.gstByHsn.map((r) => [
      r.hsn,
      String(r.gstPercent),
      String(r.lines),
      formatPdfMoney(r.taxable),
      formatPdfMoney(r.cgst),
      formatPdfMoney(r.sgst),
      formatPdfMoney(r.igst),
      formatPdfMoney(r.amount),
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [22, 101, 52] },
    margin: { left: margin, right: margin },
  });

  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  autoTable(doc, {
    startY: y1,
    head: [['Invoice', 'Paid', 'Type', 'Fee incl GST', 'Taxable', 'CGST', 'SGST', 'IGST']],
    body: inputTax.map((r) => [
      r.invoiceNumber,
      r.paidDate,
      r.kind,
      formatPdfMoney(r.serviceFeeInclGst),
      formatPdfMoney(r.taxable),
      formatPdfMoney(r.cgst),
      formatPdfMoney(r.sgst),
      formatPdfMoney(r.igst),
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 120] },
    margin: { left: margin, right: margin },
  });

  doc.save(`${fileBase(meta)}.pdf`);
}
