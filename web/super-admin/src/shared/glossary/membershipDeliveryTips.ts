/** Membership free-delivery credits — tooltips for Reports / Memberships. */
export const MEMBERSHIP_DELIVERY_TIPS = {
  memberDeliveriesCount:
    'Orders in this date range where checkout used a membership delivery credit (one credit per order). Not the same as new memberships sold.',
  deliveryWaivedAmount:
    'Total delivery fee removed on those orders: sum of each order’s fee at checkout. Not “count × today’s delivery fee”—slabs and town settings at order time can make each order different (e.g. 15 orders can be ₹52 total).',
  creditsUsedInRange:
    'Credits consumed in this date range (membership ledger). The ₹ under the number is total delivery fee waived on those uses—the same idea as Delivery waived on Sales, counted from payment records.',
  deliveryFeesCollected:
    'Delivery fee buyers actually paid on delivered orders. Orders with membership free delivery show ₹0 here; see Delivery waived for what was not charged.',
} as const;
