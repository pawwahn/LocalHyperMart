import type { SettlementCandidate } from './api/settlementsApi';

/** KoyaKart-held UPI to return to the shop (glam partial prepay: subtotal matches this amount). */
export function vendorPayoutGross(row: Pick<SettlementCandidate, 'subtotal' | 'onlineRemittanceAmount'>): number {
  const remit = Number(row.onlineRemittanceAmount ?? 0);
  if (remit > 0) return remit;
  return Number(row.subtotal ?? 0);
}

/** Buyer pass-through kept from glam UPI remittance (platform, COD, plan, parlour fee). */
export function vendorPayoutPassThrough(
  row: Pick<
    SettlementCandidate,
    'onlineRemittanceAmount' | 'platformFee' | 'codFee' | 'membershipFee' | 'parlourPaymentFee'
  >,
): number {
  if (Number(row.onlineRemittanceAmount ?? 0) <= 0) return 0;
  return (
    Number(row.platformFee ?? 0) +
    Number(row.codFee ?? 0) +
    Number(row.membershipFee ?? 0) +
    Number(row.parlourPaymentFee ?? 0)
  );
}