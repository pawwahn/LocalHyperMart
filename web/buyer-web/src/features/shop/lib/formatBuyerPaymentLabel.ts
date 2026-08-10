/**
 * Buyer-facing payment label.
 * COD stays pending until delivery; cancelled COD was never collected.
 */
export function formatBuyerPaymentLabel(input: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
}): string {
  const method = (input.paymentMethod ?? 'COD').toUpperCase();
  const status = (input.orderStatus ?? '').toUpperCase();
  const pay = (input.paymentStatus ?? '').toUpperCase();
  const delivered = status === 'DELIVERED';

  if (method === 'COD') {
    if (status === 'CANCELLED') return 'Cancelled · COD (not collected)';
    return delivered && pay === 'PAID' ? 'PAID(COD)' : 'COD';
  }

  if (method === 'ONLINE') {
    if (status === 'CANCELLED' && pay === 'REFUNDED') return 'REFUNDED(Online)';
    if (status === 'CANCELLED') return 'Cancelled';
    if (delivered || pay === 'PAID') return 'PAID(Online)';
    if (pay === 'FAILED') return 'FAILED(Online)';
    if (pay === 'REFUNDED') return 'REFUNDED(Online)';
    return 'Online · Pending';
  }

  return pay || method || '—';
}
