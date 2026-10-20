import type { AdminOrderCashHolder, AdminOrderSummary } from '@/features/orders/api/ordersApi';

export type CashBucket = 'online' | 'not_collected' | 'rider' | 'hub' | 'shop' | 'company' | 'unknown';

export type CashPlace = {
  bucket: CashBucket;
  title: string;
  detail: string;
  sentence: string;
};

export function describeCash(
  order: Pick<AdminOrderSummary, 'paymentMethod' | 'paymentStatus' | 'status' | 'vendorAgentDelivery'>,
  holder: AdminOrderCashHolder | null | undefined,
  holdersReady: boolean,
): CashPlace {
  const method = (order.paymentMethod ?? '').toUpperCase();
  const status = (order.status ?? '').toUpperCase();
  if (method !== 'COD') {
    return place('online', 'Cash with App', 'Customer paid online. The money is with KoyaKart.');
  }
  if (!holdersReady) {
    return place('unknown', 'Checking…', 'Looking up who has this cash.');
  }
  if (!holder?.holderLabel) {
    return place('unknown', 'Not known', 'No record of who has this cash.');
  }

  const role = (holder.holderRole ?? '').toUpperCase();
  const cashAt = (holder.codCashLocation ?? '').toUpperCase();
  const name = holder.agentName?.trim() || '';
  const phone = holder.agentPhone?.trim() || '';
  const hub = holder.hubName?.trim() || '';
  const cancelled = status === 'CANCELLED';
  const waiting = awaitingConfirm(holder.holderDetail);

  if (cashAt === 'WITH_VENDOR' || (role === 'VENDOR' && !waiting)) {
    return place('shop', 'Shop has it', 'Shop confirmed this handover. The cash is with the shop.');
  }
  if (cashAt === 'DECLARED_TO_VENDOR' || (role === 'VENDOR' && waiting)) {
    return place('shop', 'Shop has not confirmed', 'Rider says they handed this cash to the shop.');
  }
  if (cashAt === 'DECLARED_TO_HUB' || (role === 'HUB_ADMIN' && waiting)) {
    return place('hub', 'Hub has not confirmed', 'Rider says they handed this cash to the hub.');
  }
  if (cashAt === 'AT_HUB' || role === 'HUB_ADMIN') {
    return place('hub', hub ? `At ${hub}` : 'At the hub desk', 'Hub has this cash. Not sent to KoyaKart yet.');
  }
  if (cashAt === 'WITH_COMPANY' || role === 'PLATFORM') {
    return place('company', 'With KoyaKart', 'Hub already sent this cash to KoyaKart.');
  }

  if (status !== 'DELIVERED' && (role === 'HUB_AGENT' || role === 'VENDOR_AGENT' || role === '')) {
    return cancelled
      ? place('not_collected', 'Nobody collected it', 'Order was cancelled. Customer did not pay.')
      : place('not_collected', 'Customer still has it', 'Order is not delivered, so the customer has not paid.');
  }

  if (role === 'HUB_AGENT' || role === 'VENDOR_AGENT' || cashAt === 'WITH_AGENT' || cashAt === '') {
    const shopRider = role === 'VENDOR_AGENT' || order.vendorAgentDelivery;
    const who = [name || (shopRider ? 'Shop rider' : 'Hub rider'), phone].filter(Boolean).join(' · ');
    return shopRider
      ? place('rider', `${who} has it`, 'Collected from the customer. Not given to the shop yet.')
      : place('rider', `${who} has it`, 'Collected from the customer. Not given to the hub yet.');
  }
  return place('unknown', 'Not known', 'No record of who has this cash.');
}

/** "Confirmed at shop" is done. Only "shop to confirm" is still waiting. */
function awaitingConfirm(detail?: string | null): boolean {
  return (detail ?? '').toLowerCase().includes('to confirm');
}

function place(bucket: CashBucket, title: string, detail: string): CashPlace {
  return { bucket, title, detail, sentence: `${title}. ${detail}` };
}
