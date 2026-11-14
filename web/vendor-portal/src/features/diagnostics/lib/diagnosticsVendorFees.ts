import type { DiagnosticsPortalProfile, DiagnosticsVendorOrder } from '../api/diagnosticsApi';

export type DiagnosticsBillingTerms = Pick<
  DiagnosticsPortalProfile,
  'feeModel' | 'perPieceAmount' | 'perOrderFlatAmount' | 'monthlySubscriptionAmount'
>;

/** Tests + home collection — same base as settlement / vendor Payouts “bag total”. */
export function diagnosticsLabGmv(order: DiagnosticsVendorOrder): number {
  return Math.round((Number(order.testsSubtotal || 0) + Number(order.homeCollectionFee || 0)) * 100) / 100;
}

/** One booking = one settlement piece (matches order-service settlement candidates). */
export function diagnosticsSettlementPieceCount(_order: DiagnosticsVendorOrder): number {
  return 1;
}

export function estimateDiagnosticsCommission(
  profile: DiagnosticsBillingTerms | null | undefined,
  order: DiagnosticsVendorOrder,
): number {
  if (!profile?.feeModel) return 0;
  const model = profile.feeModel;
  if (model === 'PER_ORDER_FLAT' || model === 'PER_ORDER_WITH_SUBSCRIPTION') {
    return Math.round(Number(profile.perOrderFlatAmount || 0) * 100) / 100;
  }
  if (model === 'PER_PIECE' || model === 'PER_PIECE_WITH_SUBSCRIPTION') {
    const each = Number(profile.perPieceAmount || 0);
    return Math.round(each * diagnosticsSettlementPieceCount(order) * 100) / 100;
  }
  return 0;
}

export function isDiagnosticsOnlinePayment(order: DiagnosticsVendorOrder): boolean {
  return /^(UPI|ONLINE)$/i.test(String(order.paymentMethod ?? '').trim());
}
