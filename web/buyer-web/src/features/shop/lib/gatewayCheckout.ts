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

type CashfreeCheckoutResult = {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string } | unknown;
};

type CashfreeInstance = {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: string;
    returnUrl?: string;
  }) => Promise<CashfreeCheckoutResult>;
};

type CashfreeLoader = (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance | Promise<CashfreeInstance>;

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

const CASHFREE_CHECKOUT_TIMEOUT_MS = 180_000;

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

function ensureCashfreeModalZIndex() {
  if (document.getElementById('hlm-cashfree-z')) return;
  const style = document.createElement('style');
  style.id = 'hlm-cashfree-z';
  style.textContent = `
    .cashfree-modal-container,
    .cashfree-overlay,
    .cf-modal-root,
    .cf-modal,
    #cf-modal,
    div[class*="cashfree" i],
    iframe[src*="cashfree" i] {
      z-index: 2147483000 !important;
    }
  `;
  document.head.appendChild(style);
}

async function getCashfreeInstance(mode: 'sandbox' | 'production'): Promise<CashfreeInstance> {
  await loadScript('cashfree', 'https://sdk.cashfree.com/js/v3/cashfree.js');
  const loader = window.Cashfree;
  if (!loader) throw new Error('Cashfree checkout did not load');
  const instance = await Promise.resolve(loader({ mode }));
  if (!instance?.checkout) throw new Error('Cashfree checkout did not load');
  return instance;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

async function openCashfree(checkout: GatewayCheckout): Promise<PaidCheckout> {
  if (!checkout.paymentSessionId) {
    throw new Error('Cashfree checkout did not start. Add Cashfree keys and try again.');
  }
  ensureCashfreeModalZIndex();
  const mode = checkout.mode === 'production' ? 'production' : 'sandbox';
  const cashfree = await getCashfreeInstance(mode);

  const runCheckout = (redirectTarget: string) =>
    withTimeout(
      cashfree.checkout({
        paymentSessionId: checkout.paymentSessionId!,
        redirectTarget,
      }),
      CASHFREE_CHECKOUT_TIMEOUT_MS,
      'Cashfree checkout timed out. If you paid, open your booking and tap Pay now again.',
    );

  let result = await runCheckout('_modal');

  if (result.redirect) {
    result = await runCheckout('_self');
  }

  if (result.error) {
    const message = result.error.message || '';
    if (/cancel|closed|dismiss|abort/i.test(message)) throw new CheckoutDismissedError();
    throw new Error(message || 'Cashfree payment failed');
  }

  if (result.paymentDetails) {
    return { gateway: 'CASHFREE', gatewayOrderId: checkout.gatewayOrderId };
  }

  throw new CheckoutDismissedError();
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
