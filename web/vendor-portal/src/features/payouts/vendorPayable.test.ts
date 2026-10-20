import { describe, expect, it } from 'vitest';
import type { OrderCashHolder } from '@/features/reports/api/payoutsApi';
import {
  adminPayoutHint,
  awaitingDeliveredRows,
  computeAdminPayoutDue,
  computeUnpaidDelivered,
  isClosedSalesStatus,
  isPayoutDueStatus,
  isRejectedSalesStatus,
  isShopHeldCash,
  isUnpaidDelivered,
  rowIsShopHeld,
} from './vendorPayable';

function row(
  id: string,
  status: string,
  subtotal: number,
  extra: { paymentMethod?: string; vendorAgentDelivery?: boolean } = {},
) {
  return {
    subOrderId: id,
    status,
    subtotal,
    paymentMethod: extra.paymentMethod ?? 'COD',
    vendorAgentDelivery: extra.vendorAgentDelivery ?? false,
  };
}

const unpaid = {};
const paid = (id: string) => ({ [id]: { paid: true, amount: 100 } });

describe('payable status rules', () => {
  it('rejects and buyer-cancel are closed, not payable', () => {
    expect(isRejectedSalesStatus('VENDOR_REJECTED')).toBe(true);
    expect(isRejectedSalesStatus('REJECTED')).toBe(true);
    expect(isClosedSalesStatus('BUYER_CANCELLED')).toBe(true);
    expect(isPayoutDueStatus('BUYER_CANCELLED')).toBe(false);
    expect(isUnpaidDelivered(row('a', 'VENDOR_REJECTED', 410), undefined)).toBe(false);
    expect(isUnpaidDelivered(row('a', 'BUYER_CANCELLED', 410), undefined)).toBe(false);
  });

  it('open bags are not payout-due', () => {
    for (const status of ['PLACED', 'READY_FOR_PICKUP', 'DELIVERY_BY_VENDOR_AGENT']) {
      expect(isPayoutDueStatus(status)).toBe(false);
      expect(isUnpaidDelivered(row('a', status, 860))).toBe(false);
    }
  });

  it('delivered unpaid is payout-due; delivered paid is not', () => {
    expect(isPayoutDueStatus('DELIVERED')).toBe(true);
    expect(isUnpaidDelivered(row('a', 'DELIVERED', 800))).toBe(true);
    expect(isUnpaidDelivered(row('a', 'DELIVERED', 800), { paid: true })).toBe(false);
  });
});

describe('Home money waiting vs Payouts / Reports (screenshot regression)', () => {
  const screenshotRows = [
    row('new-today', 'PLACED', 860),
    row('new-19', 'PLACED', 410),
    row('new-17', 'PLACED', 410),
    row('ready-3oct', 'READY_FOR_PICKUP', 800),
  ];

  it('does not count the four undelivered COD bags as money waiting', () => {
    const home = computeAdminPayoutDue(screenshotRows, unpaid);
    const reports = computeUnpaidDelivered(screenshotRows, unpaid);
    const payouts = awaitingDeliveredRows(screenshotRows, unpaid);
    expect(home).toEqual({ amount: 0, count: 0 });
    expect(reports).toEqual({ amount: 0, count: 0 });
    expect(payouts).toEqual([]);
    expect(adminPayoutHint(home)).toBe('No delivered bags waiting for payout');
  });

  it('Home, Reports awaiting, and Payouts unpaid rows stay equal on a mixed day', () => {
    const rows = [
      ...screenshotRows,
      row('delivered-unpaid-hub', 'DELIVERED', 500, { paymentMethod: 'COD' }),
      row('delivered-paid', 'DELIVERED', 200),
      row('rejected', 'VENDOR_REJECTED', 90),
      row('cancelled', 'BUYER_CANCELLED', 70),
      row('upi-unpaid', 'DELIVERED', 150, { paymentMethod: 'UPI' }),
    ];
    const payouts = { ...paid('delivered-paid') };
    const reports = computeUnpaidDelivered(rows, payouts);
    const awaiting = awaitingDeliveredRows(rows, payouts);
    expect(reports).toEqual({ amount: 650, count: 2 });
    expect(awaiting.map((r) => r.subOrderId)).toEqual(['delivered-unpaid-hub', 'upi-unpaid']);
    expect(computeAdminPayoutDue(rows, payouts)).toEqual({ amount: 650, count: 2 });
    expect(adminPayoutHint({ amount: 650, count: 2 })).toBe(
      '2 delivered bags not yet paid by admin',
    );
  });
});

describe('shop-held COD vs admin payout', () => {
  it('UPI is never shop-held — admin still owes the delivered bag', () => {
    const r = row('upi', 'DELIVERED', 199, { paymentMethod: 'UPI' });
    expect(rowIsShopHeld(r)).toBe(false);
    expect(computeAdminPayoutDue([r])).toEqual({ amount: 199, count: 1 });
  });

  it('hub COD delivered unpaid is admin payout (KoyaKart holds / pays vendor)', () => {
    const r = row('hub', 'DELIVERED', 300, { paymentMethod: 'COD', vendorAgentDelivery: false });
    expect(rowIsShopHeld(r)).toBe(false);
    expect(computeAdminPayoutDue([r])).toEqual({ amount: 300, count: 1 });
    expect(computeUnpaidDelivered([r])).toEqual({ amount: 300, count: 1 });
  });

  it('shop-agent COD delivered unpaid is not money waiting for admin', () => {
    const r = row('shop', 'DELIVERED', 275, { paymentMethod: 'COD', vendorAgentDelivery: true });
    expect(rowIsShopHeld(r)).toBe(true);
    expect(computeUnpaidDelivered([r])).toEqual({ amount: 275, count: 1 });
    expect(computeAdminPayoutDue([r])).toEqual({ amount: 0, count: 0 });
  });

  it('API holder WITH_VENDOR wins over inference', () => {
    const r = row('hub-declared', 'DELIVERED', 80, { paymentMethod: 'COD', vendorAgentDelivery: false });
    const holder: OrderCashHolder = {
      subOrderId: r.subOrderId,
      paymentMethod: 'COD',
      vendorAgentDelivery: false,
      codCashLocation: 'WITH_VENDOR',
      holderRole: 'VENDOR',
      holderLabel: 'Shop',
    };
    expect(isShopHeldCash(holder)).toBe(true);
    expect(computeAdminPayoutDue([r], {}, { [r.subOrderId]: holder })).toEqual({
      amount: 0,
      count: 0,
    });
  });

  it('shop-agent bag later at hub is paid by admin', () => {
    const r = row('returned-hub', 'DELIVERED', 60, { paymentMethod: 'COD', vendorAgentDelivery: true });
    const holder: OrderCashHolder = {
      subOrderId: r.subOrderId,
      paymentMethod: 'COD',
      vendorAgentDelivery: true,
      codCashLocation: 'AT_HUB',
      holderRole: 'HUB_ADMIN',
      holderLabel: 'Hub',
    };
    expect(isShopHeldCash(holder)).toBe(false);
    expect(computeAdminPayoutDue([r], {}, { [r.subOrderId]: holder })).toEqual({
      amount: 60,
      count: 1,
    });
  });
});
