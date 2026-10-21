const key = (orderId: string) => `hlm.buy-again.keep.${orderId}`;

/** Set when the buyer taps Add on Buy again, so that order may stay in the basket. */
export function markBuyAgainKept(orderId: string) {
  try {
    localStorage.setItem(key(orderId), '1');
  } catch {
    /* ignore */
  }
}

export function wasBuyAgainKept(orderId: string): boolean {
  try {
    return localStorage.getItem(key(orderId)) === '1';
  } catch {
    return false;
  }
}
