import { describe, expect, it } from 'vitest';
import { canOfferVendorAgentDelivery } from './vendorOrderActions';
import { vendorBagDisplayNumber, vendorBagLabelHint } from './orderBagLabel';

describe('My agent delivers — when the button must show', () => {
  const base = {
    vendorAgentDeliveryEnabled: true,
    vendorAgentDelivery: false,
    wholeOrderForShop: true,
    townHubEnabled: true,
  };

  it('shows on New when the whole order is this shop', () => {
    expect(canOfferVendorAgentDelivery({ ...base, status: 'PLACED' })).toBe(true);
  });

  it('shows on Ready when sibling bags closed (screenshot 3 Oct bag)', () => {
    expect(canOfferVendorAgentDelivery({ ...base, status: 'READY_FOR_PICKUP' })).toBe(true);
  });

  it('hides on Ready while another shop bag is still active and hub is on', () => {
    expect(
      canOfferVendorAgentDelivery({
        ...base,
        status: 'READY_FOR_PICKUP',
        wholeOrderForShop: false,
        townHubEnabled: true,
      }),
    ).toBe(false);
  });

  it('shows on a split bag if the town has no hub', () => {
    expect(
      canOfferVendorAgentDelivery({
        ...base,
        status: 'PLACED',
        wholeOrderForShop: false,
        townHubEnabled: false,
      }),
    ).toBe(true);
  });

  it('hides after the shop already chose its agent, or town disables it', () => {
    expect(
      canOfferVendorAgentDelivery({ ...base, status: 'PLACED', vendorAgentDelivery: true }),
    ).toBe(false);
    expect(
      canOfferVendorAgentDelivery({
        ...base,
        status: 'PLACED',
        vendorAgentDeliveryEnabled: false,
      }),
    ).toBe(false);
  });

  it('hides on delivered, rejected, cancelled, and already-on-agent', () => {
    for (const status of [
      'DELIVERED',
      'VENDOR_REJECTED',
      'BUYER_CANCELLED',
      'DELIVERY_BY_VENDOR_AGENT',
    ]) {
      expect(canOfferVendorAgentDelivery({ ...base, status })).toBe(false);
    }
  });
});

describe('bag label after sibling reject', () => {
  it('shows 1/1 and a hint when DB still has 1/2', () => {
    expect(
      vendorBagDisplayNumber({
        subOrderNumber: 'CLX/AP-031026-0001-1/2',
        orderNumber: 'CLX/AP-031026-0001',
        wholeOrderForShop: true,
      }),
    ).toBe('CLX/AP-031026-0001-1/1');
    expect(
      vendorBagLabelHint({
        wholeOrderForShop: true,
        subOrderNumber: 'CLX/AP-031026-0001-1/2',
      }),
    ).toMatch(/no longer active/);
  });

  it('does not hint when the number is already 1/1', () => {
    expect(
      vendorBagLabelHint({
        wholeOrderForShop: true,
        subOrderNumber: 'CLX/AP-031026-0001-1/1',
      }),
    ).toBeNull();
  });
});
