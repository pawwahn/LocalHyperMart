import { formatAdminPaymentLabel } from '@/features/orders/api/ordersApi';
import type { SettlementCandidate } from './api/settlementsApi';

export type CodCashStage =
  | 'ONLINE'
  | 'WITH_AGENT'
  | 'AT_HUB'
  | 'WITH_VENDOR'
  | 'DECLARED_TO_VENDOR'
  | 'DECLARED_TO_HUB';

export function codCashStage(
  row: Pick<SettlementCandidate, 'paymentMethod' | 'codRemittedToHub' | 'codCashLocation'>,
): CodCashStage {
  if ((row.paymentMethod ?? '').toUpperCase() !== 'COD') return 'ONLINE';
  const loc = (row.codCashLocation ?? '').toUpperCase();
  if (loc === 'WITH_VENDOR') return 'WITH_VENDOR';
  if (loc === 'DECLARED_TO_VENDOR') return 'DECLARED_TO_VENDOR';
  if (loc === 'DECLARED_TO_HUB') return 'DECLARED_TO_HUB';
  if (loc === 'AT_HUB') return 'AT_HUB';
  if (loc === 'WITH_AGENT') return 'WITH_AGENT';
  return row.codRemittedToHub ? 'AT_HUB' : 'WITH_AGENT';
}

export function formatSettlementPayment(row: SettlementCandidate): string {
  return formatAdminPaymentLabel({
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    orderStatus: row.status,
  });
}

export function codCashLocationLabel(stage: CodCashStage): string {
  switch (stage) {
    case 'ONLINE':
      return 'KoyaKart · UPI received';
    case 'WITH_AGENT':
      return 'Cash with agent';
    case 'AT_HUB':
      return 'At hub (close-day)';
    case 'WITH_VENDOR':
      return 'With shop (confirmed)';
    case 'DECLARED_TO_VENDOR':
      return 'Declared to shop';
    case 'DECLARED_TO_HUB':
      return 'Declared to hub';
    default:
      return '—';
  }
}

export function selectedCandidatesByCodStage(
  candidates: SettlementCandidate[],
  selected: Set<string>,
  stage: CodCashStage,
): SettlementCandidate[] {
  return candidates.filter((c) => selected.has(c.subOrderId) && codCashStage(c) === stage);
}

export type VendorSettlementBucket = 'app-to-vendor' | 'vendor-to-app';

/**
 * Split like hub directions: pay GMV only when KoyaKart/hub holds the cash.
 * Shop-held COD (own staff or confirmed at shop) belongs on Vendor pays KoyaKart.
 */
export function vendorSettlementBucket(
  row: Pick<
    SettlementCandidate,
    'paymentMethod' | 'codRemittedToHub' | 'codCashLocation' | 'vendorAgentDelivery'
  >,
): VendorSettlementBucket {
  if ((row.paymentMethod ?? '').toUpperCase() !== 'COD') return 'app-to-vendor';
  const stage = codCashStage(row);
  if (stage === 'WITH_VENDOR' || stage === 'DECLARED_TO_VENDOR') return 'vendor-to-app';
  if (row.vendorAgentDelivery && stage !== 'AT_HUB' && stage !== 'DECLARED_TO_HUB') {
    return 'vendor-to-app';
  }
  return 'app-to-vendor';
}

export function sumSelectedByCashStage(
  candidates: SettlementCandidate[],
  selected: Set<string>,
): {
  online: number;
  codWithAgent: number;
  codAtHub: number;
  codWithVendor: number;
  codDeclaredToVendor: number;
  codDeclaredToHub: number;
} {
  let online = 0;
  let codWithAgent = 0;
  let codAtHub = 0;
  let codWithVendor = 0;
  let codDeclaredToVendor = 0;
  let codDeclaredToHub = 0;
  for (const c of candidates) {
    if (!selected.has(c.subOrderId)) continue;
    const amt = Number(c.subtotal ?? 0);
    const stage = codCashStage(c);
    if (stage === 'ONLINE') online += amt;
    else if (stage === 'WITH_AGENT') codWithAgent += amt;
    else if (stage === 'AT_HUB') codAtHub += amt;
    else if (stage === 'WITH_VENDOR') codWithVendor += amt;
    else if (stage === 'DECLARED_TO_VENDOR') codDeclaredToVendor += amt;
    else if (stage === 'DECLARED_TO_HUB') codDeclaredToHub += amt;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    online: round(online),
    codWithAgent: round(codWithAgent),
    codAtHub: round(codAtHub),
    codWithVendor: round(codWithVendor),
    codDeclaredToVendor: round(codDeclaredToVendor),
    codDeclaredToHub: round(codDeclaredToHub),
  };
}

