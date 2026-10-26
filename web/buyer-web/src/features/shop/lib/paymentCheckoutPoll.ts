import { checkoutCanOpen, type GatewayCheckout } from './gatewayCheckout';
import type { PaymentCheckoutDto } from '../api/shopApi';
import { fetchPaymentCheckout } from '../api/shopApi';

/** Map API checkout payloads (incl. legacy field names) into Razorpay/Cashfree open shape. */
export function normalizeGatewayCheckout(raw: unknown): GatewayCheckout | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const gatewayOrderId = row.gatewayOrderId;
  if (typeof gatewayOrderId !== 'string' || !gatewayOrderId.trim()) return null;
  const keyIdRaw = row.keyId ?? row.gatewayKey;
  return {
    keyId: typeof keyIdRaw === 'string' && keyIdRaw.trim() ? keyIdRaw.trim() : null,
    gateway: (typeof row.gateway === 'string' ? row.gateway : null) as GatewayCheckout['gateway'],
    gatewayOrderId: gatewayOrderId.trim(),
    paymentSessionId: typeof row.paymentSessionId === 'string' ? row.paymentSessionId : null,
    redirectUrl: typeof row.redirectUrl === 'string' ? row.redirectUrl : null,
    mode: (typeof row.mode === 'string' ? row.mode : null) as GatewayCheckout['mode'],
    amountPaise: Number(row.amountPaise ?? 0),
    currency: typeof row.currency === 'string' ? row.currency : 'INR',
    name: typeof row.name === 'string' ? row.name : 'KoyaKart',
    description: typeof row.description === 'string' ? row.description : null,
    prefillContact: typeof row.prefillContact === 'string' ? row.prefillContact : null,
    logoUrl: typeof row.logoUrl === 'string' ? row.logoUrl : null,
  };
}

export async function pollUntilCheckoutReady<T extends { checkout?: GatewayCheckout | null }>(
  load: () => Promise<T>,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<GatewayCheckout> {
  const intervalMs = options?.intervalMs ?? 350;
  const timeoutMs = options?.timeoutMs ?? 28_000;
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await load();
    const checkout = normalizeGatewayCheckout(last.checkout);
    if (checkout && checkoutCanOpen(checkout)) {
      return checkout;
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  const hadOrderId = Boolean(normalizeGatewayCheckout(last?.checkout)?.gatewayOrderId);
  if (hadOrderId) {
    throw new Error(
      'Payment checkout is not ready yet (missing gateway keys). Open your booking and tap Pay now, or try again in a moment.',
    );
  }
  throw new Error(
    last?.checkout === undefined
      ? 'Payment checkout timed out. Try again from My orders or Membership.'
      : 'Payment checkout timed out. Open your booking to finish paying.',
  );
}

/** Poll payment-service until Razorpay / Cashfree / PhonePe checkout can open. */
export async function resolveCheckoutForPayment(
  token: string,
  payment?: { paymentId?: string; checkout?: unknown } | null,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<GatewayCheckout> {
  const immediate = normalizeGatewayCheckout(payment?.checkout);
  if (checkoutCanOpen(immediate)) return immediate;
  const paymentId = payment?.paymentId;
  if (!paymentId) {
    throw new Error('Online payment did not start. Try again or pay from your booking page.');
  }
  return pollUntilCheckoutReady(async () => {
    const row: PaymentCheckoutDto = await fetchPaymentCheckout(token, paymentId);
    return { checkout: normalizeGatewayCheckout(row.checkout) };
  }, options);
}
