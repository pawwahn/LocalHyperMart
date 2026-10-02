/** Vendor-facing bag id — not the immutable settlement id in the database. */

export function vendorBagDisplayNumber(order: {
  subOrderNumber: string;
  orderNumber: string;
  wholeOrderForShop?: boolean;
}): string {
  // One active shop bag left — show 1/1 even if DB still has the original x/y suffix.
  if (order.wholeOrderForShop) {
    return `${order.orderNumber}-1/1`;
  }
  return order.subOrderNumber;
}

export function vendorBagLabelHint(order: { wholeOrderForShop?: boolean; subOrderNumber: string }): string | null {
  if (!order.wholeOrderForShop) return null;
  if (order.subOrderNumber.endsWith('-1/1')) return null;
  return 'Other shop bags on this order are no longer active — only yours remains.';
}
