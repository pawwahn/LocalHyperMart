import type { TimelineStep } from '@/features/shop/components/OrderStatusTimeline';
import type { LaundryOrder } from '../api/laundryApi';

/** Same journey stages as the shop portal, in customer-friendly words. */
const TRACK = ['Sent', 'Pickup', 'Shop', 'Ready', 'Done'] as const;

/** Which track step is active (0–4). */
export function laundryProgressStepIndex(status: string): number {
  if (status === 'AWAITING_PAYMENT' || status === 'REQUESTED') return 0;
  if (status === 'ACCEPTED' || status === 'PICKUP_SCHEDULED') return 1;
  if (status === 'PICKED_UP' || status === 'AT_SHOP' || status === 'IN_PROCESS') return 2;
  if (status === 'READY' || status === 'OUT_FOR_DROP') return 3;
  if (status === 'DELIVERED') return 4;
  return -1;
}

function trackLabel(stepIndex: number, logistics: string): string {
  const base = TRACK[stepIndex] ?? 'Step';
  if (stepIndex === 1 && logistics === 'DROP_ONLY') return 'Drop-off';
  if (stepIndex === 4 && logistics === 'PICKUP_ONLY') return 'Collected';
  if (stepIndex === 4 && logistics !== 'PICKUP_ONLY') return 'Delivered';
  return base;
}

function stepState(stepIndex: number, current: number, status: string): string {
  if (status === 'CANCELLED') return 'UPCOMING';
  if (status === 'DELIVERED') return 'DONE';
  if (current < 0) return 'UPCOMING';
  if (stepIndex < current) return 'DONE';
  if (stepIndex === current) return 'CURRENT';
  return 'UPCOMING';
}

function stepTimestamp(order: LaundryOrder, stepIndex: number): string | null {
  if (stepIndex === 0) return order.placedAt ?? null;
  if (stepIndex === 4 && order.status === 'DELIVERED') return order.deliveredAt ?? null;
  return null;
}

function stepNote(order: LaundryOrder, stepIndex: number): string | null {
  const status = order.status;
  if (stepIndex === 1) {
    if (status === 'PICKUP_SCHEDULED' || status === 'ACCEPTED') {
      if (order.pickupSlotStart) {
        const start = formatShort(order.pickupSlotStart);
        const end = order.pickupSlotEnd ? formatShort(order.pickupSlotEnd) : '';
        return end ? `Pickup window ${start} – ${end}` : `Pickup from ${start}`;
      }
      return 'Agent will collect from your address';
    }
    if (status === 'PICKED_UP' || status === 'AT_SHOP' || status === 'IN_PROCESS' || status === 'READY' || status === 'OUT_FOR_DROP' || status === 'DELIVERED') {
      return 'Picked up from your address';
    }
  }
  if (stepIndex === 2) {
    if (status === 'PICKED_UP') return 'Handed to the shop — waiting to be checked in';
    if (status === 'AT_SHOP') return 'Clothes received at the shop';
    if (status === 'IN_PROCESS') return 'Your clothes are being cleaned';
  }
  if (stepIndex === 3) {
    if (order.estimatedReadyAt && (status === 'IN_PROCESS' || status === 'AT_SHOP' || status === 'READY')) {
      return `Ready about ${formatShort(order.estimatedReadyAt)}`;
    }
    if (status === 'OUT_FOR_DROP') return 'Agent is on the way back to you';
    if (status === 'READY') return 'Ready — agent will be assigned for delivery';
  }
  if (stepIndex === 4 && status === 'DELIVERED') {
    return 'Delivered to you';
  }
  if (order.paymentStatus === 'COLLECTED' && order.paymentMethod === 'CASH' && stepIndex === 2) {
    return 'Payment received at the shop';
  }
  return null;
}

function formatShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Build timeline steps for {@link OrderStatusTimeline}. */
export function buildLaundryBuyerTimeline(order: LaundryOrder): TimelineStep[] {
  if (order.status === 'CANCELLED') {
    return [
      {
        code: 'CANCELLED',
        label: 'Cancelled',
        state: 'CURRENT',
        at: order.deliveredAt ?? order.placedAt,
        note: null,
      },
    ];
  }

  const current = laundryProgressStepIndex(order.status);
  return TRACK.map((_, index) => ({
    code: `LAUNDRY_${index}`,
    label: trackLabel(index, order.logistics),
    state: stepState(index, current, order.status),
    at: stepTimestamp(order, index),
    note: stepNote(order, index),
  }));
}
