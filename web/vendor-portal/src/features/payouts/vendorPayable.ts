import type { OrderCashHolder } from '@/features/reports/api/payoutsApi';
import { resolveCashHolder } from '@/features/reports/api/payoutsApi';
import type { SalesReportRow } from '@/features/reports/api/reportsApi';

export type PayableRow = Pick<
  SalesReportRow,
  'subOrderId' | 'status' | 'subtotal' | 'paymentMethod' | 'vendorAgentDelivery'
>;

export type PayoutFlag = { paid?: boolean; amount?: number | null };

export function isRejectedSalesStatus(status: string | null | undefined): boolean {
  return status === 'VENDOR_REJECTED' || status === 'REJECTED';
}

export function isClosedSalesStatus(status: string | null | undefined): boolean {
  return isRejectedSalesStatus(status) || status === 'BUYER_CANCELLED';
}

/** Admin / hub settlement is only due after the bag is delivered. */
export function isPayoutDueStatus(status: string | null | undefined): boolean {
  return status === 'DELIVERED';
}

export function isUnpaidDelivered(row: PayableRow, payout?: PayoutFlag | null): boolean {
  if (isClosedSalesStatus(row.status)) return false;
  if (!isPayoutDueStatus(row.status)) return false;
  return !payout?.paid;
}

/**
 * Shop already has the buyer cash (own-agent COD) so admin does not pay the bag.
 * Mirrors payment-service SettlementService.vendorHoldsBuyerCash.
 */
export function isShopHeldCash(holder: {
  paymentMethod?: string | null;
  vendorAgentDelivery?: boolean;
  codCashLocation?: string | null;
}): boolean {
  if ((holder.paymentMethod ?? '').toUpperCase() !== 'COD') return false;
  const loc = holder.codCashLocation || 'WITH_AGENT';
  if (loc === 'WITH_VENDOR' || loc === 'DECLARED_TO_VENDOR') return true;
  if (holder.vendorAgentDelivery) return loc !== 'AT_HUB' && loc !== 'DECLARED_TO_HUB';
  return false;
}

export function rowIsShopHeld(
  row: PayableRow,
  apiHolder?: OrderCashHolder | null,
): boolean {
  return isShopHeldCash(resolveCashHolder(row, apiHolder));
}

export type PayableTotals = {
  amount: number;
  count: number;
};

export function computeUnpaidDelivered(
  rows: PayableRow[],
  payouts: Record<string, PayoutFlag | undefined> = {},
): PayableTotals {
  let amount = 0;
  let count = 0;
  for (const row of rows) {
    if (!isUnpaidDelivered(row, payouts[row.subOrderId])) continue;
    amount += Number(row.subtotal ?? 0);
    count += 1;
  }
  return { amount, count };
}

/**
 * Money admin still owes the shop: delivered, unpaid, and KoyaKart (not the shop) holds the cash.
 * Home "Money waiting" and Payouts "KoyaKart pays you" use this.
 */
export function computeAdminPayoutDue(
  rows: PayableRow[],
  payouts: Record<string, PayoutFlag | undefined> = {},
  holders: Record<string, OrderCashHolder | undefined> = {},
): PayableTotals {
  let amount = 0;
  let count = 0;
  for (const row of rows) {
    if (!isUnpaidDelivered(row, payouts[row.subOrderId])) continue;
    if (rowIsShopHeld(row, holders[row.subOrderId])) continue;
    amount += Number(row.subtotal ?? 0);
    count += 1;
  }
  return { amount, count };
}

export function adminPayoutHint(totals: PayableTotals): string {
  if (totals.count <= 0) return 'No delivered bags waiting for payout';
  return `${totals.count} delivered bag${totals.count === 1 ? '' : 's'} not yet paid by admin`;
}

export function awaitingDeliveredRows<T extends PayableRow>(
  rows: T[],
  payouts: Record<string, PayoutFlag | undefined> = {},
): T[] {
  return rows.filter((row) => isUnpaidDelivered(row, payouts[row.subOrderId]));
}
