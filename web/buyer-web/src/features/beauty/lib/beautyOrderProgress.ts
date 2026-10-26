import type { BeautyOrder } from '../api/beautyApi';

const STEPS = [
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'EN_ROUTE', label: 'On the way' },
  { key: 'IN_SERVICE', label: 'In session' },
  { key: 'COMPLETED', label: 'Done' },
] as const;

function stepIndex(status: string): number {
  if (status === 'AWAITING_PAYMENT') return -1;
  if (status === 'CANCELLED') return -2;
  const idx = STEPS.findIndex((row) => row.key === status);
  if (idx >= 0) return idx;
  if (status === 'EN_ROUTE') return 1;
  return 0;
}

export function buildBeautyBuyerTimeline(order: BeautyOrder) {
  const current = stepIndex(order.status);
  if (order.status === 'CANCELLED') {
    return [{ label: 'Cancelled', done: true, current: true }];
  }
  if (order.venue === 'AT_STUDIO') {
    const studioSteps = [
      { key: 'CONFIRMED', label: 'Confirmed' },
      { key: 'IN_SERVICE', label: 'At studio' },
      { key: 'COMPLETED', label: 'Done' },
    ];
    const idx = studioSteps.findIndex((row) => row.key === order.status);
    const at = idx >= 0 ? idx : order.status === 'IN_SERVICE' ? 1 : 0;
    return studioSteps.map((row, i) => ({
      label: row.label,
      done: i < at || order.status === 'COMPLETED',
      current: i === at && order.status !== 'COMPLETED',
    }));
  }
  return STEPS.map((row, i) => ({
    label: row.label,
    done: current > i || order.status === 'COMPLETED',
    current: i === current && order.status !== 'COMPLETED',
  }));
}
