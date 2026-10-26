import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPdfMoney } from '@/features/reports/api/reportExport';
import type { SalesReportRow } from '@/features/reports/api/reportsApi';
import type { OrderCashHolder, OrderPayout, VendorSettlement } from '@/features/reports/api/payoutsApi';
import { buildSettledLineMoney, computeOrderMoney } from '@/features/payouts/payoutOrderMoney';

function payoutAt(row: SalesReportRow): string | null | undefined {
  return row.deliveredAt || row.placedAt;
}

function shortWhen(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseDay(value?: string | null): Date | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDay(value?: string | null): string {
  const d = parseDay(value);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPeriodRange(start?: string | null, end?: string | null): string {
  const a = parseDay(start);
  const b = parseDay(end ?? start);
  if (!a && !b) return '—';
  if (!a) return formatDay(end);
  if (!b) return formatDay(start);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === b.getDate()) return formatDay(start);
  if (sameMonth) {
    const monthYear = a.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return `${a.getDate()}–${b.getDate()} ${monthYear}`;
  }
  if (sameYear) {
    const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${left} – ${right}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}`;
}

type PayoutPdfTotals = {
  gross: number;
  fee: number;
  net: number;
  toKk: number;
};

function sumOrderMoney(
  rows: SalesReportRow[],
  ctx: Parameters<typeof computeOrderMoney>[1],
): PayoutPdfTotals {
  const out = { gross: 0, fee: 0, net: 0, toKk: 0 };
  for (const row of rows) {
    const m = computeOrderMoney(row, ctx);
    out.gross += m.amount;
    out.fee += m.fee ?? 0;
    out.net += m.net ?? m.amount;
    if (m.owed > 0) out.toKk += m.owed;
    else if (m.paid && (m.fee ?? 0) > 0) out.toKk += m.fee ?? 0;
  }
  return {
    gross: Math.round(out.gross * 100) / 100,
    fee: Math.round(out.fee * 100) / 100,
    net: Math.round(out.net * 100) / 100,
    toKk: Math.round(out.toKk * 100) / 100,
  };
}

export function downloadPayoutsOrdersPdf(input: {
  from: string;
  to: string;
  paneLabel: string;
  rows: SalesReportRow[];
  payouts: Record<string, OrderPayout>;
  settlements: VendorSettlement[];
  rowFees: Record<string, number>;
  cashHolders: Record<string, OrderCashHolder | undefined>;
}): void {
  const { from, to, paneLabel, rows, payouts, settlements, rowFees, cashHolders } = input;
  if (rows.length === 0) return;

  const settled = buildSettledLineMoney(settlements);
  const moneyCtx = { payouts, settled, rowFees, cashHolders };
  const totals = sumOrderMoney(rows, moneyCtx);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 36;
  const title = `KoyaKart — Payouts (${paneLabel})`;
  const filePrefix = `vendor-payouts-${paneLabel.replace(/\s+/g, '-').toLowerCase()}`;
  const periodLabel = `${from || '—'} → ${to || '—'}`;

  doc.setFontSize(14);
  doc.text(title, margin, 40);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Period: ${periodLabel}`, margin, 58);
  doc.text(
    [
      `Bags: ${rows.length}`,
      `Bag total: ${formatPdfMoney(totals.gross)}`,
      `Commission & fees: ${formatPdfMoney(totals.fee)}`,
      `Net earnings: ${formatPdfMoney(totals.net)}`,
    ].join('   ·   '),
    margin,
    74,
  );
  doc.setTextColor(0);

  const body = rows.map((row) => {
    const m = computeOrderMoney(row, moneyCtx);
    const payout = payouts[row.subOrderId];
    const deliveredLine = `${shortWhen(payoutAt(row))}\nPlaced ${shortWhen(row.placedAt)}`;
    const orderLine = `${row.orderNumber}\n${row.subOrderNumber}`;
    const pay = (row.paymentMethod || '—').toUpperCase();
    const bagTotal = formatPdfMoney(m.amount);

    let commission = '—';
    if (m.fee != null) {
      commission = `- ${formatPdfMoney(m.fee)}`;
      if (m.claim > 0) commission += `\nClaim - ${formatPdfMoney(m.claim)}`;
    }

    let netEarnings = '—';
    if (m.net != null) {
      const note = m.shopHeld
        ? m.paid
          ? 'Cash in shop · fee paid'
          : 'Cash in shop'
        : m.paid
          ? 'Received'
          : 'KoyaKart yet to pay';
      netEarnings = `${formatPdfMoney(m.net)}\n${note}`;
    }

    let toKoyaKart = '—';
    if (m.owed > 0) {
      toKoyaKart = `${formatPdfMoney(m.owed)}\nFee to pay`;
    } else if (m.paid && m.fee != null && m.fee > 0) {
      toKoyaKart = `${formatPdfMoney(m.fee)}\nPaid to KoyaKart`;
    }

    let payoutCell: string;
    if (m.paid) {
      const when = payout?.paidAt ? shortWhen(payout.paidAt) : '—';
      const refLine = [
        formatPeriodRange(payout?.periodStart, payout?.periodEnd),
        payout?.payoutMethod ?? '—',
        payout?.transactionReference ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
      payoutCell = `PAID ${when}\n${refLine}`;
    } else if (m.shopHeld) {
      payoutCell = 'Unsettled (shop COD bill)';
    } else {
      payoutCell = 'Unpaid';
    }

    return [deliveredLine, orderLine, pay, bagTotal, commission, netEarnings, toKoyaKart, payoutCell];
  });

  body.push([
    `Total · ${rows.length} bag${rows.length === 1 ? '' : 's'}`,
    '',
    '',
    formatPdfMoney(totals.gross),
    `- ${formatPdfMoney(totals.fee)}`,
    formatPdfMoney(totals.net),
    totals.toKk > 0 ? formatPdfMoney(totals.toKk) : '—',
    '',
  ]);

  autoTable(doc, {
    startY: 88,
    head: [['Delivered', 'Order', 'Pay', 'Bag total', 'Commission', 'Net earnings', 'To KoyaKart', 'Payout']],
    body,
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [235, 241, 235];
      }
    },
  });

  doc.save(`${filePrefix}.pdf`);
}
