/** Gross Merchandise Value — plain-language help for super-admin screens. */
export const GMV_SHORT =
  'GMV = total buyer order value (goods in the cart). Sales volume, not platform profit.';

export const GMV_TIPS = {
  overview: `${GMV_SHORT} Fees, delivery, and discounts are handled separately.`,
  placed:
    'Sum of order totals when buyers placed orders in this date range (including orders still open or cancelled).',
  delivered:
    'Sum of order totals for orders marked delivered in this range — what actually reached buyers.',
  cod: 'Delivered orders where the buyer paid cash on delivery — the goods value portion (not your fee income).',
  online: 'Delivered orders paid online (UPI/card) — goods value, before pass-through to vendors.',
  townColumn: 'Placed order value for that town in the selected range.',
} as const;

export const DELIVERY_FEE_TIP =
  'Delivery fee buyers paid on delivered orders (from the order total). When a membership credit covers delivery, that order contributes ₹0 here — see Delivery waived for the not-charged amount.';

/** Re-export for screens that already import delivery fee help from here. */
export { MEMBERSHIP_DELIVERY_TIPS } from './membershipDeliveryTips';
