import { apiRequest } from '@/shared/api/http';

export type BuyerSpendReport = {
  from: string;
  to: string;
  townId?: string | null;
  ordersPlaced: number;
  ordersDelivered: number;
  ordersCancelled: number;
  spent: number;
  deliveredSpend: number;
  codSpend: number;
  onlineSpend: number;
  averageOrderValue: number;
  months: Array<{ month: string; orders: number; spent: number }>;
};

export async function fetchBuyerSpendReport(
  token: string,
  opts: { townId?: string; from?: string; to?: string } = {},
): Promise<BuyerSpendReport> {
  const params = new URLSearchParams();
  if (opts.townId) params.set('townId', opts.townId);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const q = params.toString();
  return apiRequest<BuyerSpendReport>(`/api/v1/orders/me/spend-report${q ? `?${q}` : ''}`, { token });
}
