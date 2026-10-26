import type { AssignmentView, DeliveryManifestView } from '../api/agentApi';

export type CodCollectInfo = {
  amount: number;
  isCod: true;
};

function isCollectOnDelivery(method: string | null | undefined): boolean {
  if (!method) return false;
  const key = method.trim().toUpperCase();
  return key === 'COD' || key === 'CASH';
}

/** Merge assignment + manifest so COD shows even before manifest loads. */
export function resolveCodCollect(
  task: AssignmentView,
  manifest?: DeliveryManifestView | null,
): CodCollectInfo | null {
  const method = manifest?.paymentMethod ?? task.paymentMethod;
  if (!isCollectOnDelivery(method)) return null;

  const fromTask = task.collectCashAmount;
  const fromManifest = manifest?.collectCashAmount;
  const amount =
    (fromManifest != null && fromManifest > 0 ? fromManifest : null) ??
    (fromTask != null && fromTask > 0 ? fromTask : null);

  if (amount == null || amount <= 0) return null;
  return { amount, isCod: true };
}

export function formatCollectRupee(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}
