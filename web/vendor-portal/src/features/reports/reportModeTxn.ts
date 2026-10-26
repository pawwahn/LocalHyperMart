import { isShopHeldCash } from '@/features/payouts/vendorPayable';
import type { SalesReportRow } from './api/reportsApi';

export type ModeTxnPayout = {
  paid?: boolean;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  transactionNotes?: string | null;
};

export function salesRowShopHeld(row: SalesReportRow): boolean {
  return isShopHeldCash({
    paymentMethod: row.paymentMethod,
    vendorAgentDelivery: row.vendorAgentDelivery,
    codCashLocation: null,
  });
}

/** Buyer payment — not KoyaKart payout / shop COD bill. */
export function buyerPaymentHeadline(row: SalesReportRow): string {
  const method = (row.paymentMethod ?? '').trim().toUpperCase();
  const label =
    method === 'COD' ? 'COD' : method === 'ONLINE' || method === 'UPI' ? 'UPI / Online' : row.paymentMethod ?? '—';
  const st = (row.paymentStatus ?? '').trim().toUpperCase();
  if (st === 'PAID') return `${label} · Buyer paid`;
  if (st === 'PENDING') return `${label} · Buyer pending`;
  if (st === 'REFUNDED' || st === 'REFUND_DUE') return `${label} · Refunded`;
  return label;
}

export function buyerPaymentSubline(row: SalesReportRow, shopHeld: boolean): string | null {
  if (shopHeld) return 'Cash at shop';
  const method = (row.paymentMethod ?? '').trim().toUpperCase();
  if (method === 'COD') return 'COD via hub / agent';
  return null;
}

/** Mode / txn column: settlement ref when closed; otherwise buyer pay mode only. */
export function modeTxnFields(
  row: SalesReportRow,
  payout?: ModeTxnPayout | null,
): { primary: string; secondary: string | null; tertiary: string | null } {
  if (payout?.paid) {
    return {
      primary: (payout.payoutMethod ?? '—').trim() || '—',
      secondary: payout.transactionReference?.trim() || 'No txn ref',
      tertiary: payout.transactionNotes?.trim() || null,
    };
  }
  const shopHeld = salesRowShopHeld(row);
  return {
    primary: buyerPaymentHeadline(row),
    secondary: buyerPaymentSubline(row, shopHeld),
    tertiary: null,
  };
}
