import type { SettlementCandidate } from './api/settlementsApi';

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ShopHeldRowBreakdown = {
  comm: number | null;
  plat: number;
  cod: number;
  plan: number;
  /** Total to bill the shop (commission + app pass-through). */
  bill: number | null;
  /** Goods subtotal minus commission (shop keeps from service amount). */
  shopGoodsNet: number | null;
};

function feeCell(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

export { feeCell as formatShopHeldFeeCell };

/**
 * Split batch commission across selected bags by goods subtotal.
 * Platform / COD / plan come from each candidate row.
 */
export function shopHeldRowBreakdown(
  row: SettlementCandidate,
  opts: {
    selected: Set<string>;
    commissionPool: number;
    selectedGross: number;
    quoteReady: boolean;
  },
): ShopHeldRowBreakdown {
  const plat = roundMoney(Number(row.platformFee ?? 0));
  const cod = roundMoney(Number(row.codFee ?? 0));
  const plan = roundMoney(Number(row.membershipFee ?? 0));
  const sub = Number(row.subtotal ?? 0);
  const pass = roundMoney(plat + cod + plan);

  if (!opts.selected.has(row.subOrderId) || !opts.quoteReady || opts.selectedGross <= 0) {
    return {
      comm: null,
      plat,
      cod,
      plan,
      bill: pass > 0 ? pass : null,
      shopGoodsNet: null,
    };
  }

  const comm = roundMoney((opts.commissionPool * sub) / opts.selectedGross);
  const bill = roundMoney(comm + pass);
  const shopGoodsNet = roundMoney(sub - comm);
  return { comm, plat, cod, plan, bill, shopGoodsNet };
}

/** Allocate commission pool across rows; last selected row absorbs rounding. */
export function allocateCommissionByGross(
  rows: SettlementCandidate[],
  selected: Set<string>,
  commissionPool: number,
): Map<string, number> {
  const out = new Map<string, number>();
  const picked = rows.filter((r) => selected.has(r.subOrderId));
  const gross = picked.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  if (gross <= 0 || commissionPool <= 0) return out;
  let allocated = 0;
  picked.forEach((row, i) => {
    const sub = Number(row.subtotal ?? 0);
    const comm =
      i === picked.length - 1
        ? roundMoney(commissionPool - allocated)
        : roundMoney((commissionPool * sub) / gross);
    allocated += comm;
    out.set(row.subOrderId, comm);
  });
  return out;
}
