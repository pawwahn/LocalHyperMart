import { apiRequest } from '@/shared/api/http';

export type ScratchGiftTownRow = {
  townId: string;
  townName?: string | null;
  issued: number;
  scratched: number;
  unopened: number;
  giftedAmount: number;
};

export type ScratchGiftReport = {
  from?: string | null;
  to?: string | null;
  issued: number;
  scratched: number;
  unopened: number;
  giftedAmount: number;
  towns: ScratchGiftTownRow[];
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
