import { describe, expect, it } from 'vitest';
import { computeOrderMoney, buildSettledLineMoney } from '@/features/payouts/payoutOrderMoney';
import type { SalesReportRow } from '@/features/reports/api/reportsApi';
import type { VendorSettlement } from '@/features/reports/api/payoutsApi';

function row(over: Partial<SalesReportRow> & Pick<SalesReportRow, 'subOrderId'>): SalesReportRow {
  return {
    subOrderId: over.subOrderId,
    subOrderNumber: over.subOrderNumber ?? `${over.subOrderId}-1/1`,
    orderId: over.orderId ?? 'o1',
    orderNumber: over.orderNumber ?? 'ORD-1',
    status: over.status ?? 'DELIVERED',
    subtotal: over.subtotal ?? 576,
    itemCount: over.itemCount ?? 1,
    paymentMethod: over.paymentMethod ?? 'COD',
    vendorAgentDelivery: over.vendorAgentDelivery ?? true,
    platformFeeAmount: over.platformFeeAmount ?? 40,
    codFeeAmount: over.codFeeAmount ?? 23,
    membershipFeeAmount: over.membershipFeeAmount ?? 199,
    ...over,
  };
}

describe('computeOrderMoney', () => {
  it('does not double-count pass-through on paid shop COLLECTION settlements', () => {
    const subOrderId = 'sub-1';
    const settlements: VendorSettlement[] = [
      {
        id: 's1',
        direction: 'COLLECTION',
        commissionAmount: 262.84,
        lines: [
          { id: 'l1', subOrderId, lineType: 'ORDER', amount: 576 },
          { id: 'l2', lineType: 'COMMISSION', amount: 51.84 },
          { id: 'l3', lineType: 'PLATFORM_FEE', amount: 40 },
          { id: 'l4', lineType: 'COD_FEE', amount: 23 },
          { id: 'l5', lineType: 'MEMBERSHIP_FEE', amount: 199 },
        ],
      },
    ];
    const settled = buildSettledLineMoney(settlements);
    const m = computeOrderMoney(row({ subOrderId }), {
      payouts: { [subOrderId]: { paid: true } },
      settled,
      rowFees: {},
      cashHolders: {},
    });
    expect(m.shopHeld).toBe(true);
    expect(m.fee).toBeCloseTo(262.84, 2);
    expect(m.net).toBeCloseTo(576 - 262.84, 2);
  });

  it('adds pass-through for unpaid shop-held COD using quote commission', () => {
    const subOrderId = 'sub-2';
    const m = computeOrderMoney(row({ subOrderId }), {
      payouts: {},
      settled: buildSettledLineMoney([]),
      rowFees: { [subOrderId]: 51.84 },
      cashHolders: {
        [subOrderId]: {
          subOrderId,
          paymentMethod: 'COD',
          vendorAgentDelivery: true,
          codCashLocation: 'WITH_VENDOR',
          holderRole: 'VENDOR',
          holderLabel: 'Shop',
        },
      },
    });
    expect(m.fee).toBeCloseTo(51.84 + 40 + 23 + 199, 2);
  });
});
