import { apiRequest } from '@/shared/api/http';

export type ScratchGiftTownRow = {
  townId: string;
  townName?: string | null;
  issued: number;
  scratched: number;
  unopened: number;
  giftedAmount: number;
};

export type ScratchGiftLine = {
  cardId: string;
  issuedAt: string;
  revealedAt?: string | null;
  status: string;
  townId: string;
  townName?: string | null;
  orderId: string;
  orderNumber?: string | null;
  buyerPhone?: string | null;
  revealedAmount: number;
  rewardMin: number;
  rewardMax: number;
  companySpent: number;
};

export type ScratchGiftReport = {
  from?: string | null;
  to?: string | null;
  issued: number;
  scratched: number;
  unopened: number;
  giftedAmount: number;
  avgGift?: number;
  minGift?: number;
  maxGift?: number;
  pendingMin?: number;
  pendingMax?: number;
  towns: ScratchGiftTownRow[];
  lines?: ScratchGiftLine[];
};

export async function fetchScratchGiftReport(
  token: string,
  opts: { townId?: string; from?: string; to?: string } = {},
): Promise<ScratchGiftReport> {
  const params = new URLSearchParams();
  if (opts.townId) params.set('townId', opts.townId);
  if (opts.from && opts.to) {
    params.set('from', opts.from);
    params.set('to', opts.to);
  }
  const q = params.toString();
  return apiRequest<ScratchGiftReport>(`/api/v1/orders/admin/scratch-cards/report${q ? `?${q}` : ''}`, {
    token,
  });
}
