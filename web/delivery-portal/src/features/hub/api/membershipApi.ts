import { apiRequest } from '@/shared/api/http';

export type HubMembershipPurchase = {
  purchaseId: string;
  buyerPhone?: string | null;
  slab: string;
  creditsGranted: number;
  price: number;
  status: string;
};

export async function fetchHubPendingCash(token: string): Promise<HubMembershipPurchase[]> {
  return apiRequest<HubMembershipPurchase[]>('/api/v1/payments/hub/memberships/pending-cash', { token });
}

export async function confirmHubMembershipCash(token: string, purchaseId: string): Promise<HubMembershipPurchase> {
  return apiRequest<HubMembershipPurchase>('/api/v1/payments/hub/memberships/cash/confirm', {
    token,
    method: 'POST',
    body: { purchaseId },
  });
}

export async function cancelHubMembershipCash(token: string, purchaseId: string): Promise<HubMembershipPurchase> {
  return apiRequest<HubMembershipPurchase>(`/api/v1/payments/hub/memberships/cash/${purchaseId}/cancel`, {
    token,
    method: 'POST',
  });
}
