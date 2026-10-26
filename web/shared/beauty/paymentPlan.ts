export type BeautyPaymentPlanInput = {
  prepayMode?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  amountCollected?: number | null;
  balanceDue?: number | null;
  amountDueTotal?: number | null;
  serviceAmount?: number | null;
  travelCharge?: number | null;
  platformFeeAmount?: number | null;
  codFee?: number | null;
  parlourPaymentFee?: number | null;
  prepayAmount?: number | null;
};

export type BeautyPaymentAudience = 'buyer' | 'vendor';

export type BeautySettlementTone = 'ok' | 'warn' | 'muted' | 'danger';

export type BeautyPaymentPlanView = {
  plan: 'FULL' | 'PARTIAL';
  planBadge: string;
  planDescription: string;
  settlementBadge: string;
  settlementTone: BeautySettlementTone;
  total: number;
  paidOnline: number;
  dueAtVisit: number;
  dueAtVisitLabel: string;
  paymentMethodLabel: string;
  /** One line for order lists */
  listHint: string;
};

function roundMoney(n: number): number {
  return Math.round(Number(n || 0));
}

export function beautyBookingTotal(input: BeautyPaymentPlanInput): number {
  if (input.amountDueTotal != null && Number(input.amountDueTotal) > 0) {
    return Number(input.amountDueTotal);
  }
  return (
    Number(input.serviceAmount || 0) +
    Number(input.travelCharge || 0) +
    Number(input.platformFeeAmount || 0) +
    Number(input.codFee || 0) +
    Number(input.parlourPaymentFee || 0)
  );
}

export function isPartialPrepayPlan(prepayMode?: string | null): boolean {
  return (prepayMode || '').trim().toUpperCase() === 'PARTIAL';
}

function inferPartialPlan(input: BeautyPaymentPlanInput): boolean {
  const mode = (input.prepayMode || '').trim().toUpperCase();
  if (mode === 'FULL') return false;
  if (mode === 'PARTIAL') return true;
  const parlour = Number(input.parlourPaymentFee || 0);
  if (parlour > 0) return true;
  const ps = (input.paymentStatus || '').toUpperCase();
  if (ps === 'PARTIAL') return true;
  const total = beautyBookingTotal(input);
  const prepay = Number(input.prepayAmount || 0);
  if (prepay > 0 && prepay < total - 0.01) return true;
  return false;
}

export function beautyPaymentPlanView(
  input: BeautyPaymentPlanInput,
  audience: BeautyPaymentAudience = 'buyer',
): BeautyPaymentPlanView {
  const total = beautyBookingTotal(input);
  const paidOnline = Math.max(0, Number(input.amountCollected || 0));
  const dueAtVisit =
    input.balanceDue != null ? Math.max(0, Number(input.balanceDue)) : Math.max(0, total - paidOnline);
  const plan: 'FULL' | 'PARTIAL' = inferPartialPlan(input) ? 'PARTIAL' : 'FULL';
  const ps = (input.paymentStatus || '').toUpperCase();
  const methodUp = (input.paymentMethod || '').toUpperCase();
  const isUpi = methodUp === 'UPI';
  const paymentMethodLabel = isUpi ? 'UPI' : 'Cash at visit';
  const prepayCommitted = Math.max(0, Number(input.prepayAmount || 0));

  const planBadge = plan === 'PARTIAL' ? 'Partial prepay' : 'Full payment';
  const fullyPaidOnline = total > 0 && paidOnline >= total - 0.01 && dueAtVisit <= 0.01;
  let planDescription: string;
  if (plan === 'PARTIAL') {
    if (fullyPaidOnline) {
      const minNote =
        prepayCommitted > 0 && prepayCommitted < total - 0.01
          ? ` Minimum online at booking was ₹${roundMoney(prepayCommitted)}; the full ₹${roundMoney(total)} is now paid online.`
          : ` Full ₹${roundMoney(total)} paid online.`;
      planDescription =
        audience === 'vendor'
          ? `Customer booked with partial prepay.${minNote} Nothing to collect at the visit.`
          : `You booked with partial prepay.${minNote} Nothing to pay at the visit.`;
    } else if (dueAtVisit > 0.01) {
      const minLine =
        prepayCommitted > 0 && prepayCommitted < total
          ? `Minimum online prepay is ₹${roundMoney(prepayCommitted)}. `
          : '';
      planDescription =
        audience === 'vendor'
          ? `${minLine}Collect ₹${roundMoney(dueAtVisit)} from the customer at the visit.`
          : `${minLine}Pay ₹${roundMoney(dueAtVisit)} to your artist at the visit (after your online prepay).`;
    } else {
      planDescription =
        audience === 'vendor'
          ? 'Customer chose partial prepay — online prepay is still pending.'
          : 'You chose partial prepay — complete the online prepay to confirm.';
    }
  } else if (isUpi) {
    planDescription =
      audience === 'vendor'
        ? 'Customer chose to pay the full booking amount online.'
        : 'You chose to pay the full booking amount online when you booked.';
  } else {
    planDescription =
      audience === 'vendor'
        ? 'Customer pays the full amount in cash at the visit.'
        : 'You pay the full amount in cash at the visit.';
  }

  let settlementBadge: string;
  let settlementTone: BeautySettlementTone;

  if (ps === 'FAILED') {
    settlementBadge = 'Payment failed';
    settlementTone = 'danger';
  } else if (ps === 'DUE' && paidOnline <= 0 && dueAtVisit >= total && total > 0) {
    settlementBadge = isUpi ? 'Payment pending' : `Collect ₹${roundMoney(total)} at visit`;
    settlementTone = 'warn';
  } else if (dueAtVisit > 0.01) {
    settlementBadge =
      audience === 'vendor'
        ? `Collect ₹${roundMoney(dueAtVisit)} at visit`
        : `₹${roundMoney(dueAtVisit)} due at visit`;
    settlementTone = 'warn';
  } else if (paidOnline >= total && total > 0 && isUpi) {
    settlementBadge = plan === 'PARTIAL' ? 'All paid online' : 'Paid in full online';
    settlementTone = 'ok';
  } else if (ps === 'COLLECTED' || (paidOnline >= total && total > 0)) {
    settlementBadge = 'Fully settled';
    settlementTone = 'ok';
  } else if (ps === 'PARTIAL' && paidOnline > 0) {
    settlementBadge = 'Part paid online';
    settlementTone = 'warn';
  } else {
    settlementBadge = isUpi ? 'UPI booking' : 'Cash at visit';
    settlementTone = 'muted';
  }

  const dueAtVisitLabel =
    audience === 'vendor'
      ? dueAtVisit > 0
        ? 'Collect at visit'
        : 'Nothing to collect'
      : dueAtVisit > 0
        ? 'Pay at visit'
        : 'Nothing due at visit';

  const listHint =
    plan === 'PARTIAL'
      ? dueAtVisit > 0
        ? `Partial prepay · ₹${roundMoney(dueAtVisit)} due at visit`
        : 'Partial prepay · settled'
      : dueAtVisit > 0
        ? `Full booking · ₹${roundMoney(dueAtVisit)} due at visit`
        : isUpi && paidOnline >= total
          ? 'Full payment · paid online'
          : 'Full payment · cash at visit';

  return {
    plan,
    planBadge,
    planDescription,
    settlementBadge,
    settlementTone,
    total,
    paidOnline,
    dueAtVisit,
    dueAtVisitLabel,
    paymentMethodLabel,
    listHint,
  };
}
