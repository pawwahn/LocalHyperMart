import { CheckoutDismissedError, openRazorpayCheckout, type GatewayCheckout } from './razorpayCheckout';

export type { GatewayCheckout };
export { CheckoutDismissedError };

export type PaidCheckout = {
  gateway: 'RAZORPAY' | 'CASHFREE' | 'PHONEPE';
  gatewayOrderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget: string }) => Promise<{
    error?: { message?: string };
    paymentDetails?: unknown;
  }>;
};

type CashfreeLoader = (options: { mode: 'sandbox' | 'production' }) => CashfreeCheckout;

type PhonePeCheckoutApi = {
  transact: (options: {
    tokenUrl: string;
    type: 'IFRAME';
    callback: (response: string) => void;
  }) => void;
};

declare global {
  interface Window {
    Cashfree?: CashfreeLoader;
    PhonePe?: { Checkout?: PhonePeCheckoutApi };
    PhonePeCheckout?: PhonePeCheckoutApi;
  }
}

export function checkoutCanOpen(checkout: GatewayCheckout | null | undefined): checkout is GatewayCheckout {
  if (!checkout?.gatewayOrderId) return false;
  const gateway = checkout.gateway || 'RAZORPAY';
  if (gateway === 'CASHFREE') return Boolean(checkout.paymentSessionId);
  if (gateway === 'PHONEPE') return Boolean(checkout.redirectUrl);
  return Boolean(checkout.keyId);
}

export async function openGatewayCheckout(
  checkout: GatewayCheckout,
  prefill?: { contact?: string; name?: string },
): Promise<PaidCheckout> {
  const gateway = checkout.gateway || 'RAZORPAY';
  if (gateway === 'CASHFREE') return openCashfree(checkout);
  if (gateway === 'PHONEPE') return openPhonePe(checkout);
  const paid = await openRazorpayCheckout(checkout, prefill);
  return {
    gateway: 'RAZORPAY',
    gatewayOrderId: paid.razorpayOrderId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpaySignature: paid.razorpaySignature,
  };
}

function loadScript(id: string, src: string): Promise<void> {
  const existing = document.querySelector(`script[data-hlm-pay="${id}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if ((id === 'cashfree' && window.Cashfree) || (id === 'phonepe' && phonePeApi())) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load checkout')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.hlmPay = id;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load checkout'));
    document.head.appendChild(script);
  });
}

async function openCashfree(checkout: GatewayCheckout): Promise<PaidCheckout> {
  if (!checkout.paymentSessionId) {
    throw new Error('Cashfree checkout did not start. Add Cashfree keys and try again.');
  }
  await loadScript('cashfree', 'https://sdk.cashfree.com/js/v3/cashfree.js');
  const load = window.Cashfree;
  if (!load) throw new Error('Cashfree checkout did not load');
  const mode = checkout.mode === 'production' ? 'production' : 'sandbox';
  const result = await load({ mode }).checkout({
    paymentSessionId: checkout.paymentSessionId,
    redirectTarget: '_modal',
  });
  if (result.error) {
    const message = result.error.message || '';
    if (/cancel|closed|dismiss/i.test(message)) throw new CheckoutDismissedError();
    throw new Error(message || 'Cashfree payment failed');
  }
  if (!result.paymentDetails) throw new CheckoutDismissedError();
  return { gateway: 'CASHFREE', gatewayOrderId: checkout.gatewayOrderId };
}

function phonePeApi(): PhonePeCheckoutApi | undefined {
  return window.PhonePeCheckout || window.PhonePe?.Checkout;
}

function openPhonePe(checkout: GatewayCheckout): Promise<PaidCheckout> {
  if (!checkout.redirectUrl) {
    return Promise.reject(new Error('PhonePe checkout did not start. Add PhonePe keys and try again.'));
  }
  return loadScript('phonepe', 'https://mercury.phonepe.com/web/bundle/checkout.js').then(
    () =>
      new Promise((resolve, reject) => {
        const api = phonePeApi();
        if (!api) {
          reject(new Error('PhonePe checkout did not load'));
          return;
        }
        api.transact({
          tokenUrl: checkout.redirectUrl!,
          type: 'IFRAME',
          callback(response) {
            if (response === 'USER_CANCEL' || response === 'CONCLUDED') {
              if (response === 'USER_CANCEL') reject(new CheckoutDismissedError());
              else resolve({ gateway: 'PHONEPE', gatewayOrderId: checkout.gatewayOrderId });
              return;
            }
            reject(new Error('PhonePe payment failed'));
          },
        });
      }),
  );
}
