import { apiRequest } from '@/shared/api/http';

export type DueAction = 'SEND_BILL' | 'COLLECT' | 'PAY' | 'CONFIRM';
export type DueParty = 'HUB' | 'VENDOR' | 'AGENT';

export type TownDueLine = {
  party: DueParty;
  partyId?: string | null;
  partyName?: string | null;
  action: DueAction;
  what: string;
  detail?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount: number;
  /** Vendor commission. Null when this row is not commission. */
  commission?: number | null;
  itemCount: number;
  reference?: string | null;
  /** Vendor or hub settlement waiting for confirmation. */
  settlementId?: string | null;
  /** Hub payment submission waiting for verification. */
  submissionId?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
};

export type TownDueTown = {
  townId: string;
  sendBill: number;
  collect: number;
  pay: number;
  confirm: number;
  lines: TownDueLine[];
};

export type TownDuesReport = {
  from?: string | null;
  to?: string | null;
  sendBill: number;
  collect: number;
  pay: number;
  confirm: number;
  townCount: number;
  towns: TownDueTown[];
};

export function fetchTownDues(
  token: string,
  range?: { from?: string; to?: string },
): Promise<TownDuesReport> {
  const q = new URLSearchParams();
  if (range?.from) q.set('from', range.from);
  if (range?.to) q.set('to', range.to);
  const query = q.toString();
  return apiRequest<TownDuesReport>(`/api/v1/payments/admin/town-dues${query ? `?${query}` : ''}`, { token });
}
