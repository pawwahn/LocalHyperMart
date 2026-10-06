/** Who physically holds buyer money before settlement completes. */
export type BuyerMoneyHeld = {
  withPlatform: number;
  atHub: number;
  withShop: number;
  withAgent: number;
  declaredToHub: number;
  declaredToShop: number;
};

export type MoneyTransferStep = {
  from: string;
  to: string;
  amount: number;
  detail: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function emptyBuyerMoneyHeld(): BuyerMoneyHeld {
  return {
    withPlatform: 0,
    atHub: 0,
    withShop: 0,
    withAgent: 0,
    declaredToHub: 0,
    declaredToShop: 0,
  };
}

/** Map settlement cash split (super-admin) into held buckets. */
export function buyerMoneyFromCashSplit(split: {
  online: number;
  codAtHub: number;
  codWithVendor: number;
  codWithAgent: number;
  codDeclaredToVendor: number;
  codDeclaredToHub: number;
}): BuyerMoneyHeld {
  return {
    withPlatform: round2(split.online),
    atHub: round2(split.codAtHub),
    withShop: round2(split.codWithVendor),
    withAgent: round2(split.codWithAgent),
    declaredToHub: round2(split.codDeclaredToHub),
    declaredToShop: round2(split.codDeclaredToVendor),
  };
}

export function sumBuyerMoneyHeld(rows: Array<{ amount: number; held: BuyerMoneyHeld }>): BuyerMoneyHeld {
  const out = emptyBuyerMoneyHeld();
  for (const row of rows) {
    out.withPlatform += row.held.withPlatform;
    out.atHub += row.held.atHub;
    out.withShop += row.held.withShop;
    out.withAgent += row.held.withAgent;
    out.declaredToHub += row.held.declaredToHub;
    out.declaredToShop += row.held.declaredToShop;
  }
  return {
    withPlatform: round2(out.withPlatform),
    atHub: round2(out.atHub),
    withShop: round2(out.withShop),
    withAgent: round2(out.withAgent),
    declaredToHub: round2(out.declaredToHub),
    declaredToShop: round2(out.declaredToShop),
  };
}

export function heldRowTotal(h: BuyerMoneyHeld): number {
  return round2(
    h.withPlatform + h.atHub + h.withShop + h.withAgent + h.declaredToHub + h.declaredToShop,
  );
}

type VendorRowLike = {
  subtotal?: number | null;
  paymentMethod?: string | null;
};

type HolderLike = {
  holderRole?: string | null;
  codCashLocation?: string | null;
};

/** Vendor unpaid list: classify each bag into held buckets (uses payout API holder when present). */
export function buyerMoneyForVendorBag(
  row: VendorRowLike,
  holder?: HolderLike | null,
): BuyerMoneyHeld {
  const amt = Number(row.subtotal ?? 0);
  const pay = (row.paymentMethod ?? '').toUpperCase();
  const h = emptyBuyerMoneyHeld();
  if (pay !== 'COD') {
    h.withPlatform = amt;
    return h;
  }
  const loc = (holder?.codCashLocation ?? '').toUpperCase();
  const role = (holder?.holderRole ?? '').toUpperCase();
  if (loc === 'AT_HUB' || role === 'HUB_ADMIN') {
    h.atHub = amt;
    return h;
  }
  if (loc === 'WITH_VENDOR' || role === 'VENDOR') {
    h.withShop = amt;
    return h;
  }
  if (loc === 'DECLARED_TO_VENDOR') {
    h.declaredToShop = amt;
    return h;
  }
  if (loc === 'DECLARED_TO_HUB') {
    h.declaredToHub = amt;
    return h;
  }
  if (role === 'VENDOR_AGENT') {
    h.withAgent = amt;
    return h;
  }
  if (role === 'HUB_AGENT' || loc === 'WITH_AGENT') {
    h.withAgent = amt;
    return h;
  }
  h.withAgent = amt;
  return h;
}

export function aggregateVendorAwaitingHeld(
  rows: VendorRowLike[],
  holders: Record<string, HolderLike | undefined>,
  subOrderId: (row: VendorRowLike & { subOrderId?: string }) => string,
): BuyerMoneyHeld {
  const parts = rows.map((row) => {
    const id = subOrderId(row as VendorRowLike & { subOrderId: string });
    const held = buyerMoneyForVendorBag(row, holders[id]);
    return { amount: Number(row.subtotal ?? 0), held };
  });
  return sumBuyerMoneyHeld(parts);
}

/** Plain-language transfers for ops (KoyaKart pays vendor vs collect from shop). */
export function buildMoneyTransferPlan(input: {
  held: BuyerMoneyHeld;
  gross: number;
  fees: number;
  netToVendor: number;
  collectFromVendor: boolean;
}): { heldLines: Array<{ label: string; amount: number; hint?: string }>; steps: MoneyTransferStep[] } {
  const { held, gross, fees, netToVendor, collectFromVendor } = input;
  const heldLines: Array<{ label: string; amount: number; hint?: string }> = [];

  if (held.withPlatform > 0) {
    heldLines.push({
      label: 'KoyaKart (online UPI)',
      amount: held.withPlatform,
      hint: 'Buyer already paid the app',
    });
  }
  if (held.atHub > 0) {
    heldLines.push({
      label: 'Hub desk (COD cash)',
      amount: held.atHub,
      hint: 'Recorded on hub close-day',
    });
  }
  if (held.withShop > 0) {
    heldLines.push({
      label: 'Shop (COD confirmed)',
      amount: held.withShop,
      hint: 'Cash at the store',
    });
  }
  if (held.withAgent > 0) {
    heldLines.push({
      label: 'Delivery agent (COD in hand)',
      amount: held.withAgent,
      hint: 'Not yet at hub or shop',
    });
  }
  if (held.declaredToHub > 0) {
    heldLines.push({ label: 'Declared to hub (unconfirmed)', amount: held.declaredToHub });
  }
  if (held.declaredToShop > 0) {
    heldLines.push({ label: 'Declared to shop (unconfirmed)', amount: held.declaredToShop });
  }

  const steps: MoneyTransferStep[] = [];

  if (collectFromVendor) {
    if (fees > 0) {
      steps.push({
        from: 'Shop',
        to: 'KoyaKart',
        amount: round2(fees),
        detail: 'Commission / monthly fee on shop-held COD (Vendor pays KoyaKart)',
      });
    }
    if (netToVendor > 0) {
      steps.push({
        from: 'Shop',
        to: 'KoyaKart',
        amount: round2(netToVendor),
        detail: 'Other charges or fee top-up',
      });
    }
    return { heldLines, steps };
  }

  if (held.atHub > 0) {
    steps.push({
      from: 'Hub',
      to: 'KoyaKart',
      amount: held.atHub,
      detail: 'Issue hub COD statement & remittance (physical cash at hub)',
    });
  }

  if (netToVendor > 0) {
    steps.push({
      from: 'KoyaKart',
      to: 'Vendor',
      amount: round2(netToVendor),
      detail: `Payout batch on gross ${formatInr(gross)} − fees ${formatInr(fees)}`,
    });
  }

  if (fees > 0) {
    steps.push({
      from: 'Platform keeps',
      to: '—',
      amount: round2(fees),
      detail: 'Billing fees (not part of vendor payout)',
    });
  }

  return { heldLines, steps };
}

function formatInr(n: number): string {
  return `₹${n.toFixed(2).replace(/\.00$/, '')}`;
}
