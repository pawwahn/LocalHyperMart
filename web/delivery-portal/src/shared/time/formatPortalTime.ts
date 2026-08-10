/** Asia/Kolkata wall clock for hub + agent action times. */
export function formatPortalTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export type ActionEventView = {
  eventType: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

/** Plain-language labels for delivery_events.event_type (keep short for one-liners). */
export function actionEventLabel(
  eventType: string,
  metadata?: Record<string, unknown> | null,
  resolveAgentName?: (agentId: string) => string | undefined,
): string {
  switch (eventType) {
    case 'PICKUP_ASSIGNED':
      return 'Sent to shop';
    case 'LAST_MILE_ASSIGNED':
      return 'Sent to home';
    case 'REASSIGNED': {
      const from =
        stringMeta(metadata, 'previousAgentName') ||
        resolveAgentName?.(stringMeta(metadata, 'previousAgentId') ?? '') ||
        'Previous agent';
      const to =
        stringMeta(metadata, 'newAgentName') ||
        resolveAgentName?.(stringMeta(metadata, 'newAgentId') ?? '') ||
        'New agent';
      return `Changed agent:  ${from} → ${to}`;
    }
    case 'PICKED_FROM_VENDOR':
      return 'Took bag from shop';
    case 'PICKED_FROM_HUB':
      return 'Left hub to home';
    case 'BROUGHT_TO_HUB':
      return 'Bag at hub';
    case 'DELIVERED':
      return 'Delivered';
    case 'BUYER_REJECTED':
      return 'Customer refused';
    case 'OTP_OVERRIDE':
      return 'OTP changed';
    default:
      return eventType.replaceAll('_', ' ').toLowerCase();
  }
}

function stringMeta(metadata: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
