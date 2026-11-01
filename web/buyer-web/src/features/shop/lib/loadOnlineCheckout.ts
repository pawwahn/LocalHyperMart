import type { GatewayCheckout } from './gatewayCheckout';
import { checkoutCanOpen } from './gatewayCheckout';
import { fetchPaymentCheckout } from '../api/shopApi';
import {
  normalizeGatewayCheckout,
  pollUntilCheckoutReady,
  resolveCheckoutForPayment,
} from './paymentCheckoutPoll';

export function tenDigitIndianPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : null;
}

export type OnlinePaymentRef = {
  paymentId?: string;
  checkout?: unknown;
};

const DEFAULT_POLL = { intervalMs: 300, timeoutMs: 22_000 };

/** Poll payment-service until Razorpay / Cashfree / PhonePe can open; optional one retry (glam, laundry, grocery). */
export async function resolveOnlineCheckout(opts: {
  token: string;
  payment?: OnlinePaymentRef | null;
  paymentGateway?: string;
  retry?: () => Promise<OnlinePaymentRef>;
  poll?: { intervalMs?: number; timeoutMs?: number };
}): Promise<GatewayCheckout> {
  const paymentId = opts.payment?.paymentId;
  if (!paymentId) {
    throw new Error('Online payment did not start. Open the order and tap Pay now.');
  }
  const immediate = normalizeGatewayCheckout(opts.payment?.checkout);
  if (checkoutCanOpen(immediate)) return immediate;

  const timeoutMs =
    opts.poll?.timeoutMs ??
    (opts.paymentGateway === 'CASHFREE' ? 22_000 : DEFAULT_POLL.timeoutMs);
  const pollOpts = { intervalMs: opts.poll?.intervalMs ?? DEFAULT_POLL.intervalMs, timeoutMs };

  try {
    return await pollUntilCheckoutReady(() => fetchPaymentCheckout(opts.token, paymentId), pollOpts);
  } catch (firstErr) {
    if (!opts.retry) throw firstErr;
    const retried = await opts.retry();
    return resolveCheckoutForPayment(opts.token, retried, pollOpts);
  }
}
