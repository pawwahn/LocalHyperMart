/** When the shop can take last-mile instead of waiting for hub. */

export type VendorAgentOfferInput = {
  status: string;
  vendorAgentDeliveryEnabled?: boolean;
  vendorAgentDelivery?: boolean;
  wholeOrderForShop?: boolean;
  townHubEnabled?: boolean;
};

export function canOfferVendorAgentDelivery(order: VendorAgentOfferInput): boolean {
  if (order.status !== 'PLACED' && order.status !== 'READY_FOR_PICKUP') return false;
  if (!order.vendorAgentDeliveryEnabled) return false;
  if (order.vendorAgentDelivery) return false;
  return Boolean(order.wholeOrderForShop || !order.townHubEnabled);
}

/** Hub pickup — not available when the town hub is off. */
export function canMarkReadyForHubPickup(order: VendorAgentOfferInput): boolean {
  if ((order.status || '').toUpperCase() !== 'PLACED') return false;
  return order.townHubEnabled !== false;
}
