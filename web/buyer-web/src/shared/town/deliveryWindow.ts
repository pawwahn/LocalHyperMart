/** Buyer-facing promise. Delivery can land inside the next few hours, not a fixed clock slot. */
export const DELIVERY_ETA_LABEL = 'In 2-4 hrs';

export function formatDeliveryWindow(
  _start?: string | null,
  _end?: string | null,
  _nowMs?: number,
): string {
  return DELIVERY_ETA_LABEL;
}
