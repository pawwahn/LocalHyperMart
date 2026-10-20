import { describe, expect, it } from 'vitest';
import {
  nextStepLine,
  paymentStatusLine,
  siblingStatusLine,
  vendorOrderSituation,
} from './orderStatusCopy';

const screenshotBag = {
  status: 'READY_FOR_PICKUP',
  subOrderNumber: 'CLX/AP-031026-0001-1/2',
  wholeOrderForShop: true,
  vendorAgentDeliveryEnabled: true,
  vendorAgentDelivery: false,
  townHubEnabled: true,
  paymentMethod: 'COD',
  paymentStatus: 'PENDING',
  siblingShops: [{ shopName: 'R K Fancacy', status: 'VENDOR_REJECTED' }],
};

describe('siblingStatusLine', () => {
  it('names the shop that rejected (screenshot 3 Oct bag)', () => {
    expect(siblingStatusLine(screenshotBag)).toBe(
      'R K Fancacy rejected their items — only yours remains.',
    );
  });

  it('names a buyer-cancelled sibling', () => {
    expect(
      siblingStatusLine({
        status: 'READY_FOR_PICKUP',
        subOrderNumber: 'ORD-1-1/2',
        siblingShops: [{ shopName: 'Kirana', status: 'BUYER_CANCELLED' }],
      }),
    ).toBe('Kirana: buyer cancelled — only yours remains.');
  });

  it('shows an active sibling still packing without claiming only-yours', () => {
    expect(
      siblingStatusLine({
        status: 'PLACED',
        subOrderNumber: 'ORD-1-1/2',
        wholeOrderForShop: false,
        siblingShops: [{ shopName: 'Kirana', status: 'PLACED' }],
      }),
    ).toBe('Kirana still packing.');
  });

  it('joins two sibling shops', () => {
    expect(
      siblingStatusLine({
        status: 'READY_FOR_PICKUP',
        subOrderNumber: 'ORD-1-1/3',
        siblingShops: [
          { shopName: 'A Mart', status: 'VENDOR_REJECTED' },
          { shopName: 'B Mart', status: 'READY_FOR_PICKUP' },
        ],
      }),
    ).toBe('A Mart rejected their items · B Mart is also ready.');
  });

  it('falls back to the generic bag hint when siblings are unknown', () => {
    expect(
      siblingStatusLine({
        status: 'READY_FOR_PICKUP',
        subOrderNumber: 'CLX/AP-031026-0001-1/2',
        wholeOrderForShop: true,
        siblingShops: [],
      }),
    ).toMatch(/no longer active/);
  });
});

describe('paymentStatusLine', () => {
  it('labels COD waiting to be collected', () => {
    expect(paymentStatusLine('COD', 'PENDING')).toBe('COD due on delivery');
  });

  it('labels paid online vs collected COD', () => {
    expect(paymentStatusLine('ONLINE', 'PAID')).toBe('Paid online');
    expect(paymentStatusLine('COD', 'PAID')).toBe('COD collected');
  });
});

describe('nextStepLine', () => {
  it('tells a Ready vendor to wait for hub or send their agent', () => {
    expect(nextStepLine(screenshotBag)).toBe('Next: wait for hub pickup, or send your agent.');
  });

  it('tells a Ready vendor to wait for hub when they cannot send an agent', () => {
    expect(
      nextStepLine({
        ...screenshotBag,
        vendorAgentDeliveryEnabled: false,
      }),
    ).toBe('Next: wait for hub pickup.');
  });

  it('tells a New bag to pack', () => {
    expect(
      nextStepLine({
        status: 'PLACED',
        subOrderNumber: 'ORD-1-1/1',
      }),
    ).toBe('Next: pack, then Mark ready or Reject.');
  });

  it('tells vendor-agent bags to assign when needed', () => {
    expect(
      nextStepLine({
        status: 'DELIVERY_BY_VENDOR_AGENT',
        subOrderNumber: 'ORD-1-1/1',
        canAssignVendorAgent: true,
      }),
    ).toBe('Next: assign your delivery agent.');
  });
});

describe('vendorOrderSituation', () => {
  it('bundles sibling, pay, and next step for the screenshot bag', () => {
    expect(vendorOrderSituation(screenshotBag)).toEqual({
      siblingLine: 'R K Fancacy rejected their items — only yours remains.',
      siblingAlert: true,
      nextStep: 'Next: wait for hub pickup, or send your agent.',
      paymentLine: 'COD due on delivery',
    });
  });
});
