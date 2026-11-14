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
  platformFee?: number | null;
  codFee?: number | null;
  /** Goods COD cash with the shop/vendor on shop-held rows. */
  shopCodCash?: number | null;
  /** Bundled buyer delivery / membership plan on COD. */
  membershipFee?: number | null;
  penalty?: number | null;
  /** Buyer UPI collected by KoyaKart on this row. */
  upiAppReceived?: number | null;
  /** Bags or orders on this row paid via UPI. */
  upiOrderCount?: number | null;
  itemCount: number;
  reference?: string | null;
  /** Vendor or hub settlement waiting for confirmation. */
  settlementId?: string | null;
  /** Hub payment submission waiting for verification. */
  submissionId?: string | null;
  hubPaymentRequestId?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  /** Payer note entered with UTR / reference (vendor shop bills, etc.). */
  paymentNotes?: string | null;
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

function asFee(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLine(raw: TownDueLine & Record<string, unknown>): TownDueLine {
  const snake = raw as Record<string, unknown>;
  return {
    ...raw,
    amount: asFee(raw.amount) ?? 0,
    commission: asFee(raw.commission),
    platformFee: asFee(raw.platformFee ?? snake.platform_fee),
    codFee: asFee(raw.codFee ?? snake.cod_fee),
    shopCodCash: asFee(raw.shopCodCash ?? snake.shop_cod_cash),
    membershipFee: asFee(raw.membershipFee ?? snake.membership_fee),
    penalty: asFee(raw.penalty),
    upiAppReceived: asFee(raw.upiAppReceived ?? snake.upi_app_received),
    upiOrderCount: asFee(raw.upiOrderCount ?? snake.upi_order_count),
    detail: (raw.detail ?? snake.detail) as string | null | undefined,
    hubPaymentRequestId: (raw.hubPaymentRequestId ?? snake.hub_payment_request_id) as string | null | undefined,
    paymentNotes: (raw.paymentNotes ?? snake.payment_notes) as string | null | undefined,
  };
}

export function fetchTownDues(
  token: string,
  range?: { from?: string; to?: string },
  townId?: string,
  includeOpenWork = true,
  openWorkOnly = false,
  /** Comma-separated DueAction values — e.g. `PAY` for a faster payout-only scan. */
  openWorkActions?: string,
): Promise<TownDuesReport> {
  const q = new URLSearchParams();
  if (range?.from) q.set('from', range.from);
  if (range?.to) q.set('to', range.to);
  if (townId) q.set('townId', townId);
  q.set('includeOpenWork', includeOpenWork ? 'true' : 'false');
  if (openWorkOnly) q.set('openWorkOnly', 'true');
  if (openWorkActions?.trim()) q.set('openWorkActions', openWorkActions.trim());
  const query = q.toString();
  return apiRequest<TownDuesReport>(`/api/v1/payments/admin/town-dues${query ? `?${query}` : ''}`, { token }).then(
    (report) => ({
      ...report,
      towns: (report.towns ?? []).map((town) => ({
        ...town,
        lines: (town.lines ?? []).map((line) =>
          normalizeLine(line as TownDueLine & Record<string, unknown>),
        ),
      })),
    }),
  );
}
