import {
  resolveCashHolder,
  type OrderCashHolder,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';
import { isShopHeldCash, koyaKartPayoutGross } from '@/features/payouts/vendorPayable';
import type { SalesReportRow } from '@/features/reports/api/reportsApi';

export function shopPassThroughFees(row: SalesReportRow): number {
  return (
    Number(row.platformFeeAmount ?? 0) +
    Number(row.parlourPaymentFeeAmount ?? 0) +
    Number(row.codFeeAmount ?? 0) +
    Number(row.membershipFeeAmount ?? 0)
  );
}

function isShopHeld(holder: ReturnType<typeof resolveCashHolder>): boolean {
  return isShopHeldCash(holder);
}

export type SettledLineMoney = {
  map: Record<string, { fee: number; collection: boolean }>;
  claims: Record<string, number>;
};

/** Settlement commission spread over its bags by bag value. */
export function buildSettledLineMoney(settlements: VendorSettlement[]): SettledLineMoney {
  const map: Record<string, { fee: number; collection: boolean }> = {};
  const claims: Record<string, number> = {};
  for (const s of settlements) {
    const lines = s.lines ?? [];
    const orderLines = lines.filter((l) => {
      const t = (l.lineType ?? '').toUpperCase();
      return (t === 'ORDER' || t === '') && l.subOrderId;
    });
    for (const l of lines) {
      if ((l.lineType ?? '').toUpperCase() === 'ADJUSTMENT' && l.subOrderId) {
        claims[l.subOrderId] = (claims[l.subOrderId] ?? 0) + Math.abs(Number(l.amount ?? 0));
      }
    }
    const gross = orderLines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
    const totalFee = Number(s.commissionAmount ?? 0);
    const collection = (s.direction ?? '').toUpperCase() === 'COLLECTION';
    let allocated = 0;
    orderLines.forEach((l, i) => {
      const fee =
        i === orderLines.length - 1
          ? Math.round((totalFee - allocated) * 100) / 100
          : gross > 0
            ? Math.round(((totalFee * Number(l.amount ?? 0)) / gross) * 100) / 100
            : 0;
      allocated += fee;
      map[l.subOrderId as string] = { fee, collection };
    });
  }
  return { map, claims };
}

export type OrderMoney = {
  amount: number;
  paid: boolean;
  shopHeld: boolean;
  fee: number | null;
  claim: number;
  net: number | null;
  owed: number;
};

export function computeOrderMoney(
  row: SalesReportRow,
  ctx: {
    payouts: Record<string, { paid?: boolean } | undefined>;
    settled: SettledLineMoney;
    rowFees: Record<string, number>;
    cashHolders: Record<string, OrderCashHolder | undefined>;
  },
): OrderMoney {
  const amount = koyaKartPayoutGross(row);
  const paid = Boolean(ctx.payouts[row.subOrderId]?.paid);
  const settled = ctx.settled.map[row.subOrderId];
  const claim = ctx.settled.claims[row.subOrderId] ?? 0;
  const shopHeld = paid
    ? Boolean(settled?.collection)
    : isShopHeld(resolveCashHolder(row, ctx.cashHolders[row.subOrderId]));
  // Unpaid shop COD: rowFees = commercial only (quote API) + pass-through from order row.
  // Paid COLLECTION: settlement commissionAmount already includes platform/COD/plan — do not add again.
  const commercialOrTotal = paid ? settled?.fee : ctx.rowFees[row.subOrderId];
  const passThrough =
    shopHeld && !(paid && settled?.collection) ? shopPassThroughFees(row) : 0;
  const fee = commercialOrTotal == null ? null : commercialOrTotal + passThrough;
  const net = fee == null ? null : amount - fee - claim;
  const owed = !paid && shopHeld ? (commercialOrTotal ?? 0) + passThrough : 0;
  return { amount, paid, shopHeld, fee, claim, net, owed };
}
