import type { CompliancePack } from './api/financeLedgerApi';

export type ManagementSummaryVm = {
  estimatedPlatformRevenue: number;
  platformCashReceipts: number;
  buyerRefunds: number;
  paymentGatewayFees: number;
  netSurplusBeforeOperatingExpenses: number;
  passThroughFloat: number;
  netCashMovement: number;
  walletGranted: number;
  walletScratch: number;
  walletReferral: number;
  walletStoreCredit: number;
  platformResultIndicator: 'SURPLUS' | 'SHORTFALL' | 'BREAK_EVEN';
  note: string;
};

const NOTE =
  'Management view: estimated platform revenue (accrual) minus buyer refunds, imported Razorpay fees, ' +
  'and wallet gifts (scratch, referral, store credit). Wallet gifts are not bank payouts. ' +
  'Pass-through float is buyer/hub cash not yet paid to vendors (not profit).';

/** Server field or client fallback when API is on an older build. */
export function resolveManagementSummary(pack: CompliancePack): ManagementSummaryVm {
  const fromApi = pack.managementSummary ?? pack.management;
  if (fromApi) {
    return {
      ...fromApi,
      walletGranted: fromApi.walletGranted ?? 0,
      walletScratch: fromApi.walletScratch ?? 0,
      walletReferral: fromApi.walletReferral ?? 0,
      walletStoreCredit: fromApi.walletStoreCredit ?? 0,
    };
  }

  const r = pack.cashLedger;
  const refunds = pack.refundRegister?.totalRefunded ?? pack.gateway.appOnlineRefunds ?? 0;
  const gatewayFees = pack.gateway.importedSettlementFees ?? 0;
  const estimated = pack.accrual.totalEstimatedPlatformRevenue ?? 0;
  const walletGranted = r.walletGranted ?? 0;
  const surplus = estimated - refunds - gatewayFees - walletGranted;
  const passFloat = (r.passThroughInflows ?? 0) - (r.passThroughOutflows ?? 0);
  let platformResultIndicator: ManagementSummaryVm['platformResultIndicator'] = 'BREAK_EVEN';
  if (surplus > 0) platformResultIndicator = 'SURPLUS';
  else if (surplus < 0) platformResultIndicator = 'SHORTFALL';

  return {
    estimatedPlatformRevenue: estimated,
    platformCashReceipts: r.platformReceipts ?? 0,
    buyerRefunds: refunds,
    paymentGatewayFees: gatewayFees,
    netSurplusBeforeOperatingExpenses: surplus,
    passThroughFloat: passFloat,
    netCashMovement: r.netCashMovement ?? 0,
    walletGranted: r.walletGranted ?? 0,
    walletScratch: r.walletScratch ?? 0,
    walletReferral: r.walletReferral ?? 0,
    walletStoreCredit: r.walletStoreCredit ?? 0,
    platformResultIndicator,
    note: NOTE,
  };
}
