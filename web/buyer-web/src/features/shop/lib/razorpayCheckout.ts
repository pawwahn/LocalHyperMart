export type GatewayCheckout = {
  keyId?: string | null;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description?: string | null;
  prefillContact?: string | null;
  logoUrl?: string | null;
};

export type RazorpaySuccess = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

type RazorpayInstance = { open: () => void };

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

export class CheckoutDismissedError extends Error {
  constructor() {
    super('Payment window closed');
    this.name = 'CheckoutDismissedError';
  }
}

let loading: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (!document.getElementById('hlm-razorpay-z')) {
    const style = document.createElement('style');
    style.id = 'hlm-razorpay-z';
    style.textContent = '.razorpay-container{z-index:200000!important}';
    document.head.appendChild(style);
  }
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hlm-razorpay="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.hlmRazorpay = '1';
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay checkout'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function openRazorpayCheckout(
  checkout: GatewayCheckout,
  prefill?: { contact?: string; name?: string },
): Promise<RazorpaySuccess> {
  if (!checkout.keyId) {
    throw new Error('Online payment is not configured yet. Use cash on delivery, or add Razorpay keys.');
  }
  await loadCheckoutScript();
  const Ctor = window.Razorpay;
  if (!Ctor) {
    throw new Error('Razorpay checkout did not load');
  }
  return new Promise((resolve, reject) => {
    const rzp = new Ctor({
      key: checkout.keyId,
      amount: checkout.amountPaise,
      currency: checkout.currency || 'INR',
      name: checkout.name || 'KoYaKart',
      description: checkout.description || 'Order payment',
      image: checkout.logoUrl || undefined,
      order_id: checkout.gatewayOrderId,
      prefill: {
        contact: prefill?.contact || checkout.prefillContact || '',
        name: prefill?.name || '',
      },
      theme: { color: '#0C831F' },
      handler(response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) {
        resolve({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss() {
          reject(new CheckoutDismissedError());
        },
      },
    });
    rzp.open();
  });
}
