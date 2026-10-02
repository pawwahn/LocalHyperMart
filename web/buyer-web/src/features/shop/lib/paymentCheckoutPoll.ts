import type { GatewayCheckout } from './razorpayCheckout';

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
    if (last.checkout?.gatewayOrderId) {
      return last.checkout;
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  throw new Error(
    last?.checkout === undefined
      ? 'Payment checkout timed out. Try again from My orders or Membership.'
      : 'Payment checkout timed out. Open My orders to finish paying.',
  );
}
