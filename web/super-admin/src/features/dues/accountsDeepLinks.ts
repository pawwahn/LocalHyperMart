/** Deep links between Accounts (/dues) and vendor Payouts (/settlements). */

export function accountsCollectUrl(params: {
  townId: string;
  partyId: string;
  party?: 'VENDOR' | 'HUB';
}): string {
  const q = new URLSearchParams({
    action: 'COLLECT',
    townId: params.townId,
    party: params.party ?? 'VENDOR',
    partyId: params.partyId,
  });
  return `/dues?${q.toString()}`;
}

export function settlementsVendorCollectUrl(params: {
  townId: string;
  vendorId: string;
  paysSubTab?: 'collect' | 'records';
}): string {
  const q = new URLSearchParams({
    townId: params.townId,
    vendorId: params.vendorId,
    vendorTab: 'vendor-to-app',
  });
  if (params.paysSubTab) q.set('paysSubTab', params.paysSubTab);
  return `/settlements?${q.toString()}`;
}
