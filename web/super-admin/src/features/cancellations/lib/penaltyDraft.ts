import { settlementsVendorCollectUrl } from '@/features/dues/accountsDeepLinks';
import type { AdminCancellationRow } from '../api/cancellationsApi';

const STORAGE_KEY = 'hlm.cancellationPenaltyDraft';

export type CancellationPenaltyDraft = {
  townId: string;
  vendorId: string;
  orderNumber: string;
  suggestedAmount: number;
  reason: string;
};

export function penaltyReasonForRow(row: AdminCancellationRow): string {
  const bits = [
    `Cancel penalty · ${row.orderNumber}`,
    row.summary ?? row.kind,
    row.reason?.trim() || null,
  ].filter(Boolean);
  return bits.join(' · ').slice(0, 500);
}

export function penaltyPeriodForRow(row: AdminCancellationRow): { periodStart: string; periodEnd: string } {
  const day =
    row.occurredAt && row.occurredAt.length >= 10
      ? row.occurredAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return { periodStart: day, periodEnd: day };
}

export function suggestedPenaltyAmount(row: AdminCancellationRow): number {
  return Math.max(0, Number(row.cancelledAmount ?? 0));
}

export function stashVendorPenaltyDraft(row: AdminCancellationRow): CancellationPenaltyDraft {
  const reason = penaltyReasonForRow(row);
  const draft: CancellationPenaltyDraft = {
    townId: row.townId,
    vendorId: row.vendorId ?? '',
    orderNumber: row.orderNumber,
    suggestedAmount: Math.max(0, Number(row.cancelledAmount ?? 0)),
    reason,
  };
  if (draft.vendorId) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }
  return draft;
}

export function readVendorPenaltyDraft(): CancellationPenaltyDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CancellationPenaltyDraft;
  } catch {
    return null;
  }
}

export function clearVendorPenaltyDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function settlementsUrlForPenalty(row: AdminCancellationRow): string | null {
  if (!row.vendorId) return null;
  stashVendorPenaltyDraft(row);
  return settlementsVendorCollectUrl({
    townId: row.townId,
    vendorId: row.vendorId,
    paysSubTab: 'collect',
  });
}