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
