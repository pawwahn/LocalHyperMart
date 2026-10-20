import { canOfferVendorAgentDelivery } from './vendorOrderActions';
import { vendorBagLabelHint } from './orderBagLabel';

export type SiblingShop = {
  shopName: string;
  status: string;
};

export type VendorOrderSituationInput = {
  status: string;
  subOrderNumber: string;
  wholeOrderForShop?: boolean;
  vendorAgentDeliveryEnabled?: boolean;
  vendorAgentDelivery?: boolean;
  townHubEnabled?: boolean;
  canAssignVendorAgent?: boolean;
  vendorDirectAgentName?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  siblingShops?: SiblingShop[];
};

export type VendorOrderSituation = {
  siblingLine: string | null;
  siblingAlert: boolean;
  nextStep: string | null;
  paymentLine: string | null;
};

const CLOSED_SIBLING = new Set(['VENDOR_REJECTED', 'BUYER_CANCELLED', 'REJECTED', 'CANCELLED']);

function siblingPhrase(shop: SiblingShop): string {
  const name = (shop.shopName || 'Another shop').trim() || 'Another shop';
  switch ((shop.status || '').toUpperCase()) {
    case 'VENDOR_REJECTED':
    case 'REJECTED':
      return `${name} rejected their items`;
    case 'BUYER_CANCELLED':
      return `${name}: buyer cancelled`;
    case 'CANCELLED':
      return `${name} cancelled`;
    case 'PLACED':
      return `${name} still packing`;
    case 'READY_FOR_PICKUP':
      return `${name} is also ready`;
    case 'DELIVERY_BY_VENDOR_AGENT':
      return `${name} sending their agent`;
    case 'DELIVERED':
      return `${name} delivered`;
    default: {
      const raw = (shop.status || '').replace(/_/g, ' ').toLowerCase();
      return raw ? `${name}: ${raw}` : name;
    }
  }
}

export function siblingStatusLine(order: VendorOrderSituationInput): string | null {
  const shops = order.siblingShops ?? [];
  if (shops.length === 0) {
    return vendorBagLabelHint(order);
  }
  const joined = shops.map(siblingPhrase).join(' · ');
  const allClosed = shops.every((s) => CLOSED_SIBLING.has((s.status || '').toUpperCase()));
  if (allClosed) {
    return `${joined} — only yours remains.`;
  }
  return `${joined}.`;
}

export function paymentStatusLine(
  paymentMethod?: string | null,
  paymentStatus?: string | null,
): string | null {
  const method = (paymentMethod || '').toUpperCase();
  const status = (paymentStatus || '').toUpperCase();
  if (!method && !status) return null;
  if (method === 'COD') {
    if (status === 'PAID') return 'COD collected';
    if (status === 'REFUNDED') return 'COD refunded';
    if (status === 'FAILED') return 'COD failed';
    return 'COD due on delivery';
  }
  if (method === 'ONLINE') {
    if (status === 'PAID') return 'Paid online';
    if (status === 'REFUNDED') return 'Refunded';
    if (status === 'FAILED') return 'Online payment failed';
    return 'Online payment pending';
  }
  if (status === 'PAID') return 'Paid';
  if (status === 'PENDING') return 'Payment pending';
  if (status === 'REFUNDED') return 'Refunded';
  if (status === 'FAILED') return 'Payment failed';
  return method || status || null;
}

export function nextStepLine(order: VendorOrderSituationInput): string | null {
  switch ((order.status || '').toUpperCase()) {
    case 'PLACED':
      return 'Next: pack, then Mark ready or Reject.';
    case 'READY_FOR_PICKUP':
      if (canOfferVendorAgentDelivery(order)) {
        return 'Next: wait for hub pickup, or send your agent.';
      }
      if (order.townHubEnabled === false) {
        return 'Next: wait for pickup.';
      }
      return 'Next: wait for hub pickup.';
    case 'DELIVERY_BY_VENDOR_AGENT':
      if (order.canAssignVendorAgent) {
        return 'Next: assign your delivery agent.';
      }
      if (order.vendorDirectAgentName) {
        return `Your agent ${order.vendorDirectAgentName} will deliver.`;
      }
      return 'Your agent will deliver.';
    case 'DELIVERED':
      return 'Delivered.';
    case 'VENDOR_REJECTED':
      return 'You rejected this bag.';
    case 'BUYER_CANCELLED':
      return 'Buyer cancelled this bag.';
    default:
      return null;
  }
}

export function vendorOrderSituation(order: VendorOrderSituationInput): VendorOrderSituation {
  const shops = order.siblingShops ?? [];
  const siblingAlert =
    shops.length > 0 && shops.every((s) => CLOSED_SIBLING.has((s.status || '').toUpperCase()));
  return {
    siblingLine: siblingStatusLine(order),
    siblingAlert,
    nextStep: nextStepLine(order),
    paymentLine: paymentStatusLine(order.paymentMethod, order.paymentStatus),
  };
}
