import type { AdminOrderCashHolder, AdminOrderSummary } from '@/features/orders/api/ordersApi';

export type AppSettlement = {
  orderId?: string | null;
  direction?: 'PAYOUT' | 'COLLECTION' | string | null;
  status?: 'DRAFT' | 'FINALIZED' | 'PAID' | string | null;
  paid?: boolean;
};

/** Settled means KoyaKart has its commission. Unsettled means it is still with someone else. */
export type CommissionState = 'settled' | 'unsettled' | 'not_due' | 'checking';

/** Who still has to hand the commission to KoyaKart. */
export type CommissionFrom = 'vendor' | 'hub' | 'agent' | '';

export type SettlementView = {
  state: CommissionState;
  from: CommissionFrom;
  title: string;
  detail: string;
};

export function describeSettlement(
  order: Pick<AdminOrderSummary, 'paymentMethod' | 'paymentStatus' | 'status' | 'vendorAgentDelivery'>,
  holder: AdminOrderCashHolder | null | undefined,
  settlement: AppSettlement | null | undefined,
  ready: boolean,
): SettlementView {
  const status = (order.status ?? '').toUpperCase();
  if (status === 'CANCELLED') {
    return view('not_due', '', 'Not due', 'Order was cancelled. No commission to collect.');
  }
  if (status !== 'DELIVERED') {
    return view('not_due', '', 'Not due', 'Order is not delivered, so the commission is not due.');
  }
  if (!ready && !settlement) {
    return view('checking', '', 'Checking…', 'Looking up whether the commission is in.');
  }

  const direction = (settlement?.direction ?? '').toUpperCase();
  const paid = Boolean(settlement?.paid) || (settlement?.status ?? '').toUpperCase() === 'PAID';
  const onABill = Boolean(settlement) && !paid;
  if (direction === 'COLLECTION' && paid) {
    return view('settled', '', 'Settled', 'Vendor paid this commission. It is with KoyaKart.');
  }

  const method = (order.paymentMethod ?? '').toUpperCase();
  if (method !== 'COD') {
    const pay = (order.paymentStatus ?? '').toUpperCase();
    if (pay === 'PAID' || pay === 'SUCCESS' || pay === 'CAPTURED') {
      return view('settled', '', 'Settled', 'Customer paid online. This commission is already with KoyaKart.');
    }
    return view('unsettled', '', 'Unsettled', 'Customer has not paid online, so the commission is not in.');
  }

  const loc = (holder?.codCashLocation ?? 'WITH_AGENT').toUpperCase();
  if (loc === 'WITH_COMPANY') {
    return view('settled', '', 'Settled', 'Hub sent this cash to KoyaKart. The commission is in.');
  }
  if (loc === 'WITH_VENDOR' || loc === 'DECLARED_TO_VENDOR') {
    const who = 'Vendor';
    const waiting = loc === 'DECLARED_TO_VENDOR';
    const detail = onABill
      ? 'This order is on a bill. The vendor has not paid the commission.'
      : waiting
        ? 'Rider says the shop has this cash. The vendor has not paid the commission.'
        : 'Shop still has the cash. The vendor has not paid the commission.';
    return view('unsettled', 'vendor', `Unsettled · ${who}`, detail);
  }
  if (loc === 'AT_HUB' || loc === 'DECLARED_TO_HUB') {
    const hub = holder?.hubName?.trim() || 'Hub';
    const detail = loc === 'DECLARED_TO_HUB'
      ? `${hub} has not confirmed this cash. The commission is not in yet.`
      : `${hub} has this cash. The commission reaches KoyaKart when the hub sends it.`;
    return view('unsettled', 'hub', `Unsettled · ${hub}`, detail);
  }

  const agent = holder?.agentName?.trim() || (order.vendorAgentDelivery ? 'Shop rider' : 'Hub rider');
  const phone = holder?.agentPhone?.trim();
  const who = phone ? `${agent} · ${phone}` : agent;
  return view('unsettled', 'agent', `Unsettled · ${agent}`, `${who} still has the cash. The commission is not in yet.`);
}

function view(state: CommissionState, from: CommissionFrom, title: string, detail: string): SettlementView {
  return { state, from, title, detail };
}
